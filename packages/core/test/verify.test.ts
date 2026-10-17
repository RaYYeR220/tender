import { test } from "node:test";
import assert from "node:assert/strict";
import { findPayment, verifyPayment } from "../src/verify.js";
import type { Product } from "../src/product.js";
import { fixture, IDS, product } from "./helpers.js";

// Recorded mainnet responses for a real MoonPay Commerce x402 payment and its sweep.
const recorded = fixture("solana-settlement.json") as { payment: unknown; history: unknown[]; sweep: unknown };
const PAYMENT = "euuEheoCaV2PiM2GKh3qTtfT1qokfn1NspddY6m6QhmmNsPi2J9itj12EXyXqCxtebgxLxPyUeqXyMs5dHwgC9y";
const SWEEP = "5cG3qCWiCrhCe2uq3tmKcSMeMfyU82b6GYHiubPDPB2n5sybktSTCnobLZojz8Guy1PS7yrd4CmPHtRankGVuvPP";
const PAYER = "6UphUVdkevZD59y4XX5yJ4gd2kWDLHWDXuY7weYTov3";
const MERCHANT = "6vZE4CVv3W2J4WP7BjyAJEAS8P3zAB8nqBdoWXhiutD5";

function chain(overrides: { history?: unknown[]; sweep?: unknown; depositBalance?: string } = {}): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
    let result: unknown = null;
    if (body.method === "getTransaction") result = body.params[0] === PAYMENT ? recorded.payment : body.params[0] === SWEEP ? (overrides.sweep ?? recorded.sweep) : null;
    if (body.method === "getSignaturesForAddress") result = overrides.history ?? recorded.history;
    if (body.method === "getTokenAccountsByOwner") result = { value: [{ pubkey: "DYdFdbFtq8TLQYjvwZnVEPrD1mXW73DhwjtpH5utmuNf" }] };
    if (body.method === "getTokenAccountBalance") result = { value: { amount: overrides.depositBalance ?? "500000" } };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function withPayout(address: string): Product {
  return { ...product(IDS.tipJar), payout: [{ rail: "solana", address }] };
}

const DEPOSIT = "E38JRTGNg2YcKR7NHQYL5ig3JZGc5QUBvYMVDCKJ3kQ2";
const bound = async () => DEPOSIT;

test("verifies payment, deposit binding, sweep and merchant share of a real settlement", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT), resolveDeposit: bound }, { fetch: chain() });
  assert.equal(r.status, "settled");
  assert.equal(r.payment.amountUsd, "$3.10");
  assert.equal(r.payment.to, "E38JRTGNg2YcKR7NHQYL5ig3JZGc5QUBvYMVDCKJ3kQ2");
  assert.equal(r.sweep?.tx, SWEEP);
  assert.equal(r.sweep?.merchant?.amount, "3038000");
  assert.deepEqual(r.sweep?.fees.map((f) => f.amount), ["55800", "6200"]);
  assert.ok(r.checks.every((c) => c.ok === true), JSON.stringify(r.checks));
  assert.ok(r.checks.some((c) => c.name === "DEPOSIT_BOUND"));
});

test("merchant paid but deposit binding unconfirmed is not called settled", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT), resolveDeposit: async () => null }, { fetch: chain() });
  assert.equal(r.status, "swept");
  assert.equal(r.checks.find((c) => c.name === "DEPOSIT_BOUND")?.ok, null);
});

test("a payment into someone else's deposit wallet fails the binding", async () => {
  const r = await verifyPayment(
    { tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT), resolveDeposit: async () => "2riiUj78ZtQtKbecrLFb6A4uznGAyWCBcXEh1e5Tto8s" },
    { fetch: chain() },
  );
  assert.equal(r.status, "unverified");
  assert.equal(r.checks.find((c) => c.name === "DEPOSIT_BOUND")?.ok, false);
});

test("a fixed price the payment does not cover fails", async () => {
  const p = withPayout(MERCHANT);
  const priced = { ...p, pricing: { mode: "fixed" as const, amount: "5000000", currency: p.pricing.currency }, usdcPriced: true };
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: priced, resolveDeposit: bound }, { fetch: chain() });
  assert.equal(r.status, "unverified");
  assert.equal(r.checks.find((c) => c.name === "COVERS_PRICE")?.ok, false);
});

