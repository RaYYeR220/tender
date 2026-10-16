import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCheckout } from "../src/guards.js";
import type { Quote } from "../src/quote.js";
import { IDS, PAYER_EVM, PAYER_SOL, product, quote402, quoteWith } from "./helpers.js";

const codes = (d: ReturnType<typeof evaluateCheckout>) => (d.ok ? [] : d.blockers.map((b) => b.code).sort());

test("happy path: dynamic tip within budget and funded", () => {
  const d = evaluateCheckout({
    product: product(IDS.tipJar),
    quote: quoteWith([{ rail: "solana", amount: "250000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "1" },
    requestedAmountUsd: "0.25",
    balanceAtomic: "1255776",
  });
  assert.ok(d.ok, JSON.stringify(d));
  assert.equal(d.amountUsd, "$0.25");
  assert.equal(d.option.rail, "solana");
  assert.ok(d.warnings.some((w) => w.code === "MERCHANT_UNVERIFIED"));
});

test("no spending cap, no proposal", () => {
  const d = evaluateCheckout({ product: product(IDS.tipJar), quote: quote402(), payer: PAYER_SOL, policy: {}, requestedAmountUsd: "1", balanceAtomic: "5000000" });
  assert.deepEqual(codes(d), ["BUDGET_REQUIRED"]);
});

test("over the cap by a single atomic unit is refused", () => {
  const d = evaluateCheckout({
    product: product(IDS.tipJar),
    quote: quoteWith([{ rail: "solana", amount: "1000001" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "1.00" },
    requestedAmountUsd: "1",
    balanceAtomic: "9000000",
  });
  assert.deepEqual(codes(d), ["OVER_BUDGET"]);
});

test("exactly at the cap is allowed", () => {
  const d = evaluateCheckout({
    product: product(IDS.tipJar),
    quote: quoteWith([{ rail: "solana", amount: "1000000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "1" },
    requestedAmountUsd: "1",
    balanceAtomic: "1000000",
  });
  assert.ok(d.ok);
});

test("required customer fields are caught before any request", () => {
  const notFound: Quote = { ok: false, url: "u", status: 400, code: "REQUIRES_CUSTOMER_DETAILS", message: "x402 payments not supported" };
  const d = evaluateCheckout({ product: product(IDS.registration), quote: notFound, payer: PAYER_SOL, policy: { maxUsd: "100" } });
  assert.deepEqual(codes(d), ["REQUIRES_CUSTOMER_DETAILS"]);
  assert.match(d.ok ? "" : d.blockers[0]!.message, /email/);
});

test("dynamic link without an amount, fixed link with one", () => {
  const dyn = evaluateCheckout({ product: product(IDS.tipJar), quote: quote402(), payer: PAYER_SOL, policy: { maxUsd: "5" }, balanceAtomic: "9000000" });
  assert.ok(codes(dyn).includes("AMOUNT_REQUIRED"));
  const fixed = evaluateCheckout({
    product: product(IDS.sponsor),
    quote: quoteWith([{ rail: "solana", amount: "1010000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "5" },
    requestedAmountUsd: "2",
    balanceAtomic: "9000000",
  });
  assert.deepEqual(codes(fixed), ["AMOUNT_NOT_ADJUSTABLE"]);
});

test("fixed price shows the fee the quote adds", () => {
  const d = evaluateCheckout({
    product: product(IDS.sponsor),
    quote: quoteWith([{ rail: "solana", amount: "1010000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "2" },
    balanceAtomic: "9000000",
  });
  assert.ok(d.ok);
  const fee = d.warnings.find((w) => w.code === "FEES_INCLUDED");
  assert.match(fee?.message ?? "", /\$0\.01/);
});

test("unfunded wallet is refused with a top-up hint", () => {
  const d = evaluateCheckout({
    product: product(IDS.tipJar),
    quote: quoteWith([{ rail: "solana", amount: "500000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "1" },
    requestedAmountUsd: "0.5",
    balanceAtomic: "100000",
  });
  assert.deepEqual(codes(d), ["INSUFFICIENT_FUNDS"]);
  assert.match(d.ok ? "" : d.blockers[0]!.fix ?? "", /get_buy_link/);
});

test("unknown balance warns but does not block; PayBox checks before signing", () => {
  const d = evaluateCheckout({
    product: product(IDS.tipJar),
    quote: quoteWith([{ rail: "solana", amount: "500000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "1" },
    requestedAmountUsd: "0.5",
    balanceAtomic: null,
  });
  assert.ok(d.ok);
  assert.ok(d.warnings.some((w) => w.code === "BALANCE_UNVERIFIED"));
});

test("an EVM payer cannot pay a Solana-only checkout", () => {
  const d = evaluateCheckout({
    product: product(IDS.tipJar),
    quote: quoteWith([{ rail: "solana", amount: "500000" }]),
    payer: PAYER_EVM,
    policy: { maxUsd: "1" },
    requestedAmountUsd: "0.5",
  });
  assert.deepEqual(codes(d), ["RAIL_UNAVAILABLE"]);
});

test("the payer's chain picks the option when both rails are offered", () => {
  const q = quoteWith([
    { rail: "solana", amount: "500000" },
    { rail: "base", amount: "510000" },
  ]);
  const d = evaluateCheckout({ product: null, quote: q, payer: PAYER_EVM, policy: { maxUsd: "1" }, balanceAtomic: "600000" });
  assert.ok(d.ok);
  assert.equal(d.option.rail, "base");
  assert.equal(d.amountAtomic, "510000");
});

test("a policy rail that disagrees with the payer address is refused", () => {
  const q = quoteWith([
    { rail: "solana", amount: "500000" },
    { rail: "base", amount: "510000" },
  ]);
  const d = evaluateCheckout({ product: null, quote: q, payer: PAYER_SOL, policy: { maxUsd: "1", rail: "base" }, balanceAtomic: "600000" });
  assert.deepEqual(codes(d), ["INVALID_PAYER"]);
});

test("a challenge asking for another asset is refused", () => {
  const q = quoteWith([{ rail: "solana", amount: "500000" }]);
  if (q.ok) q.options[0]!.asset = "So11111111111111111111111111111111111111112";
  const d = evaluateCheckout({ product: null, quote: q, payer: PAYER_SOL, policy: { maxUsd: "1" }, balanceAtomic: "600000" });
  assert.deepEqual(codes(d), ["UNSUPPORTED_ASSET"]);
});

test("a malformed recipient in the challenge is refused", () => {
  const q = quoteWith([{ rail: "solana", amount: "500000" }]);
  if (q.ok) q.options[0]!.payTo = "not-an-address";
  const d = evaluateCheckout({ product: null, quote: q, payer: PAYER_SOL, policy: { maxUsd: "1" }, balanceAtomic: "600000" });
  assert.deepEqual(codes(d), ["INVALID_PAY_TO"]);
});

test("policy can demand a verified merchant", () => {
  const d = evaluateCheckout({
    product: product(IDS.tipJar),
    quote: quoteWith([{ rail: "solana", amount: "500000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "1", requireVerifiedMerchant: true },
    requestedAmountUsd: "0.5",
    balanceAtomic: "600000",
  });
  assert.deepEqual(codes(d), ["MERCHANT_UNVERIFIED"]);
});

test("a verified-merchant policy refuses checkouts whose merchant cannot be looked up", () => {
  const d = evaluateCheckout({
    product: null,
    quote: quoteWith([{ rail: "solana", amount: "500000" }]),
    payer: PAYER_SOL,
    policy: { maxUsd: "1", requireVerifiedMerchant: true },
    balanceAtomic: "600000",
  });
  assert.deepEqual(codes(d), ["MERCHANT_UNVERIFIED"]);
});

test("garbage max_usd fails closed", () => {
  const d = evaluateCheckout({ product: null, quote: quoteWith([{ rail: "solana", amount: "1" }]), payer: PAYER_SOL, policy: { maxUsd: "1e9" }, balanceAtomic: "5" });
  assert.deepEqual(codes(d), ["BUDGET_REQUIRED"]);
});

test("upstream outage blocks", () => {
  const down: Quote = { ok: false, url: "u", status: 0, code: "UPSTREAM_UNAVAILABLE", message: "timeout" };
  const d = evaluateCheckout({ product: null, quote: down, payer: PAYER_SOL, policy: { maxUsd: "1" } });
  assert.deepEqual(codes(d), ["UPSTREAM_UNAVAILABLE"]);
});
