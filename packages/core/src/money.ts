import { TenderError } from "./errors.js";

// Exact decimal <-> atomic conversion. Amounts never pass through floating point.

export function toAtomic(amount: string, decimals: number): string {
  const trimmed = amount.trim().replace(/^\$/, "");
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(trimmed)) {
    throw new TenderError("INVALID_AMOUNT", `"${amount}" is not a plain decimal amount.`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new TenderError("INVALID_AMOUNT", `"${amount}" has more than ${decimals} decimal places.`);
  }
  return BigInt(`${whole}${fraction.padEnd(decimals, "0")}`).toString();
}

export function fromAtomic(atomic: string, decimals: number): string {
  const value = BigInt(atomic);
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function formatUsd(atomic: string, decimals = 6): string {
  const exact = fromAtomic(atomic, decimals);
  const [whole, fraction = ""] = exact.split(".");
  return `$${whole}.${fraction.padEnd(2, "0")}`;
}
