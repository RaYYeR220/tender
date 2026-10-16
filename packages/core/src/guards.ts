import { type Rail, isUsdc, railFromAddress, isSolanaAddress, isEvmAddress } from "./chains.js";
import { formatUsd, toAtomic } from "./money.js";
import type { Product } from "./product.js";
import type { Quote, QuoteErrorCode, QuoteOption } from "./quote.js";

// Every reason Tender refuses to hand PayBox a payment proposal. A checkout
// only proceeds when the list is empty; anything unknown counts against it.

export type BlockerCode =
  | QuoteErrorCode
  | "BUDGET_REQUIRED"
  | "OVER_BUDGET"
  | "AMOUNT_REQUIRED"
  | "AMOUNT_NOT_ADJUSTABLE"
  | "RAIL_UNAVAILABLE"
  | "UNSUPPORTED_ASSET"
  | "INSUFFICIENT_FUNDS"
  | "MERCHANT_UNVERIFIED"
  | "ACCESS_GATED"
  | "INVALID_PAY_TO";

export type WarningCode = "BALANCE_UNVERIFIED" | "MERCHANT_UNVERIFIED" | "FEES_INCLUDED" | "NOT_USDC_PRICED" | "SINGLE_USE";

export interface Finding<C extends string> {
  code: C;
  message: string;
  fix?: string;
}

export interface Policy {
  maxUsd?: string;
  rail?: Rail;
  requireVerifiedMerchant?: boolean;
}

export interface CheckoutInput {
  product: Product | null;
  quote: Quote;
  payer: string;
  policy: Policy;
  requestedAmountUsd?: string;
  balanceAtomic?: string | null;
}

export type Decision =
  | { ok: true; option: QuoteOption; amountAtomic: string; amountUsd: string; warnings: Finding<WarningCode>[] }
  | { ok: false; blockers: Finding<BlockerCode>[]; warnings: Finding<WarningCode>[]; option: QuoteOption | null };

// Upstream error text is never echoed to the agent; each code has a fixed message.
const QUOTE_MESSAGES: Record<QuoteErrorCode, string> = {
  LINK_NOT_FOUND: "MoonPay Commerce has no pay link with this id.",
  LINK_INACTIVE: "The pay link is disabled, deleted or inactive.",
  MERCHANT_DISABLED: "The merchant's MoonPay Commerce account is disabled.",
  REQUIRES_CUSTOMER_DETAILS: "The pay link requires customer details, which agent payments cannot provide.",
  NETWORK_FEES_TOO_HIGH: "Network fees currently exceed the merchant's fee margin on every chain offered.",
  AMOUNT_TOO_SMALL: "The network fee is larger than the price.",
  INVALID_AMOUNT: "MoonPay Commerce rejected the amount.",
  INVALID_PAYER: "MoonPay Commerce rejected the payer address.",
  SANCTIONED: "MoonPay Commerce restricts this checkout.",
  PAYER_MISMATCH: "The paying wallet does not match the one this checkout was prepared for.",
  SETTLEMENT_IN_PROGRESS: "A payment for this checkout is already settling.",
  RATE_LIMITED: "MoonPay Commerce is rate limiting checkout requests.",
  UNSUPPORTED_CHECKOUT: "This kind of checkout is not payable by agents.",
  UPSTREAM_ERROR: "MoonPay Commerce returned an unexpected answer.",
  UPSTREAM_UNAVAILABLE: "MoonPay Commerce did not answer in time.",
};

const QUOTE_FIXES: Partial<Record<QuoteErrorCode, string>> = {
  LINK_NOT_FOUND: "Check the link with the merchant; the id does not exist on MoonPay Commerce.",
  LINK_INACTIVE: "The merchant has to re-enable this pay link.",
  MERCHANT_DISABLED: "This merchant account cannot take payments right now.",
  REQUIRES_CUSTOMER_DETAILS: "Ask the merchant for a pay link without required customer fields, or pay in a browser.",
  NETWORK_FEES_TOO_HIGH: "Network fees exceed the merchant's fee margin. Try again in a few minutes or a larger amount.",
  AMOUNT_TOO_SMALL: "Raise the amount; the network fee is larger than the price.",
  RATE_LIMITED: "Wait a minute before asking MoonPay Commerce again.",
  SETTLEMENT_IN_PROGRESS: "A payment for this checkout is already settling. Do not pay again; check its status.",
  UPSTREAM_UNAVAILABLE: "MoonPay Commerce did not answer. Retry explicitly later.",
};