test("without the pay link the sweep is shown but not attributed", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: null }, { fetch: chain() });
  assert.equal(r.status, "swept");
  assert.equal(r.checks.find((c) => c.name === "MERCHANT_PAID")?.ok, null);
});

test("a sweep to wallets the pay link does not list fails verification", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout("AuHfKsmAEyRtj9Wtdj2XQyB1L84tHTXifUq1QEsuxejC") }, { fetch: chain() });
  assert.equal(r.status, "unverified");
  assert.equal(r.checks.find((c) => c.name === "MERCHANT_PAID")?.ok, false);
});

test("a merchant paid out on another chain is reported as untraceable, not failed", async () => {
  const p = { ...product(IDS.tipJar), payout: [{ rail: "base" as const, address: "0x1111111111111111111111111111111111111111" }] };
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: p, resolveDeposit: bound }, { fetch: chain() });
  assert.equal(r.status, "swept");
  assert.equal(r.checks.find((c) => c.name === "MERCHANT_PAID")?.ok, null);
});

test("cross-chain leniency needs a confirmed deposit binding", async () => {
  const p = { ...product(IDS.tipJar), payout: [{ rail: "base" as const, address: "0x1111111111111111111111111111111111111111" }] };
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: p, resolveDeposit: async () => null }, { fetch: chain() });
  assert.equal(r.status, "unverified");
  assert.equal(r.checks.find((c) => c.name === "MERCHANT_PAID")?.ok, false);
});

test("before the sweep lands the receipt says so instead of guessing", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT) }, { fetch: chain({ history: [] }) });
  assert.equal(r.status, "awaiting_sweep");
  assert.equal(r.sweep, null);
  assert.equal(r.checks.find((c) => c.name === "MERCHANT_PAID")?.ok, null);
});

test("a transaction that is not from the payer is rejected", async () => {
  await assert.rejects(
    verifyPayment({ tx: PAYMENT, payer: "7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts", product: null }, { fetch: chain() }),
    /NOT_A_PAYMENT|no USDC/,
  );
});

test("garbage transaction ids never reach the network", async () => {
  await assert.rejects(verifyPayment({ tx: "hello", payer: PAYER, product: null }, { fetch: chain() }), /INVALID_TX|Solana signature/);
});

test("finds the payment from the payer's deposit wallet when PayBox gives no signature", async () => {
  const found = await findPayment({ rail: "solana", payer: PAYER, deposit: DEPOSIT }, { fetch: chain() });
  assert.equal(found, PAYMENT);
});

test("finds nothing for a payer who never paid into that deposit wallet", async () => {
  const found = await findPayment({ rail: "solana", payer: "7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts", deposit: DEPOSIT }, { fetch: chain() });
  assert.equal(found, null);
});

test("a payment below MoonPay Commerce's sweep minimum says so", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT), resolveDeposit: bound }, { fetch: chain({ history: [] }) });
  assert.equal(r.status, "awaiting_sweep");
  assert.equal(r.depositBalance, "500000");
  assert.match(r.checks.find((c) => c.name === "MERCHANT_PAID")?.detail ?? "", /\$0\.50, below MoonPay Commerce's \$3\.00 minimum sweep/);
});

test("the real sweep carried exactly what the deposit wallet held", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT), resolveDeposit: bound }, { fetch: chain() });
  assert.equal(r.sweep?.held, "3100000");
});

test("a sweep that pays out less than the deposit wallet held does not reconcile", async () => {
  const sweep = structuredClone(recorded.sweep) as { meta: { preTokenBalances: { uiTokenAmount: { amount: string }; mint: string; owner?: string }[] } };
  for (const b of sweep.meta.preTokenBalances) if (b.owner === DEPOSIT) b.uiTokenAmount.amount = "6200000";
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT), resolveDeposit: bound }, { fetch: chain({ sweep }) });
  assert.equal(r.status, "unverified");
  assert.equal(r.checks.find((c) => c.name === "AMOUNTS_RECONCILE")?.ok, false);
});
