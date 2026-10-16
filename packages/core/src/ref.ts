import { TenderError } from "./errors.js";

// A checkout reference is whatever a merchant hands out: a hosted pay link,
// an x402 checkout URL, a deposit, or a bare id. Ids are validated strictly
// because they are interpolated into api.hel.io paths.

export type CheckoutRef =
  | { kind: "paylink"; id: string }
  | { kind: "deposit"; id: string }
  | { kind: "charge"; token: string };

const OBJECT_ID = /^[a-f0-9]{24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOSTS = new Set(["hel.io", "www.hel.io", "app.hel.io", "moonpay.hel.io", "api.hel.io", "embed.hel.io"]);

export function isObjectId(value: string): boolean {
  return OBJECT_ID.test(value);
}

export function parseCheckoutRef(input: string): CheckoutRef {
  const value = input.trim();
  if (OBJECT_ID.test(value.toLowerCase())) return { kind: "paylink", id: value.toLowerCase() };

  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw invalid(input);
  }
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname.toLowerCase())) throw invalid(input);

  const parts = url.pathname.split("/").filter(Boolean).map((part) => part.toLowerCase());
  const after = (marker: string) => {
    const index = parts.lastIndexOf(marker);
    return index >= 0 ? parts[index + 1] : undefined;
  };

  const deposit = after("deposit");
  if (deposit !== undefined) {
    if (!OBJECT_ID.test(deposit)) throw invalid(input);
    return { kind: "deposit", id: deposit };
  }
  const charge = after("charge");
  if (charge !== undefined) {
    if (!UUID.test(charge)) throw invalid(input);
    return { kind: "charge", token: charge };
  }
  const candidate = after("pay") ?? after("checkout") ?? after("paylink");
  if (candidate !== undefined && OBJECT_ID.test(candidate)) return { kind: "paylink", id: candidate };
  throw invalid(input);
}

export function hostedUrl(ref: CheckoutRef): string {
  switch (ref.kind) {
    case "paylink":
      return `https://moonpay.hel.io/pay/${ref.id}`;
    case "deposit":
      return `https://moonpay.hel.io/deposit/${ref.id}`;
    case "charge":
      return `https://moonpay.hel.io/charge/${ref.token}`;
  }
}

function invalid(input: string): TenderError {
  return new TenderError(
    "INVALID_REFERENCE",
    `"${input.slice(0, 120)}" is not a MoonPay Commerce pay link, deposit, charge or 24-character id.`,
  );
}