export function preflight(product: Product | null, requestedAmountUsd: string | undefined, policy: Policy): Finding<BlockerCode>[] {
  const blockers: Finding<BlockerCode>[] = [];
  if (!policy.maxUsd) {
    blockers.push({ code: "BUDGET_REQUIRED", message: "Tender never proposes a payment without a spending cap.", fix: "Pass max_usd, the most the user agreed to pay." });
  }
  if (!product) {
    if (policy.requireVerifiedMerchant) {
      blockers.push({ code: "MERCHANT_UNVERIFIED", message: "The merchant behind this checkout cannot be looked up, so it cannot be shown to be verified." });
    }
    return blockers;
  }
  if (product.pricing.mode === "dynamic" && !requestedAmountUsd) {
    blockers.push({ code: "AMOUNT_REQUIRED", message: "This pay link lets the payer choose the amount.", fix: "Pass amount_usd." });
  }
  if (product.pricing.mode === "fixed" && requestedAmountUsd) {
    blockers.push({ code: "AMOUNT_NOT_ADJUSTABLE", message: "This pay link has a fixed price; amount_usd cannot change it.", fix: "Omit amount_usd." });
  }
  if (product.requiredFields.length > 0) {
    blockers.push({
      code: "REQUIRES_CUSTOMER_DETAILS",
      message: `The merchant requires ${product.requiredFields.join(", ")} at checkout, which agent payments cannot provide.`,
      fix: QUOTE_FIXES.REQUIRES_CUSTOMER_DETAILS,
    });
  }
  if (product.gates.length > 0) {
    blockers.push({ code: "ACCESS_GATED", message: `Checkout is gated by ${product.gates.join(", ")}.` });
  }
  if (!product.active) {
    blockers.push({ code: "LINK_INACTIVE", message: `This pay link is ${product.inactiveReason}.`, fix: QUOTE_FIXES.LINK_INACTIVE });
  }
  if (policy.requireVerifiedMerchant && !product.merchant.verified) {
    blockers.push({ code: "MERCHANT_UNVERIFIED", message: "The merchant is not a verified MoonPay Commerce merchant." });
  }
  return blockers;
}

function payToValid(option: QuoteOption): boolean {
  return option.rail === "solana" ? isSolanaAddress(option.payTo) : isEvmAddress(option.payTo);
}

export function evaluateCheckout(input: CheckoutInput): Decision {
  const { product, quote, payer, policy } = input;
  const blockers = preflight(product, input.requestedAmountUsd, policy);
  const warnings: Finding<WarningCode>[] = [];
  const add = (finding: Finding<BlockerCode>) => {
    if (!blockers.some((b) => b.code === finding.code)) blockers.push(finding);
  };

  if (!quote.ok) {
    add({ code: quote.code, message: QUOTE_MESSAGES[quote.code], fix: QUOTE_FIXES[quote.code] });
    return { ok: false, blockers, warnings, option: null };
  }

  const payerRail = railFromAddress(payer);
  const rail = policy.rail ?? payerRail ?? undefined;
  const option = quote.options.find((o) => o.rail === rail) ?? null;
  if (!option) {
    const offered = quote.options.map((o) => o.rail);
    add({
      code: "RAIL_UNAVAILABLE",
      message: offered.length
        ? `The merchant takes ${offered.join(" or ")} USDC here, not ${rail ?? "this wallet's chain"}.`
        : `The merchant offers no rail PayBox can pay (${quote.otherNetworks.map((n) => n.network).join(", ") || "none"}).`,
      fix: offered.length ? `Use a ${offered[0]} wallet as payer_address.` : undefined,
    });
    return { ok: false, blockers, warnings, option: null };
  }
  if (payerRail !== option.rail) {
    add({ code: "INVALID_PAYER", message: `payer_address is not a ${option.rail} address.` });
  }
  if (!isUsdc(option.rail, option.asset)) {
    add({ code: "UNSUPPORTED_ASSET", message: `Checkout asks for ${option.asset}; PayBox pays USDC only.` });
  }
  if (!payToValid(option)) {
    add({ code: "INVALID_PAY_TO", message: "The payment challenge names an invalid recipient address." });
  }

  let cap: string | null = null;
  try {
    cap = policy.maxUsd ? toAtomic(policy.maxUsd, 6) : null;
  } catch {
    add({ code: "BUDGET_REQUIRED", message: `max_usd "${policy.maxUsd}" is not a plain decimal.` });
  }
  if (cap !== null && BigInt(option.amount) > BigInt(cap)) {
    add({
      code: "OVER_BUDGET",
      message: `Checkout costs ${formatUsd(option.amount)} including fees; the cap is ${formatUsd(cap)}.`,
      fix: "Ask the user to raise max_usd or pick something cheaper.",
    });
  }

  if (input.balanceAtomic === null || input.balanceAtomic === undefined) {
    warnings.push({ code: "BALANCE_UNVERIFIED", message: "Could not read the payer's USDC balance; PayBox will check it before signing." });
  } else if (BigInt(input.balanceAtomic) < BigInt(option.amount)) {
    add({
      code: "INSUFFICIENT_FUNDS",
      message: `The payer holds ${formatUsd(input.balanceAtomic)} USDC on ${option.rail}; checkout needs ${formatUsd(option.amount)}.`,
      fix: "Top up with PayBox get_buy_link, or swap into USDC on this chain.",
    });
  }

  if (product) {
    if (!product.merchant.verified && !policy.requireVerifiedMerchant) {
      warnings.push({ code: "MERCHANT_UNVERIFIED", message: "The merchant has not completed MoonPay Commerce verification." });
    }
    if (!product.usdcPriced) {
      warnings.push({ code: "NOT_USDC_PRICED", message: `Priced in ${product.pricing.currency.symbol}; the quote converts it to USDC at today's rate.` });
    }
    if (product.pricing.mode === "fixed" && product.usdcPriced && BigInt(option.amount) > BigInt(product.pricing.amount)) {
      const fee = BigInt(option.amount) - BigInt(product.pricing.amount);
      warnings.push({ code: "FEES_INCLUDED", message: `Total includes ${formatUsd(fee.toString())} of network and processing fees.` });
    }
    if (product.maxTransactions === 1) {
      warnings.push({ code: "SINGLE_USE", message: "This pay link accepts a single payment." });
    }
  }

  if (blockers.length > 0) return { ok: false, blockers, warnings, option };
  return { ok: true, option, amountAtomic: option.amount, amountUsd: formatUsd(option.amount), warnings };
}
