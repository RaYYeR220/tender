import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPayment } from "../src/verify.js";
import type { Product } from "../src/product.js";
import { fixture, IDS, product } from "./helpers.js";

// Recorded mainnet responses for a real MoonPay Commerce x402 payment and its sweep.
const recorded = fixture("solana-settlement.json") as { payment: unknown; history: unknown[]; sweep: unknown };
const PAYMENT = "euuEheoCaV2PiM2GKh3qTtfT1qokfn1NspddY6m6QhmmNsPi2J9itj12EXyXqCxtebgxLxPyUeqXyMs5dHwgC9y";
const SWEEP = "5cG3qCWiCrhCe2uq3tmKcSMeMfyU82b6GYHiubPDPB2n5sybktSTCnobLZojz8Guy1PS7yrd4CmPHtRankGVuvPP";
const PAYER = "6UphUVdkevZD59y4XX5yJ4gd2kWDLHWDXuY7weYTov3";
const MERCHANT = "6vZE4CVv3W2J4WP7BjyAJEAS8P3zAB8nqBdoWXhiutD5";

function chain(overrides: { history?: unknown[]; sweep?: unknown } = {}): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
    let result: unknown = null;
    if (body.method === "getTransaction") result = body.params[0] === PAYMENT ? recorded.payment : body.params[0] === SWEEP ? (overrides.sweep ?? recorded.sweep) : null;
    if (body.method === "getSignaturesForAddress") result = overrides.history ?? recorded.history;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function withPayout(address: string): Product {
  return { ...product(IDS.tipJar), payout: [{ rail: "solana", address }] };
}

test("verifies payment, sweep and merchant share of a real settlement", async () => {
  const r = await verifyPayment({ tx: PAYMENT, payer: PAYER, product: withPayout(MERCHANT) }, { fetch: chain() });
  assert.equal(r.status, "settled");
  assert.equal(r.payment.amountUsd, "$3.10");
  assert.equal(r.payment.to, "E38JRTGNg2YcKR7NHQYL5ig3JZGc5QUBvYMVDCKJ3kQ2");
  assert.equal(r.sweep?.tx, SWEEP);
  assert.equal(r.sweep?.merchant?.amount, "3038000");
  assert.deepEqual(r.sweep?.fees.map((f) => f.amount), ["55800", "6200"]);
  assert.ok(r.checks.every((c) => c.ok === true), JSON.stringify(r.checks));
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
