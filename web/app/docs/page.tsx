import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Band } from "@/components/Band";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Arrow, Micro, St } from "@/components/print";
import { EXAMPLES, PAYBOX_PLUGINS_URL, RECEIPT_EXAMPLE, RECEIPT_EXAMPLE_PATH, REGISTRY_FILE_URL, REPO_URL, SITE_URL } from "@/lib/site";
import "./docs.css";

export const metadata: Metadata = {
  title: "Docs",
  description: "Install Tender in PayBox, the five tools, every refusal code, the receipt checks, the merchant kit, the public API and the honest limits.",
  alternates: { canonical: "/docs" },
};

const TOC: [string, string][] = [
  ["what", "What Tender is"],
  ["install", "Install in PayBox"],
  ["tools", "The five tools"],
  ["refusals", "Refusal codes"],
  ["receipts", "Receipt checks"],
  ["merchants", "Merchant kit"],
  ["api", "Public API"],
  ["limits", "Honest limits"],
];

type Tool = { name: string; does: string; money: string; inputs: [string, string, string][]; returns: ReactNode };

const TOOLS: Tool[] = [
  {
    name: "find_merchants",
    does: "Searches the open registry of MoonPay Commerce merchants whose checkouts accept agent payments in USDC.",
    money: "No",
    inputs: [
      ["query", "optional", "Words matched against merchant, product, category and tags. Omit to browse."],
      ["limit", "optional", "1–25 results, default 10."],
    ],
    returns: (
      <>
        <code>merchants[]</code> with <code>link</code>, <code>title</code>, <code>merchant</code>, <code>category</code>, <code>summary</code>,{" "}
        <code>pricing</code> and <code>rails</code>; the <code>registry</code> URL; a <code>notice</code> when the registry can&rsquo;t be read.
      </>
    ),
  },
  {
    name: "inspect_checkout",
    does: "Dry run: product, merchant and price, and with a payer the live quote, the payer's USDC balance and every reason checkout would be refused.",
    money: "No",
    inputs: [
      ["link", "required", "Pay link URL, deposit link or 24-character pay link id."],
      ["payer_address", "optional", "Solana or 0x Base address of the paying PayBox wallet."],
      ["amount_usd", "optional", "For pay-what-you-want links, e.g. \"0.25\"."],
      ["max_usd", "optional", "The most the user agreed to pay, fees included."],
    ],
    returns: (
      <>
        <code>status</code> (<code>ready</code> · <code>blocked</code> · <code>needs_payer</code>), <code>product</code>, <code>quote</code> (rail, amount,
        recipient), <code>balance_usd</code>, <code>blockers[]</code> and <code>warnings[]</code>.
      </>
    ),
  },
  {
    name: "checkout",
    does: "Fail-closed x402 payment proposal. Tender re-fetches the live quote and the payer's balance; one failed guard and nothing is sent.",
    money: "Proposes",
    inputs: [
      ["link", "required", "Pay link URL, deposit link or id."],
      ["payer_address", "required", "The PayBox wallet that will pay."],
      ["max_usd", "required", "Spending cap in US dollars, fees included."],
      ["amount_usd", "optional", "Only for pay-what-you-want links and deposits."],
      ["rail", "optional", "Force solana or base. Defaults to the payer address's chain."],
      ["require_verified_merchant", "optional", "Refuse merchants without MoonPay Commerce verification."],
    ],
    returns: (
      <>
        <code>status</code> (<code>proposed</code> · <code>refused</code>), <code>blockers[]</code>, <code>warnings[]</code>, the <code>order</code>, and an{" "}
        <code>io.paybox/transactionProposal</code> of kind <code>x402</code> for the exact quoted amount. PayBox asks the user to approve it.
      </>
    ),
  },
  {
    name: "list_catalog",
    does: "The products of the store this install represents (merchant mode), with live price, rails and whether each is payable by agents.",
    money: "No",
    inputs: [["—", "", "No inputs. The store is set by TENDER_CATALOG and TENDER_STORE_NAME."]],
    returns: (
      <>
        <code>store</code>, <code>notice</code>, and <code>products[]</code> with <code>link</code>, <code>name</code>, <code>pricing</code>,{" "}
        <code>rails</code>, <code>agent_payable</code> and a <code>note</code> on what blocks a product.
      </>
    ),
  },
  {
    name: "verify_purchase",
    does: "Builds the receipt from chain data alone: payer to deposit wallet to merchant, with hop-by-hop checks.",
    money: "No",
    inputs: [
      ["tx", "required", "The payment transaction: a Solana signature or a 0x Base hash."],
      ["payer_address", "required", "The wallet that paid."],
      ["link", "optional", "The pay link that was paid; needed to attribute the sweep to the merchant."],
    ],
    returns: (
      <>
        <code>status</code> (<code>settled</code> · <code>swept</code> · <code>awaiting_sweep</code> · <code>unverified</code> · <code>not_verifiable</code>),{" "}
        <code>payment</code>, <code>merchant_received</code>, <code>fees[]</code>, <code>checks[]</code> and a shareable <code>receipt_url</code>.
      </>
    ),
  },
];

