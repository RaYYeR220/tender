# Tender

**Any MoonPay Commerce checkout, paid by your agent.**

Tender is a [PayBox](https://paybox.sh) plugin. It lets an AI agent buy from any [MoonPay Commerce](https://moonpay.hel.io) merchant in USDC on Solana or Base, using the x402 checkout every MoonPay Commerce pay link already exposes. Before PayBox is ever asked to approve anything, Tender re-reads the live price and refuses the payment when it is over the user's cap, the wallet can't cover it, or the checkout needs something an agent can't give. After the payment, it rebuilds the receipt from chain data: payer → deposit wallet → merchant, every unit accounted for.

- Live site and registry: https://tender-checkout.vercel.app
- A real purchase an agent made through PayBox with Tender: [receipt](https://tender-checkout.vercel.app/r/solana/3d4KqBCBXb8aWiwJRakGDuiX47VT7eFWcLB1HkTi6U94Qka4P6cvD2zN99ZCKspQxkFG45eDfRRdTBFdWMjNrFL9?payer=7VA3n2q4rxv9rKrVEWJPdoa5pSAS8xku5ECnP6VbbCts&link=6ad323565c71e316b383ea8a) · [Solscan](https://solscan.io/tx/3d4KqBCBXb8aWiwJRakGDuiX47VT7eFWcLB1HkTi6U94Qka4P6cvD2zN99ZCKspQxkFG45eDfRRdTBFdWMjNrFL9)
- Demo video (2:31): [on X](https://x.com/BazydloMis57623/status/2111551638422905209)
- Reviewing? Start with [JUDGES.md](JUDGES.md). Every claim and its evidence: [CLAIMS.md](CLAIMS.md) · [PROOF.md](PROOF.md)
- Plugin source: [`plugin/`](plugin) · shared checkout core: [`packages/core/`](packages/core) · site: [`web/`](web)

## Why

MoonPay Commerce merchants can already be paid by agents over x402, but an agent has no way to find them, no way to know a link will reject it (pay links that require an email do), and no proof afterwards that the merchant was actually paid. PayBox already holds the user's wallet and the approval step. Tender is the missing piece between the two: a checkout an agent can run safely, and a receipt anyone can check.

## How it works

```
agent ──use_plugin──▶ Tender (PayBox sandbox)
                        ├─ api.hel.io            pay link metadata + live x402 quote
                        ├─ Solana / Base RPC     payer's USDC balance, receipts
                        └─ tender-checkout…      open merchant registry
                      ◀── x402 proposal (USDC, Solana or Base)
PayBox ── user approves ──▶ pays MoonPay Commerce ──▶ deposit wallet ──sweep──▶ merchant
```

1. **Resolve.** Any pay link URL or id becomes a product card: name, merchant, verification status, price, rails, required fields. Merchant-supplied text is cleaned and quoted, never mixed into Tender's own wording.
2. **Guard.** `checkout` fetches the live 402 challenge and the payer's on-chain USDC balance in parallel, then refuses with no proposal on any of these:

   | Code | Meaning |
   |---|---|
   | `BUDGET_REQUIRED` | No spending cap given; Tender never proposes without one |
   | `OVER_BUDGET` | Live total is above `max_usd`, even by one atomic unit |
   | `INSUFFICIENT_FUNDS` | Payer's USDC on that chain is below the total |
   | `REQUIRES_CUSTOMER_DETAILS` | The link demands email, name, address… (MoonPay Commerce rejects these for agents) |
   | `AMOUNT_REQUIRED` / `AMOUNT_NOT_ADJUSTABLE` | Pay-what-you-want without an amount, or a fixed price with one |
   | `RAIL_UNAVAILABLE` / `INVALID_PAYER` | The payer's chain isn't offered, or the address doesn't match it |
   | `LINK_INACTIVE` / `MERCHANT_DISABLED` / `LINK_NOT_FOUND` | Dead link or account |
   | `NETWORK_FEES_TOO_HIGH` / `AMOUNT_TOO_SMALL` | MoonPay Commerce's fee circuit breaker |
   | `UNSUPPORTED_ASSET` / `INVALID_PAY_TO` | The challenge asks for something other than USDC, or names a malformed recipient |
   | `MERCHANT_UNVERIFIED` | Only when the caller sets `require_verified_merchant` |

3. **Settle.** Otherwise Tender returns an `io.paybox/transactionProposal` of kind `x402` for the exact quoted amount. PayBox shows it, the user approves, PayBox pays and retries the request, and MoonPay Commerce confirms the order.
4. **Verify.** PayBox completes x402 payments through a gateway and gives the agent no transaction signature, so `verify_purchase` finds the payment itself from the pay link and the payer. It then checks, from chain data alone: the USDC left the payer's own token account; it landed in the deposit wallet MoonPay Commerce assigns *this payer* for *this pay link*; the sweep reached the payout wallet listed on the pay link; and merchant share plus fees equal the payment exactly. Anyone can open the same receipt at `/r/<chain>/<tx>`.

## Tools

| Tool | Does | Moves money |
|---|---|---|
| `find_merchants` | Searches the open registry of agent-payable merchants | No |
| `inspect_checkout` | Dry run: product, live quote, balance, and every reason it would be refused | No |
| `checkout` | Fail-closed x402 payment proposal; PayBox asks the user to approve | Proposes |
| `list_catalog` | The store this install represents (merchant mode) | No |
| `verify_purchase` | On-chain receipt with hop-by-hop checks; finds the payment from the pay link if no signature is given | No |

## For merchants

- **Check a pay link** at https://tender-checkout.vercel.app/check — it runs the same checks a buying agent would and tells you what to change (most often: remove required customer fields from the agent link).
- **List it** by adding an entry to [`registry/merchants.json`](registry/merchants.json) in a pull request; the check page generates the entry for you. Every listing is re-validated live when an agent uses it.
- **Your own storefront in PayBox:** upload this plugin as your own project and set `TENDER_CATALOG` (comma-separated pay link ids) and `TENDER_STORE_NAME` in the portal's variables. No code changes.

## Run it

Requirements: Node.js 24, pnpm 11.11.0 for the plugin (the PayBox starter toolchain), npm for the rest. On Windows the plugin checks run in Docker.

```bash
# core library and tests (45)
cd packages/core && npm ci && npm test

# plugin: type-check, reproducible build, PayBox conformance
./run-plugin-test.sh            # or: cd plugin && pnpm install --frozen-lockfile && pnpm test

# call a tool on the built bundle the way PayBox does
node scripts/call.mjs inspect_checkout '{"link":"https://moonpay.hel.io/pay/<id>","payer_address":"<wallet>","amount_usd":"0.25"}'

# live guard scorecard against MoonPay Commerce (spaced for its rate limit)
node scripts/eval.mjs

# site
cd web && npm ci && npm run dev
```

### PayBox portal configuration

| Setting | Value |
|---|---|
| Network hosts | `api.hel.io`, `api.mainnet-beta.solana.com`, `mainnet.base.org`, `tender-checkout.vercel.app` |
| `TENDER_SITE_URL` (optional) | Base URL for the registry and receipt links |
| `TENDER_CATALOG`, `TENDER_STORE_NAME` (optional) | Merchant mode |

No secrets are needed for buying. Nothing sensitive is ever bundled.

## Honest limits

- MoonPay Commerce rejects agent payments for pay links with required customer fields; Tender detects and explains this but cannot work around it.
- Network fees put a floor of roughly $0.10 under a payment; smaller amounts are refused by MoonPay Commerce's circuit breaker.
- MoonPay Commerce's x402 endpoints allow ten requests a minute per IP. Tender asks for a quote only when metadata hasn't already ruled the checkout out.
- PayBox pays x402 on Solana and Base, so merchants who only take USDC on other chains show up as `RAIL_UNAVAILABLE`.
- Charge links (single-use browser checkouts, MoonPay Commerce's invoices) are reported as unsupported: its x402 endpoint does not accept them, and paying one would need a deposit-style Solana transfer that Tender does not build yet.
- MoonPay Commerce sweeps a deposit wallet to the merchant only once it holds at least $3 (its documented `minSweepAmountUsd` minimum). Smaller payments wait in the deposit wallet, and the receipt says so with the current balance; Tender never reports a hop it cannot see. One sweep can carry several payments, and the receipt reconciles it against everything the deposit wallet held.
- The balance check uses public RPC; if it can't be read, Tender warns and PayBox still checks funds before signing.

## License

MIT
