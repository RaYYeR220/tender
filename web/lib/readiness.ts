import {
  TenderError,
  checkoutUrl,
  formatUsd,
  getPaylink,
  getQuote,
  hostedUrl,
  parseCheckoutRef,
  type Product,
  type Quote,
} from "@tender/core";

// Deterministic, otherwise unused addresses. The readiness scan asks for a live
// quote as this payer, so MoonPay Commerce allocates its deposit wallet here
// instead of to a real buyer.
const PROBE_PAYER = "CEzXSgoWqcBD3KUDex6gENx3XEVaqZEShgjbhx8Hc1u3";
const PROBE_AMOUNT = "1000000";

export const REPO = "https://github.com/RaYYeR220/tender";

export type CheckState = "ok" | "fail" | "warn";

export interface ReadinessCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  fix?: string;
}

export interface Readiness {
  link: string;
  agentReady: boolean;
  product: Product | null;
  quote: { rail: string; amountUsd: string; feeUsd: string | null }[];
  checks: ReadinessCheck[];
  entry: Record<string, unknown> | null;
}

export async function scan(input: string): Promise<Readiness> {
  const checks: ReadinessCheck[] = [];
  let ref;
  try {
    ref = parseCheckoutRef(input);
  } catch (error) {
    return fail(input, "reference", "Pay link", error instanceof TenderError ? error.message : "Not a MoonPay Commerce link.");
  }
  if (ref.kind !== "paylink") {
    return fail(input, "reference", "Pay link", "Only reusable pay links can be listed. Charges are single-use and deposits need a customer.");
  }

  let product: Product;
  try {
    product = await getPaylink(ref.id);
  } catch (error) {
    return fail(input, "resolves", "Pay link resolves", error instanceof TenderError ? error.message : "MoonPay Commerce did not answer.");
  }
  checks.push({ id: "resolves", label: "Pay link resolves", state: "ok", detail: `${product.name} by ${product.merchant.name}` });
  checks.push(
    product.active
      ? { id: "active", label: "Link is live", state: "ok", detail: "Enabled and accepting payments." }
      : { id: "active", label: "Link is live", state: "fail", detail: `The link is ${product.inactiveReason}.`, fix: "Re-enable it in the MoonPay Commerce dashboard." },
  );
  checks.push(
    product.requiredFields.length === 0
      ? { id: "fields", label: "No customer fields", state: "ok", detail: "Agents can pay without filling a form." }
      : {
          id: "fields",
          label: "No customer fields",
          state: "fail",
          detail: `Requires ${product.requiredFields.join(", ")}. MoonPay Commerce rejects agent payments for these links.`,
          fix: "Duplicate the link without required customer details for agent buyers.",
        },
  );
  if (product.gates.length) {
    checks.push({ id: "gates", label: "No access gate", state: "fail", detail: `Gated by ${product.gates.join(", ")}.`, fix: "Remove the gate for the agent link." });
  }
  checks.push(
    product.rails.length
      ? { id: "rail", label: "USDC on Solana or Base", state: "ok", detail: `Receives USDC on ${product.rails.join(" and ")}.` }
      : { id: "rail", label: "USDC on Solana or Base", state: "fail", detail: "No USDC recipient on a chain PayBox pays on.", fix: "Add a USDC payout wallet on Solana or Base." },
  );

  const quote: Quote = await getQuote(checkoutUrl(ref, PROBE_PAYER, product.pricing.mode === "dynamic" ? PROBE_AMOUNT : undefined));
  const quotes: Readiness["quote"] = [];
  if (quote.ok && quote.options.length) {
    for (const option of quote.options) {
      const fee =
        product.pricing.mode === "fixed" && product.usdcPriced && BigInt(option.amount) >= BigInt(product.pricing.amount)
          ? formatUsd((BigInt(option.amount) - BigInt(product.pricing.amount)).toString())
          : null;
      quotes.push({ rail: option.rail, amountUsd: formatUsd(option.amount), feeUsd: fee });
    }
    checks.push({
      id: "x402",
      label: "Live x402 quote",
      state: "ok",
      detail: quotes.map((q) => `${q.amountUsd} on ${q.rail}${q.feeUsd ? ` (${q.feeUsd} fees)` : ""}`).join(" · "),
    });
  } else {
    checks.push({
      id: "x402",
      label: "Live x402 quote",
      state: "fail",
      detail: quote.ok ? "The challenge offers no Solana or Base USDC option." : quote.message,
      fix: quote.ok ? undefined : quote.code === "NETWORK_FEES_TOO_HIGH" ? "Fees spike briefly; retry in a few minutes." : undefined,
    });
  }
  checks.push(
    product.merchant.verified
      ? { id: "verified", label: "Verified merchant", state: "ok", detail: "MoonPay Commerce verification complete." }
      : { id: "verified", label: "Verified merchant", state: "warn", detail: "Not verified. Strict buyers can refuse unverified merchants.", fix: "Complete verification in MoonPay Commerce." },
  );

  const agentReady = checks.every((c) => c.state !== "fail");
  return {
    link: hostedUrl(ref),
    agentReady,
    product,
    quote: quotes,
    checks,
    entry: agentReady
      ? {
          id: product.id,
          title: product.name,
          merchant: product.merchant.name,
          category: "other",
          summary: product.description.slice(0, 200) || product.name,
          pricing: product.pricing.mode === "fixed" && product.usdcPriced ? formatUsd(product.pricing.amount) : product.pricing.mode === "dynamic" ? "pay what you want" : "priced in " + product.pricing.currency.symbol,
          rails: product.rails,
          tags: [],
          added: new Date().toISOString().slice(0, 10),
        }
      : null,
  };
}

function fail(link: string, id: string, label: string, detail: string): Readiness {
  return { link, agentReady: false, product: null, quote: [], checks: [{ id, label, state: "fail", detail }], entry: null };
}