const REFUSALS: [string, string][] = [
  ["BUDGET_REQUIRED", "No spending cap was given. Tender never proposes without one."],
  ["OVER_BUDGET", "The live total is above max_usd, even by one atomic unit."],
  ["INSUFFICIENT_FUNDS", "The payer's USDC on that chain is below the total."],
  ["REQUIRES_CUSTOMER_DETAILS", "The link demands an email, name, address or similar. MoonPay Commerce rejects these for agent payments."],
  ["AMOUNT_REQUIRED", "A pay-what-you-want link was called without an amount."],
  ["AMOUNT_NOT_ADJUSTABLE", "A fixed-price link was called with an amount."],
  ["RAIL_UNAVAILABLE", "The payer's chain isn't offered by this checkout."],
  ["INVALID_PAYER", "The payer address doesn't match the chain."],
  ["LINK_INACTIVE", "The pay link is disabled, deleted or inactive."],
  ["MERCHANT_DISABLED", "The merchant's MoonPay Commerce account is disabled."],
  ["LINK_NOT_FOUND", "MoonPay Commerce has no pay link with this id."],
  ["NETWORK_FEES_TOO_HIGH", "MoonPay Commerce's fee circuit breaker: network fees exceed the merchant's margin right now."],
  ["AMOUNT_TOO_SMALL", "The network fee is larger than the price."],
  ["UNSUPPORTED_ASSET", "The challenge asks for something other than USDC."],
  ["INVALID_PAY_TO", "The challenge names a malformed recipient."],
  ["MERCHANT_UNVERIFIED", "The merchant isn't verified, and the caller set require_verified_merchant."],
];

const CHECKS: [string, string, string][] = [
  ["PAYMENT_CONFIRMED", "Always", "The payment transaction is confirmed on Solana, or mined on Base, and didn't fail."],
  ["PAID_FROM_PAYER", "Always", "The USDC left the payer's own token account."],
  ["PAID_IN_USDC", "Always", "Both sides of the transfer are native USDC, not another token."],
  ["COVERS_PRICE", "With a fixed-price link", "The amount paid is at least the pay link's price."],
  ["DEPOSIT_BOUND", "With a link", "The receiving wallet is the deposit wallet MoonPay Commerce assigns this payer for this pay link."],
  ["MERCHANT_PAID", "Always", "The sweep reached the payout wallet listed on the pay link. Pending until the sweep lands, or without the link."],
  ["AMOUNTS_RECONCILE", "Once swept", "The merchant's share plus fees equal the payment exactly."],
];

const STATUSES: [string, "ok" | "pend" | "fail", string][] = [
  ["settled", "ok", "No check fails, the deposit wallet is bound to the pay link, and the merchant's payout wallet was paid."],
  ["swept", "pend", "The deposit wallet swept the money on, but the merchant or the binding can't be confirmed (usually: no pay link given)."],
  ["awaiting_sweep", "pend", "The payment is confirmed; MoonPay Commerce hasn't swept it yet. It usually does within about two minutes."],
  ["unverified", "fail", "At least one check failed. Not proof of payment."],
];

const LIMITS: string[] = [
  "MoonPay Commerce rejects agent payments for pay links with required customer fields. Tender detects and explains this but can't work around it.",
  "Network fees put a floor of roughly $0.10 under a payment; smaller amounts are refused by MoonPay Commerce's circuit breaker.",
  "MoonPay Commerce's x402 endpoints allow ten requests a minute per IP. Tender asks for a quote only when the pay link's metadata hasn't already ruled the checkout out.",
  "PayBox pays x402 on Solana and Base only, so merchants who take USDC only on other chains show up as RAIL_UNAVAILABLE.",
  "Charge links (single-use browser checkouts) are reported as unsupported.",
  "The balance check uses public RPC. If it can't be read, Tender warns, and PayBox still checks funds before signing.",
];

