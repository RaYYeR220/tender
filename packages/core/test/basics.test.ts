import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCheckoutRef, hostedUrl } from "../src/ref.js";
import { toAtomic, fromAtomic, formatUsd } from "../src/money.js";
import { isSolanaAddress, isEvmAddress, railFromAddress, isSolanaSignature, railFromNetwork } from "../src/chains.js";
import { checkoutUrl } from "../src/quote.js";
import { PAYER_EVM, PAYER_SOL } from "./helpers.js";

test("parses every shape a merchant hands out", () => {
  const id = "695cb05415de374626355640";
  for (const input of [
    id,
    id.toUpperCase(),
    `https://moonpay.hel.io/pay/${id}`,
    `https://app.hel.io/pay/${id}?ref=x`,
    `moonpay.hel.io/pay/${id}`,
    `https://api.hel.io/v1/x402/checkout/${id}?payerAddress=abc`,
    `https://api.hel.io/v1/paylink/${id}/public`,
  ]) {
    assert.deepEqual(parseCheckoutRef(input), { kind: "paylink", id }, input);
  }
  assert.deepEqual(parseCheckoutRef(`https://api.hel.io/v1/x402/deposit/${id}`), { kind: "deposit", id });
  assert.deepEqual(parseCheckoutRef("https://app.hel.io/charge/2ac13665-9cfe-4466-b294-05069d57b0a2"), {
    kind: "charge",
    token: "2ac13665-9cfe-4466-b294-05069d57b0a2",
  });
});

test("rejects anything that could steer a request elsewhere", () => {
  for (const input of [
    "",
    "hello",
    "https://evil.example/pay/695cb05415de374626355640",
    "http://moonpay.hel.io/pay/695cb05415de374626355640",
    "https://moonpay.hel.io/pay/../charge/api-key",
    "https://moonpay.hel.io/pay/695cb05415de37462635564",
    "https://moonpay.hel.io.evil.example/pay/695cb05415de374626355640",
    "695cb05415de374626355640/../../v1/charge",
    "https://moonpay.hel.io/charge/not-a-uuid",
  ]) {
    assert.throws(() => parseCheckoutRef(input), /INVALID_REFERENCE|not a MoonPay Commerce/, input);
  }
});

test("hosted URLs round-trip", () => {
  const ref = parseCheckoutRef("695cb05415de374626355640");
  assert.equal(hostedUrl(ref), "https://moonpay.hel.io/pay/695cb05415de374626355640");
  assert.deepEqual(parseCheckoutRef(hostedUrl(ref)), ref);
});

test("money is exact", () => {
  assert.equal(toAtomic("0.25", 6), "250000");
  assert.equal(toAtomic("$1", 6), "1000000");
  assert.equal(toAtomic("12.345678", 6), "12345678");
  assert.throws(() => toAtomic("0.1234567", 6));
  assert.throws(() => toAtomic("-1", 6));
  assert.throws(() => toAtomic("1e3", 6));
  assert.equal(fromAtomic("1250000", 6), "1.25");
  assert.equal(fromAtomic("5", 6), "0.000005");
  assert.equal(formatUsd("100000"), "$0.10");
  assert.equal(formatUsd("12345678"), "$12.345678");
});

test("addresses and signatures", () => {
  assert.ok(isSolanaAddress(PAYER_SOL));
  assert.ok(!isSolanaAddress("7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCt0"));
  assert.ok(isEvmAddress(PAYER_EVM));
  assert.equal(railFromAddress(PAYER_SOL), "solana");
  assert.equal(railFromAddress(PAYER_EVM), "base");
  assert.equal(railFromAddress("nope"), null);
  assert.equal(isSolanaSignature("0".repeat(88)), false);
  assert.equal(isSolanaSignature(PAYER_SOL), false);
  assert.equal(railFromNetwork("eip155:8453"), "base");
  assert.equal(railFromNetwork("eip155:1"), null);
});

test("checkout URLs carry the payer and the optional amount", () => {
  const url = checkoutUrl({ kind: "paylink", id: "695cb05415de374626355640" }, PAYER_SOL, "250000");
  assert.equal(url, `https://api.hel.io/v1/x402/checkout/695cb05415de374626355640?amount=250000&payerAddress=${PAYER_SOL}`);
  assert.equal(
    checkoutUrl({ kind: "deposit", id: "695cb05415de374626355640" }, PAYER_SOL),
    `https://api.hel.io/v1/x402/deposit/695cb05415de374626355640?payerAddress=${PAYER_SOL}`,
  );
});
