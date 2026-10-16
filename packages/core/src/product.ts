import { type Rail, railFromHelioBlockchain, isUsdc } from "./chains.js";
import { TenderError } from "./errors.js";

// The public pay link document from GET /v1/paylink/{id}/public, reduced to
// what a buyer's agent needs before it spends anything.

export interface Merchant {
  name: string;
  website: string | null;
  twitter: string | null;
  twitterConfirmed: boolean;
  kycVerified: boolean;
  kybVerified: boolean;
  verified: boolean;
}

export interface Currency {
  symbol: string;
  decimals: number;
  rail: Rail | null;
  network: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  template: string;
  merchant: Merchant;
  pricing: { mode: "fixed"; amount: string; currency: Currency } | { mode: "dynamic"; currency: Currency };
  usdcPriced: boolean;
  rails: Rail[];
  otherNetworks: string[];
  payout: { rail: Rail; address: string }[];
  requiredFields: string[];
  gates: string[];
  active: boolean;
  inactiveReason: string | null;
  maxTransactions: number | null;
  subscription: boolean;
}

// Fields Helio rejects for x402 ("customer detail requirements").
const CUSTOMER_FIELDS: Record<string, string> = {
  requireEmail: "email",
  requireFullName: "full name",
  requirePhoneNumber: "phone number",
  requireCountry: "country",
  requireDeliveryAddress: "delivery address",
  requireDiscordUsername: "Discord username",
  requireDiscordLogin: "Discord login",
  requireDiscordAuth: "Discord auth",
  requireTwitterUsername: "X username",
  requireTelegramUsername: "Telegram username",
  requireXFollow: "X follow",
};

// Access gates an agent cannot satisfy on its own.
const GATES: Record<string, string> = {
  requireAccessCode: "access code",
  requireNftGate: "NFT ownership",
};

type Json = Record<string, unknown>;

// Merchant-supplied text reaches an agent's context. Strip control and
// formatting characters, collapse whitespace and bound the length so a name or
// description cannot pose as instructions or as Tender's own labels.
export function cleanText(value: string, max: number): string {
  const flat = value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Zl}\p{Zp}\u{E0000}-\u{E007F}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = [...flat];
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : flat;
}

function cleanWebsite(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

const obj = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});
const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const bool = (value: unknown): boolean => value === true;

function currency(raw: unknown): Currency | null {
  const c = obj(raw);
  const symbol = str(c.symbol);
  const decimals = typeof c.decimals === "number" ? c.decimals : null;
  const chain = str(obj(c.blockchain).name);
  if (!symbol || decimals === null || !chain) return null;
  return { symbol, decimals, rail: railFromHelioBlockchain(chain), network: chain };
}

export function normalizePaylink(raw: unknown): Product {
  const d = obj(raw);
  const id = str(d.id);
  if (!id) throw new TenderError("UPSTREAM_INVALID", "MoonPay Commerce returned a pay link without an id.");

  const features = obj(d.features);
  const company = obj(d.company);
  const pricingCurrency = currency(d.pricingCurrency) ?? currency(d.currency);
  if (!pricingCurrency) throw new TenderError("UPSTREAM_INVALID", "Pay link has no pricing currency.");

  const dynamic = bool(features.canChangePrice) || bool(d.dynamic) || bool(features.dynamic);
  const price = str(d.price) ?? "0";

  const rails = new Set<Rail>();
  const otherNetworks = new Set<string>();
  const payout = new Map<string, { rail: Rail; address: string }>();
  for (const entry of Array.isArray(d.recipients) ? d.recipients : []) {
    const r = obj(entry);
    const c = currency(r.currency);
    const address = str(obj(r.wallet).publicKey);
    if (!c) continue;
    const mint = str(obj(r.currency).mintAddress) ?? "";
    if (c.rail && c.symbol === "USDC" && isUsdc(c.rail, mint)) {
      rails.add(c.rail);
      if (address) payout.set(`${c.rail}:${address}`, { rail: c.rail, address });
    } else if (!c.rail) {
      otherNetworks.add(c.network);
    }
  }

  const requiredFields = Object.entries(CUSTOMER_FIELDS).filter(([flag]) => bool(features[flag])).map(([, label]) => label);
  const gates = Object.entries(GATES).filter(([flag]) => bool(features[flag])).map(([, label]) => label);

  const disabled = bool(d.disabled);
  const inactive = bool(d.inactive);
  const creatorDisabled = bool(obj(d.creator).isDisabled);
  const inactiveReason = disabled ? "disabled by the merchant" : inactive ? "inactive" : creatorDisabled ? "merchant account disabled" : null;

  const template = str(d.template) ?? "OTHER";
  const website = str(company.websiteUrl);

  return {
    id,
    name: cleanText(str(d.name) ?? "Untitled", 120),
    description: cleanText(str(d.description) ?? "", 600),
    template,
    merchant: {
      name: cleanText(str(company.name) ?? "Unknown merchant", 80),
      website: cleanWebsite(website),
      twitter: str(company.twitterUsername) && /^[A-Za-z0-9_]{1,15}$/.test(str(company.twitterUsername)!) ? str(company.twitterUsername) : null,
      twitterConfirmed: bool(company.twitterConfirmed),
      kycVerified: bool(company.kycVerified),
      kybVerified: bool(company.kybVerified),
      verified: bool(company.isVerified),
    },
    pricing: dynamic ? { mode: "dynamic", currency: pricingCurrency } : { mode: "fixed", amount: price, currency: pricingCurrency },
    usdcPriced: pricingCurrency.symbol === "USDC",
    rails: [...rails],
    otherNetworks: [...otherNetworks],
    payout: [...payout.values()],
    requiredFields,
    gates,
    active: inactiveReason === null,
    inactiveReason,
    maxTransactions: typeof d.maxTransactions === "number" ? d.maxTransactions : null,
    subscription: template.startsWith("SUBSCRIPTION"),
  };
}
