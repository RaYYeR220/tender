# Proof

Everything below can be checked from public data. Times are UTC, 17 October 2026.

## Real purchases through PayBox

An agent in a PayBox-connected chat used the Tender plugin to buy a flat white ($0.25) from the Tender Coffee demo counter, a verified MoonPay Commerce merchant. The user's PayBox wallet signed; MoonPay Commerce confirmed the order.

| Payment | When | Amount | Explorer | Receipt |
|---|---|---|---|---|
| `3d4KqBCB…NrFL9` | 08:23 | 0.25 USDC | [Solscan](https://solscan.io/tx/3d4KqBCBXb8aWiwJRakGDuiX47VT7eFWcLB1HkTi6U94Qka4P6cvD2zN99ZCKspQxkFG45eDfRRdTBFdWMjNrFL9) | [/r](https://tender-checkout.vercel.app/r/solana/3d4KqBCBXb8aWiwJRakGDuiX47VT7eFWcLB1HkTi6U94Qka4P6cvD2zN99ZCKspQxkFG45eDfRRdTBFdWMjNrFL9?payer=7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts&link=6ad323565c71e316b383ea8a) |
| `5QjdBq12…FmcKS5Vv` | 08:05 | 0.25 USDC | [Solscan](https://solscan.io/tx/5QjdBq12VFvhvV5p6Dsfbu5FXGs4euM1P9ehSYbyZcnprfWPceKT3JAfopH9GPLC2quAeuYdjnnSBXueFmcKS5Vv) | [/r](https://tender-checkout.vercel.app/r/solana/5QjdBq12VFvhvV5p6Dsfbu5FXGs4euM1P9ehSYbyZcnprfWPceKT3JAfopH9GPLC2quAeuYdjnnSBXueFmcKS5Vv?payer=7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts&link=6ad323565c71e316b383ea8a) |

- Payer (PayBox wallet): [`7VA3n2q4…P6VbbCts`](https://solscan.io/account/7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts)
- Deposit wallet MoonPay Commerce assigned this payer for the pay link: [`GM3wdPAL…u7Wo3te`](https://solscan.io/account/GM3wdPAL9aNVKWNsm9YbkGiKgj43q4NNHqXg2u7Wo3te). Tender re-derives it from the live 402 challenge and checks the payment landed there (`DEPOSIT_BOUND`).
- Merchant payout wallet listed on the pay link: [`2zTvurq5…6WDEQeQ`](https://solscan.io/account/2zTvurq5MgNL3ZV3kTVCJzhxUwhg8z2J7dQAY6WDEQeQ)
- Pay link: [moonpay.hel.io/pay/6ad323565c71e316b383ea8a](https://moonpay.hel.io/pay/6ad323565c71e316b383ea8a)

MoonPay Commerce sweeps a deposit wallet to the merchant only once it holds at least $3 (`minSweepAmountUsd`, documented minimum $3). These two payments put $0.50 in the deposit wallet, so their receipts read **awaiting sweep** and `MERCHANT_PAID` states the balance against that minimum. The receipt recomputes from chain on every load and will show the payout when it lands. Tender does not claim a hop it cannot see.

## A fully settled receipt

The same verifier on a third-party MoonPay Commerce x402 payment where the sweep has landed: 3.10 USDC in, then 3.038 to the merchant, 0.0558 and 0.0062 in fees, three seconds later. Every unit is accounted for.

- Payment: [`euuEheoC…dHwgC9y`](https://solscan.io/tx/euuEheoCaV2PiM2GKh3qTtfT1qokfn1NspddY6m6QhmmNsPi2J9itj12EXyXqCxtebgxLxPyUeqXyMs5dHwgC9y) · sweep: [`5cG3qCWi…RankGVuvPP`](https://solscan.io/tx/5cG3qCWiCrhCe2uq3tmKcSMeMfyU82b6GYHiubPDPB2n5sybktSTCnobLZojz8Guy1PS7yrd4CmPHtRankGVuvPP)
- Receipt: [/r](https://tender-checkout.vercel.app/r/solana/euuEheoCaV2PiM2GKh3qTtfT1qokfn1NspddY6m6QhmmNsPi2J9itj12EXyXqCxtebgxLxPyUeqXyMs5dHwgC9y?payer=6UphUVdkevZD59y4XX5yJ4gd2kWDLHWDXuY7weYTov3)
- The recorded responses are a test fixture: [`packages/core/test/fixtures/solana-settlement.json`](packages/core/test/fixtures/solana-settlement.json)

## Refusals through PayBox

In the same chat the agent was asked for two more purchases. Neither reached PayBox for signing:

- **Signed print, $5 cap**: `REQUIRES_CUSTOMER_DETAILS` — the pay link requires an email, which MoonPay Commerce rejects for agent payments.
- **Flat white, 10¢ cap**: `OVER_BUDGET` — live total $0.25 is above the cap.

## Live guard scorecard

`node scripts/eval.mjs` runs the built plugin against live MoonPay Commerce checkouts, 22 scenarios, spaced for MoonPay Commerce's rate limit. Last run: every refusal held and no proposal was produced where a refusal was due. See [CLAIMS.md](CLAIMS.md) for the exact counts and the one network timeout we saw.

## Tests and plugin checks

- `packages/core`: 45 tests (`npm test`), including recorded mainnet responses.
- `plugin`: PayBox starter v1.0.2 conformance — type-check, two reproducible builds with identical bytes, sample call (`./run-plugin-test.sh`).
- PayBox portal: hosted checks pass with 5 tools; the x402 proposal validated as "Payment challenge validated".