function Code({ children }: { children: string }) {
  return <pre className="codeblock" tabIndex={0}>{children}</pre>;
}

export default function DocsPage() {
  return (
    <>
      <SiteHeader current="docs" micro="TENDER · DOCUMENTATION · INSTALL · TOOLS · REFUSAL CODES · RECEIPT CHECKS · MERCHANT KIT · PUBLIC API · LIMITS · " />
      <main id="main" className="pg-docs">
        <section className="sec dtop" aria-labelledby="h-docs">
          <div className="shead">
            <h1 className="h1c" id="h-docs">
              Docs
            </h1>
            <p className="lead">
              Everything Tender does, the codes it answers with, and where it stops. The source, the tests and the live guard scorecard are on{" "}
              <a className="inl" href={REPO_URL}>
                GitHub
              </a>
              .
            </p>
          </div>
        </section>

        <div className="wrap">
          <Band seed="a12dd3a7fd3203a452eb34d91a9be20569d5e337a3384347068895c07f3e0c5a" />
        </div>

        <div className="sec dbody">
          <nav className="toc" aria-label="On this page">
            <p className="toc-h">On this page</p>
            <ol>
              {TOC.map(([id, label], n) => (
                <li key={id}>
                  <a href={`#${id}`}>
                    <span>{String(n + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="doc">
            <section id="what" aria-labelledby="h-what">
              <h2 id="h-what">What Tender is</h2>
              <p>
                Tender is a <a href="https://paybox.sh">PayBox</a> plugin. It lets an agent buy from any <a href="https://moonpay.hel.io">MoonPay Commerce</a>{" "}
                merchant in USDC on Solana or Base, using the x402 checkout every MoonPay Commerce pay link already exposes.
              </p>
              <p>
                Before PayBox is ever asked to approve anything, Tender re-reads the live price and refuses the payment when it is over the user&rsquo;s cap,
                the wallet can&rsquo;t cover it, or the checkout needs something an agent can&rsquo;t give. After the payment, it rebuilds the receipt from
                chain data: payer → deposit wallet → merchant, every unit accounted for.
              </p>
              <ol className="flow">
                <li>
                  <b>Resolve</b>
                  <span>Pay link → product, merchant, verification, price, rails, required fields.</span>
                </li>
                <li>
                  <b>Guard</b>
                  <span>Live 402 challenge and on-chain balance, read in parallel. Any blocker, no proposal.</span>
                </li>
                <li>
                  <b>Settle</b>
                  <span>An x402 proposal for the exact quoted amount; the user approves it in PayBox.</span>
                </li>
                <li>
                  <b>Verify</b>
                  <span>The receipt, recomputed from chain at /r/&lt;chain&gt;/&lt;tx&gt;.</span>
                </li>
              </ol>
            </section>

            <Micro text="INSTALL · ENABLE THE PLUGIN · CONNECT YOUR AGENT · ASK IN PLAIN WORDS · APPROVE IN PAYBOX · " />

            <section id="install" aria-labelledby="h-install">
              <h2 id="h-install">Install in PayBox</h2>
              <ol className="steps">
                <li>
                  <span className="n">1</span>
                  <div>
                    <h3>Enable the plugin</h3>
                    <p>
                      Open <a href={PAYBOX_PLUGINS_URL}>PayBox plugins</a> and enable Tender. Buying needs no secrets and no merchant account.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="n">2</span>
                  <div>
                    <h3>Connect your agent</h3>
                    <p>Connect your agent to PayBox. Tender&rsquo;s five tools become available to it through PayBox.</p>
                  </div>
                </li>
                <li>
                  <span className="n">3</span>
                  <div>
                    <h3>Ask, with a cap</h3>
                    <p>Name what to buy and the most you&rsquo;ll spend. Tender finds the merchant, checks every guard and only then proposes.</p>
                  </div>
                </li>
                <li>
                  <span className="n">4</span>
                  <div>
                    <h3>Approve in PayBox</h3>
                    <p>PayBox shows the exact amount for approval. Nothing is paid until you approve; afterwards, ask for the receipt.</p>
                  </div>
                </li>
              </ol>
              <figure className="cert slip">
                <figcaption>Example prompt</figcaption>
                <blockquote>
                  <p>&ldquo;Buy a flat white from Tender Coffee, don&rsquo;t spend more than fifty cents.&rdquo;</p>
                </blockquote>
                <p className="slip-trace">
                  <code>find_merchants</code> → <code>inspect_checkout</code> → <code>checkout</code> → approve in PayBox → <code>verify_purchase</code>
                </p>
              </figure>
            </section>

            <Micro text="TOOLS · FIND_MERCHANTS · INSPECT_CHECKOUT · CHECKOUT · LIST_CATALOG · VERIFY_PURCHASE · " />

            <section id="tools" aria-labelledby="h-tools">
              <h2 id="h-tools">The five tools</h2>
              <p>Only <code>checkout</code> can lead to a payment, and only as a proposal the user approves in PayBox.</p>
              <div className="tools">
                {TOOLS.map((t) => (
                  <section className="tool" key={t.name} aria-labelledby={`t-${t.name}`}>
                    <div className="tool-h">
                      <h3 id={`t-${t.name}`}>
                        <code>{t.name}</code>
                      </h3>
                      <span className={`money${t.money === "No" ? "" : " yes"}`}>{t.money === "No" ? "Moves no money" : "Proposes a payment"}</span>
                    </div>
                    <p className="tool-d">{t.does}</p>
                    <table className="tbl">
                      <caption className="vh">{t.name} inputs</caption>
                      <thead>
                        <tr>
                          <th scope="col">Input</th>
                          <th scope="col">Required</th>
                          <th scope="col">Meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.inputs.map(([k, req, d]) => (
                          <tr key={k}>
                            <td>
                              <code>{k}</code>
                            </td>
                            <td className="req">{req}</td>
                            <td>{d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="returns">
                      <span>Returns</span> {t.returns}
                    </p>
                  </section>
                ))}
              </div>
            </section>

            <Micro text="REFUSAL CODES · NO PROPOSAL IS SENT · NOTHING REACHES PAYBOX TO SIGN · " />

            <section id="refusals" aria-labelledby="h-ref">
              <h2 id="h-ref">Refusal codes</h2>
              <p>
                <code>checkout</code> refuses with no proposal on any of these. <code>inspect_checkout</code> lists the same codes as blockers, so an agent
                can explain a refusal before trying.
              </p>
              <table className="tbl codes">
                <caption className="vh">Refusal codes</caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {REFUSALS.map(([c, d]) => (
                    <tr key={c} id={c.toLowerCase()}>
                      <td>
                        <St state="fail">{c}</St>
                      </td>
                      <td>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <Micro text="RECEIPT CHECKS · RECOMPUTED FROM CHAIN ON EVERY LOAD · NOTHING STORED · " />

            <section id="receipts" aria-labelledby="h-rc">
              <h2 id="h-rc">Receipt checks</h2>
              <p>
                <code>verify_purchase</code> and the public receipt page run the same checks from chain data alone. Each one is OK, FAIL or PENDING; pending
                means the chain can&rsquo;t prove it yet, never that it passed.
              </p>
              <table className="tbl">
                <caption className="vh">Receipt checks</caption>
                <thead>
                  <tr>
                    <th scope="col">Check</th>
                    <th scope="col">Runs</th>
                    <th scope="col">Proves</th>
                  </tr>
                </thead>
                <tbody>
                  {CHECKS.map(([c, when, d]) => (
                    <tr key={c}>
                      <td>
                        <code>{c}</code>
                      </td>
                      <td className="req">{when}</td>
                      <td>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Verdicts</h3>
              <ul className="verdicts">
                {STATUSES.map(([s, tone, d]) => (
                  <li key={s}>
                    <St state={tone}>{s}</St>
                    <p>{d}</p>
                  </li>
                ))}
              </ul>
              <p>
                Try it on a real mainnet payment: <Link href={RECEIPT_EXAMPLE_PATH}>/r/solana/{RECEIPT_EXAMPLE.tx.slice(0, 8)}…</Link>. Without the pay link it
                stops at <em>swept</em>.
              </p>
            </section>

            <Micro text="MERCHANT KIT · CHECK · REGISTRY · TENDER_CATALOG · TENDER_STORE_NAME · NO CODE · " />

            <section id="merchants" aria-labelledby="h-mk">
              <h2 id="h-mk">Merchant kit</h2>
              <div className="kit">
                <div>
                  <h3>Check a pay link</h3>
                  <p>
                    <Link href="/check">/check</Link> runs the checks a buying agent would and says what to change. Most often: remove required customer
                    fields from the agent link.
                  </p>
                </div>
                <div>
                  <h3>List it</h3>
                  <p>
                    Add an entry to <a href={REGISTRY_FILE_URL}>registry/merchants.json</a> in a pull request; a passing check prints the entry for you.
                    Every listing is re-validated live when an agent uses it.
                  </p>
                </div>
                <div>
                  <h3>Your own storefront</h3>
                  <p>Upload the plugin as your own PayBox project and set two variables in the portal. No code changes.</p>
                </div>
              </div>
              <dl className="cert env">
                <dt>TENDER_CATALOG</dt>
                <dd>Comma-separated pay link ids, e.g. 6ad323565c71e316b383ea8a,6ad323579a3d621ed01812b8</dd>
                <dt>TENDER_STORE_NAME</dt>
                <dd>The name list_catalog shows, e.g. Tender Coffee</dd>
                <dt>TENDER_SITE_URL</dt>
                <dd>Optional. Base URL for the registry and receipt links.</dd>
              </dl>
            </section>

            <Micro text="PUBLIC API · /API/CHECK · /API/VERIFY · /REGISTRY.JSON · NO KEY · NOTHING STORED · " />

            <section id="api" aria-labelledby="h-api">
              <h2 id="h-api">Public API</h2>
              <p>Plain GET endpoints, no key. Results are computed on request and never stored.</p>

              <div className="ep">
                <h3>
                  <span className="verb">GET</span> <code>/api/check?link=</code>
                </h3>
                <p>The readiness check behind /check. Pass a pay link URL or id.</p>
                <Code>{`curl "${SITE_URL}/api/check?link=${EXAMPLES.ready.link}"

{
  "link": "https://moonpay.hel.io/pay/6ad3…",
  "agentReady": true,
  "product": { "id": "…", "name": "Flat white", "merchant": { "name": "Tender Coffee", … }, … },
  "quote": [{ "rail": "solana", "amountUsd": "$0.25", "feeUsd": null }],
  "checks": [{ "id": "resolves", "label": "Pay link resolves", "state": "ok", "detail": "…" }, …],
  "entry": { "id": "…", "title": "Flat white", … }
}`}</Code>
                <p className="small">
                  Check states are <code>ok</code>, <code>warn</code> or <code>fail</code>; failures carry a <code>fix</code>. <code>entry</code> is set only
                  when the link is agent-ready.
                </p>
              </div>

              <div className="ep">
                <h3>
                  <span className="verb">GET</span> <code>/api/verify?tx=&amp;payer=&amp;link=</code>
                </h3>
                <p>The receipt behind /r/&lt;chain&gt;/&lt;tx&gt;. <code>link</code> is optional but needed to reach settled.</p>
                <Code>{`curl "${SITE_URL}/api/verify?tx=<signature>&payer=<wallet>"

{
  "ok": true,
  "receipt": {
    "rail": "solana",
    "status": "swept",
    "payment": { "tx": "…", "from": "…", "to": "…", "amountUsd": "$3.10", … },
    "sweep": { "tx": "…", "merchant": null, "fees": [ … ] },
    "checks": [{ "name": "PAYMENT_CONFIRMED", "ok": true, "detail": "Confirmed on Solana." }, …]
  }
}

// errors answer 422: { "ok": false, "code": "TX_NOT_FOUND", "message": "…" }`}</Code>
              </div>

              <div className="ep">
                <h3>
                  <span className="verb">GET</span> <code>/registry.json</code>
                </h3>
                <p>
                  The open registry that <code>find_merchants</code> searches: <code>version</code>, <code>updated</code> and <code>merchants[]</code>.{" "}
                  <a href="/registry.json">Open it</a>.
                </p>
              </div>
            </section>

            <Micro text="HONEST LIMITS · WHERE TENDER STOPS · " />

            <section id="limits" aria-labelledby="h-lim">
              <h2 id="h-lim">Honest limits</h2>
              <ul className="limits">
                {LIMITS.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <div className="docend">
                <Link className="btn" href="/check">
                  Check a pay link <Arrow />
                </Link>
                <a className="link" href={REPO_URL}>
                  Read the source →
                </a>
              </div>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
