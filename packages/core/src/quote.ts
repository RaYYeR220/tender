import { type Rail, railFromNetwork } from "./chains.js";
import type { CheckoutRef } from "./ref.js";

// The live 402 challenge is the source of truth for what a checkout costs and
// where the money goes. An unpaid POST returns it; MoonPay Commerce allocates a
// per-payer deposit wallet (payTo) on that first request.

export const HELIO_API = "https://api.hel.io";

export interface QuoteOption {
  rail: Rail;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  feePayer: string | null;
  maxTimeoutSeconds: number | null;
}

export type QuoteErrorCode =
  | "LINK_NOT_FOUND"
  | "LINK_INACTIVE"
  | "MERCHANT_DISABLED"
  | "REQUIRES_CUSTOMER_DETAILS"
  | "NETWORK_FEES_TOO_HIGH"
  | "AMOUNT_TOO_SMALL"
  | "INVALID_AMOUNT"
  | "INVALID_PAYER"
  | "SANCTIONED"
  | "PAYER_MISMATCH"
  | "SETTLEMENT_IN_PROGRESS"
  | "RATE_LIMITED"
  | "UNSUPPORTED_CHECKOUT"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_UNAVAILABLE";

export type Quote =
  | {
      ok: true;
      url: string;
      x402Version: number;
      description: string | null;
      options: QuoteOption[];
      otherNetworks: { network: string; amount: string }[];
    }
  | { ok: false; url: string; status: number; code: QuoteErrorCode; message: string };

export function checkoutUrl(ref: Extract<CheckoutRef, { kind: "paylink" | "deposit" }>, payer: string, amountAtomic?: string): string {
  const path = ref.kind === "deposit" ? "deposit" : "checkout";
  const url = new URL(`/v1/x402/${path}/${ref.id}`, HELIO_API);
  if (amountAtomic !== undefined) url.searchParams.set("amount", amountAtomic);
  url.searchParams.set("payerAddress", payer);
  return url.toString();
}

function decodeChallenge(header: string | null, body: string): Record<string, unknown> | null {
  const candidates: string[] = [];
  if (header) candidates.push(Buffer.from(header, "base64").toString("utf8"));
  candidates.push(body);
  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (Array.isArray(parsed.accepts)) return parsed;
    } catch {
      // try the next encoding
    }
  }
  return null;
}

export function classifyError(status: number, message: string): QuoteErrorCode {
  const m = message.toLowerCase();
  if (status === 404) return "LINK_NOT_FOUND";
  if (status === 409) return "SETTLEMENT_IN_PROGRESS";
  if (status === 429) return "RATE_LIMITED";
  if (m.includes("sanction")) return "SANCTIONED";
  if (m.includes("creator is disabled")) return "MERCHANT_DISABLED";
  if (m.includes("payer mismatch")) return "PAYER_MISMATCH";
  if (m.includes("customer detail") || m.includes("x402_unsupported_features")) return "REQUIRES_CUSTOMER_DETAILS";
  if (m.includes("fee rate exceeds") || m.includes("fee_rate_exceeds_price")) return "AMOUNT_TOO_SMALL";
  if (m.includes("fee margin") || m.includes("no supported chains") || m.includes("fee_margin_insufficient")) return "NETWORK_FEES_TOO_HIGH";
  if (m.includes("inactive") || m.includes("deleted") || m.includes("disabled")) return "LINK_INACTIVE";
  if (m.includes("payer") && m.includes("address")) return "INVALID_PAYER";
  if (m.includes("amount")) return "INVALID_AMOUNT";
  if (m.includes("subscription") || m.includes("not supported")) return "UNSUPPORTED_CHECKOUT";
  return "UPSTREAM_ERROR";
}

export function parseQuote(url: string, status: number, paymentRequiredHeader: string | null, body: string): Quote {
  if (status === 402) {
    const challenge = decodeChallenge(paymentRequiredHeader, body);
    if (!challenge) return { ok: false, url, status, code: "UPSTREAM_ERROR", message: "402 without a readable payment challenge." };
    const options: QuoteOption[] = [];
    const otherNetworks: { network: string; amount: string }[] = [];
    for (const entry of challenge.accepts as unknown[]) {
      const a = (entry ?? {}) as Record<string, unknown>;
      if (a.scheme !== "exact" || typeof a.network !== "string" || typeof a.payTo !== "string" || typeof a.asset !== "string") continue;
      const amount = typeof a.amount === "string" ? a.amount : typeof a.maxAmountRequired === "string" ? a.maxAmountRequired : null;
      if (!amount || !/^[1-9][0-9]*$/.test(amount)) continue;
      const rail = railFromNetwork(a.network);
      if (!rail) {
        otherNetworks.push({ network: a.network, amount });
        continue;
      }
      const extra = (a.extra ?? {}) as Record<string, unknown>;
      options.push({
        rail,
        network: a.network,
        amount,
        asset: a.asset,
        payTo: a.payTo,
        feePayer: typeof extra.feePayer === "string" ? extra.feePayer : null,
        maxTimeoutSeconds: typeof a.maxTimeoutSeconds === "number" ? a.maxTimeoutSeconds : null,
      });
    }
    const resource = (challenge.resource ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      url,
      x402Version: typeof challenge.x402Version === "number" ? challenge.x402Version : 1,
      description: typeof resource.description === "string" ? resource.description : null,
      options,
      otherNetworks,
    };
  }
  let message = `MoonPay Commerce answered HTTP ${status}.`;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (typeof parsed.message === "string") message = parsed.message;
    if (typeof parsed.errorCode === "string") message = `${parsed.errorCode}: ${message}`;
  } catch {
    // keep the generic message
  }
  if (status >= 200 && status < 300) {
    return { ok: false, url, status, code: "UPSTREAM_ERROR", message: "Checkout answered without asking for payment." };
  }
  return { ok: false, url, status, code: classifyError(status, message), message };
}
