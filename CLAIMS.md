# Claims

Every public statement about Tender, tagged by how it can be checked.

- **VERIFIED-LIVE**: happened on mainnet or in the PayBox portal; a link proves it.
- **REPRODUCIBLE**: run the command and get the same result.
- **MODELED**: true by construction in code and tests, not yet exercised live.
- **NOT-CLAIMED**: we are explicitly not saying this.

## Payments

| Claim | Tier | Evidence |
|---|---|---|
| An agent bought from a verified MoonPay Commerce merchant through PayBox with Tender | VERIFIED-LIVE | [PROOF.md](PROOF.md) — payments `3d4KqBCB…` and `5QjdBq12…` |
| The order appears in the merchant's MoonPay Commerce dashboard as a successful payment | VERIFIED-LIVE | Transactions view of the Tender Coffee account (shown in the demo video) |
| The payment went to the deposit wallet MoonPay Commerce assigns this payer for this pay link | VERIFIED-LIVE | `DEPOSIT_BOUND` on both receipts |
| Tender's receipt follows the sweep to the merchant and reconciles every unit | VERIFIED-LIVE | Settled third-party receipt `euuEheoC…` (3.10 → 3.038 + 0.0558 + 0.0062) |
| Our own two payments have been swept to the merchant | NOT-CLAIMED | At the time of writing they sat in the deposit wallet; the receipts say *awaiting sweep* |
| Payments on Base | MODELED | Base quote, guards and receipt code paths with tests; our demo merchant takes Solana only, so no Base payment was made |

## Refusals

| Claim | Tier | Evidence |
|---|---|---|
| Tender refuses, with no proposal sent, when the total is over the cap, funds are short, the link needs customer details, the chain isn't offered, the link or merchant is inactive, or no cap is given | REPRODUCIBLE | `node scripts/eval.mjs` against live MoonPay Commerce; `packages/core/test/guards.test.ts` |
| Refusals reach the agent as structured codes through PayBox | VERIFIED-LIVE | `OVER_BUDGET` and `REQUIRES_CUSTOMER_DETAILS` returned via PayBox `use_plugin` and shown in the demo chat |
| Merchant-supplied text cannot pose as Tender's own wording | MODELED | `cleanText` and quoting in `product.ts` / `plugin.ts`; tests in `product-quote.test.ts` |

## Scorecard (last run)

`node scripts/eval.mjs`, 17 October 2026, against live MoonPay Commerce pay links (REPRODUCIBLE):

- **22 / 22** scenarios ended as expected.
- **0** proposals where a refusal was due.
- **17 / 17** refusals held: over the cap by one cent, cap far below price, more than the wallet holds, required customer fields, missing amount, amount on a fixed price, Base payer on a Solana-only checkout, rail forced against the payer, unverified merchant under a strict policy, amount below the network fee floor, unknown pay link, foreign host, path traversal, malformed payer, charge link, missing cap (schema), and a blocked dry run.
- The 4 scenarios that should succeed produced a proposal for the exact quoted amount (including exactly at the cap, and a verified merchant under a strict policy), and the dry run reported ready.
- In an earlier run one scenario hit a network timeout to MoonPay Commerce and came back as `UPSTREAM_UNAVAILABLE`: a refusal, not a payment. Tender fails closed when the merchant cannot be reached.

## Engineering

| Claim | Tier | Evidence |
|---|---|---|
| 45 core tests pass | REPRODUCIBLE | `cd packages/core && npm test` |
| The plugin passes PayBox's starter conformance with reproducible builds | REPRODUCIBLE | `./run-plugin-test.sh` |
| Hosted checks pass in the PayBox portal with five tools | VERIFIED-LIVE | Portal status at submission |
| No secrets in the bundle | REPRODUCIBLE | the plugin reads only `TENDER_SITE_URL`, `TENDER_CATALOG`, `TENDER_STORE_NAME` |

## Not claimed

- Invoices (MoonPay Commerce charges): its x402 endpoint does not accept them; paying a charge would need a deposit-style Solana transfer, which Tender does not build yet.
- Pay links with required customer fields: MoonPay Commerce rejects these for agent payments. Tender explains the refusal; it cannot work around it.
- That a passed check guarantees a merchant will fulfil an order. Tender proves where the money went, not what was delivered.
