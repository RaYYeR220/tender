import { TenderError } from "./errors.js";
import { normalizePaylink, type Product } from "./product.js";
import type { Rail } from "./chains.js";
import { HELIO_API, checkoutUrl, parseQuote, type Quote } from "./quote.js";
import { isObjectId, type CheckoutRef } from "./ref.js";

export type Fetch = typeof fetch;

export interface HelioOptions {
  fetch?: Fetch;
  timeoutMs?: number;
  authorization?: string;
}

const ORIGIN = "https://moonpay.hel.io";

function requestInit(options: HelioOptions, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (options.authorization) headers.set("Authorization", options.authorization);
  return { ...init, headers, redirect: "error", signal: AbortSignal.timeout(options.timeoutMs ?? 4_000) };
}

async function call(options: HelioOptions, url: string, init?: RequestInit): Promise<Response> {
  try {
    return await (options.fetch ?? fetch)(url, requestInit(options, init));
  } catch {
    throw new TenderError("UPSTREAM_UNAVAILABLE", "MoonPay Commerce did not answer in time.");
  }
}

export async function getPaylink(id: string, options: HelioOptions = {}): Promise<Product> {
  if (!isObjectId(id)) throw new TenderError("INVALID_REFERENCE", "Pay link ids are 24 hex characters.");
  const response = await call(options, `${HELIO_API}/v1/paylink/${id}/public`, { headers: { Origin: ORIGIN } });
  if (response.status === 404) throw new TenderError("LINK_NOT_FOUND", "No MoonPay Commerce pay link has that id.");
  if (!response.ok) throw new TenderError("UPSTREAM_ERROR", `MoonPay Commerce answered HTTP ${response.status}.`);
  // Unknown ids come back as HTTP 200 with a JSON null body.
  const body: unknown = await response.json();
  if (body === null) throw new TenderError("LINK_NOT_FOUND", "No MoonPay Commerce pay link has that id.");
  return normalizePaylink(body);
}

export async function getQuote(url: string, options: HelioOptions = {}): Promise<Quote> {
  if (!url.startsWith(`${HELIO_API}/v1/x402/`)) throw new TenderError("INVALID_REFERENCE", "Quotes only come from api.hel.io x402 endpoints.");
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 4_000),
    });
  } catch {
    return { ok: false, url, status: 0, code: "UPSTREAM_UNAVAILABLE", message: "MoonPay Commerce did not answer in time." };
  }
  return parseQuote(url, response.status, response.headers.get("payment-required"), await response.text());
}

// Re-derives the deposit wallet MoonPay Commerce assigns this payer for this
// checkout, so a receipt can prove the payment went to the right place.
export function depositResolver(ref: CheckoutRef, payer: string, product: Product | null, options: HelioOptions = {}) {
  return async (rail: Rail, amountAtomic: string): Promise<string | null> => {
    if (ref.kind === "charge") return null;
    const quote = await getQuote(checkoutUrl(ref, payer, product?.pricing.mode === "fixed" ? undefined : amountAtomic), options);
    return quote.ok ? (quote.options.find((o) => o.rail === rail)?.payTo ?? null) : null;
  };
}
