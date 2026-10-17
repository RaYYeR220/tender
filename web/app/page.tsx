import type { CSSProperties } from "react";
import Link from "next/link";
import registry from "../../registry/merchants.json";
import { Band } from "@/components/Band";
import { HeroSeal } from "@/components/HeroSeal";
import { Roll } from "@/components/Roll";
import { Seal } from "@/components/Seal";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Arrow, Micro, PendMark, Rosette, St } from "@/components/print";
import { sha256Hex } from "@/lib/seal/sha256";
import { short } from "@/lib/seal/geometry";
import { EXAMPLES, PAYBOX_PLUGINS_URL, PAYBOX_PURCHASE_PATH, RECEIPT_EXAMPLE, RECEIPT_EXAMPLE_PATH, hosted } from "@/lib/site";
import "./home.css";

export const metadata = { alternates: { canonical: "/" } };

// The hero seal is drawn from the hash of the first pay link in the open registry.
const HERO = registry.merchants[0];
const HERO_HASH = sha256Hex(HERO.id);
const HERO_PRICE = HERO.pricing.replace(/^\$/, "");
const HERO_SERIAL = `TND ${HERO_PRICE.replace(".", "").padStart(4, "0")} ${HERO.id.slice(0, 8).toUpperCase()}`;
const CATALOG = registry.merchants.map((m) => m.id);

// Decorative band seeds (sha-256 digests carried over from the approved design).
const SEED = {
  a: "fdf09cdfc26cccf610edccd7f9b558e1ce0a793a4ee57f8306df9058f1aa929b",
  b: "a9d4034da07d8ef31db1cd4119b6a4552fdfbd19787e2848e71c8ee3b47703a7",
  c: "6868e83de35c465d84d347493ccc23d12b3bfacb9809d30292d21fc4701224d1",
  d: "a12dd3a7fd3203a452eb34d91a9be20569d5e337a3384347068895c07f3e0c5a",
  e: "dc64ca618fa2be43e779f254f5ac8fb60ff118c3442a1a3e77ed1304646501c3",
};
const TX_HASH = sha256Hex(RECEIPT_EXAMPLE.tx);
const SWEEP_URL = "https://solscan.io/tx/5cG3qCWiCrhCe2uq3tmKcSMeMfyU82b6GYHiubPDPB2n5sybktSTCnobLZojz8Guy1PS7yrd4CmPHtRankGVuvPP";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

const CODES: [string, string][] = [
  ["OVER_BUDGET", "The total is above your cap, even by one unit."],
  ["INSUFFICIENT_FUNDS", "Your wallet can't cover it."],
  ["REQUIRES_CUSTOMER_DETAILS", "The link wants an email, a name or an address."],
  ["RAIL_UNAVAILABLE", "Your chain isn't offered."],
  ["LINK_INACTIVE", "The link is dead."],
  ["BUDGET_REQUIRED", "No cap, no proposal."],
];

const GUARDS = ["Cap", "Quote", "Fields", "Link", "Rail", "Funds"];

export default function Home() {
  return (
    <>
      <SiteHeader micro={`TENDER · AGENT CHECKOUT · x402 · USDC · BASE · SOLANA · ${HERO.id} · `} />
      <main id="main" className="pg-home">
        <section className="hero" aria-labelledby="h-hero">
          <div className="copy">
            <p className="eyebrow rise" style={i(0)}>
              <i />
              PayBox plugin · MoonPay Commerce · x402
            </p>
            <h1 id="h-hero" className="rise" style={i(1)}>
              Any MoonPay Commerce checkout, <em>paid</em> by your agent.
            </h1>
            <p className="sub rise" style={i(2)}>
              Tender turns a merchant&rsquo;s pay link into a guarded USDC payment on Solana or Base — and refuses before anything is signed when the
              price, the wallet or the checkout isn&rsquo;t right.
            </p>
            <div className="ctas rise" style={i(3)}>
              <a className="btn" href={PAYBOX_PLUGINS_URL}>
                Add Tender to PayBox <Arrow />
              </a>
              <Link className="link" href="/check">
                Check your pay link →
              </Link>
            </div>
          </div>
          <HeroSeal
            hex={HERO_HASH}
            id={HERO.id}
            amount={HERO_PRICE}
            unit="USDC · SOL"
            label={`Guilloche seal drawn from the hash of pay link ${HERO.id}, ${HERO.title} by ${HERO.merchant}`}
          >
            <div className="serial serialtxt">
              <span>No.</span>
              <Roll text={HERO_SERIAL} />
            </div>
            <div className="legend">
              <div className="mp">
                pay link {HERO.id} · seed sha-256 {HERO_HASH.slice(0, 16)}…{HERO_HASH.slice(-7)} · api.hel.io
              </div>
              <p>Seal drawn from the hash of a real pay link — a visual checksum, not a security feature.</p>
            </div>
          </HeroSeal>
        </section>

        <div className="wrap">
          <Band seed={SEED.a} />
        </div>

        <section className="sec" id="how" aria-labelledby="h-how">
          <div className="shead">
            <h2 className="h2" id="h-how">
              How it works
            </h2>
            <p className="lead">From a pay link to a receipt anyone can check, in four steps. If any guard fails, the run stops at step two and nothing is signed.</p>
          </div>
          <ol className="cert coupons">
            <li className="coupon">
              <div className="cp-top">
                <span className="cp-n">I</span>
                <Rosette seed={SEED.a} />
              </div>
              <h3 className="cp-verb">Resolve</h3>
              <p className="cp-txt">Any pay link becomes a product, a merchant and a live price.</p>
              <div className="cp-foot">
                <div>
                  moonpay.hel.io/pay/{HERO.id.slice(0, 8)}…
                  <br />
                  {HERO.title} · {HERO.merchant} · {HERO.pricing}
                </div>
              </div>
            </li>
            <li className="coupon">
              <div className="cp-top">
                <span className="cp-n">II</span>
                <Rosette seed={SEED.b} />
              </div>
              <h3 className="cp-verb">Guard</h3>
              <p className="cp-txt">Cap, quote, fields, link, rail and funds. Refuse before anything is signed.</p>
              <div className="cp-foot">
                <div>
                  cap ≤ $0.50 · quote $0.25 incl. fees
                  <br />6 guards · fail-closed
                </div>
              </div>
            </li>
            <li className="coupon">
              <div className="cp-top">
                <span className="cp-n">III</span>
                <Rosette seed={SEED.c} />
              </div>
              <h3 className="cp-verb">Settle</h3>
              <p className="cp-txt">An x402 proposal goes to PayBox. You approve it, and the merchant is paid in USDC.</p>
              <div className="cp-foot">
                <div>
                  x402 v2 · scheme exact
                  <br />
                  USDC on Solana or Base
                </div>
              </div>
            </li>
            <li className="coupon">
              <div className="cp-top">
                <span className="cp-n">IV</span>
                <Rosette seed={SEED.d} />
              </div>
              <h3 className="cp-verb">Verify</h3>
              <p className="cp-txt">The receipt is rebuilt from chain: payer to deposit wallet to merchant.</p>
              <div className="cp-foot">
                <div>
                  payer → deposit wallet → merchant
                  <br />
                  /r/solana/&lt;tx&gt;
                </div>
              </div>
            </li>
          </ol>
        </section>

        <div className="wrap">
          <Micro text="THE REFUSAL IS THE PRODUCT · NO PROPOSAL IS SENT · NOTHING REACHES PAYBOX TO SIGN · OVER_BUDGET · INSUFFICIENT_FUNDS · REQUIRES_CUSTOMER_DETAILS · RAIL_UNAVAILABLE · LINK_INACTIVE · BUDGET_REQUIRED · " />
        </div>

        <section className="sec" id="refusal" aria-labelledby="h-ref">
          <div className="shead">
            <h2 className="h2" id="h-ref">
              The refusal is the product.
            </h2>
            <p className="lead big">No proposal is sent. Nothing reaches PayBox to sign.</p>
          </div>
          <div className="pair">
            <figure>
              <figcaption className="chq-cap">
                <St state="ok">Approved</St>
                <span>Cap $0.50 · quote $0.25</span>
              </figcaption>
              <div className="cert cheque">
                <Band seed={HERO_HASH} className="strip band" />
                <div className="chq-top">
                  <span className="chq-iss">Tender · checkout proposal</span>
                  <span className="serialtxt">
                    <span>No.</span>
                    {HERO_SERIAL}
                  </span>
                </div>
                <div className="chq-body">
                  <dl className="chq-lines">
                    <div>
                      <dt>Pay to</dt>
                      <dd className="payee">{HERO.merchant}</dd>
                    </div>
                    <div>
                      <dt>For</dt>
                      <dd>{HERO.title} · USDC on Solana</dd>
                    </div>
                    <div>
                      <dt>Cap</dt>
                      <dd>$0.50, set by you</dd>
                    </div>
                  </dl>
                  <div className="amt">
                    <b>{HERO_PRICE}</b>
                    <small>USDC</small>
                  </div>
                </div>
                <ul className="guards" aria-label="Guards, all passing">
                  {GUARDS.map((g) => (
                    <St key={g} as="li" state="ok">
                      {g}
                    </St>
                  ))}
                </ul>
                <div className="sig">
                  <Micro className="sigline" text="APPROVED IN PAYBOX · x402 v2 · EXACT · USDC · SOLANA · " />
                  <span>Sent to PayBox for approval</span>
                </div>
              </div>
            </figure>
            <figure>
              <figcaption className="chq-cap">
                <St state="fail">Refused</St>
                <span>Cap $0.10 · quote $0.25</span>
              </figcaption>
              <div className="cert cheque refused">
                <Band seed={HERO_HASH} className="strip band" />
                <div className="chq-top">
                  <span className="chq-iss">Tender · checkout proposal</span>
                  <span className="serialtxt">
                    <span>No.</span>not issued
                  </span>
                </div>
                <div className="chq-body">
                  <dl className="chq-lines">
                    <div>
                      <dt>Pay to</dt>
                      <dd className="payee">{HERO.merchant}</dd>
                    </div>
                    <div>
                      <dt>For</dt>
                      <dd>{HERO.title} · USDC on Solana</dd>
                    </div>
                    <div>
                      <dt>Cap</dt>
                      <dd>$0.10, set by you</dd>
                    </div>
                  </dl>
                  <div className="amt">
                    <b>{HERO_PRICE}</b>
                    <small>USDC</small>
                  </div>
                </div>
                <ul className="guards" aria-label="Guards, cap failing">
                  {GUARDS.map((g, n) => (
                    <St key={g} as="li" state={n === 0 ? "fail" : "ok"}>
                      {g}
                    </St>
                  ))}
                </ul>
                <div className="sig">
                  <Micro className="sigline" text="NOT SENT · NOTHING TO SIGN · OVER_BUDGET · " />
                  <span>Nothing to sign</span>
                </div>
                <div className="void" aria-hidden="true">
                  VOID
                </div>
                <div className="stamp">
                  <b>REFUSED</b>
                  <span>
                    OVER_BUDGET
                    <br />
                    no proposal sent
                  </span>
                </div>
              </div>
            </figure>
          </div>

          <div className="codes">
            <h3 className="h3">Every refusal comes with a reason.</h3>
            {CODES.map(([code, line]) => (
              <div className="code" key={code}>
                <St state="fail">{code}</St>
                <p>{line}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="wrap">
          <Band seed={SEED.e} />
        </div>

        <section className="sec" id="receipts" aria-labelledby="h-rc">
          <div className="rcsec">
            <div className="left">
              <h2 className="h2" id="h-rc">
                Receipts anyone can check
              </h2>
              <p className="lead">
                Every payment gets a public page at{" "}
                <span className="mono" style={{ fontSize: 15 }}>
                  /r/solana/&lt;tx&gt;
                </span>
                . It traces the money from the payer to the deposit wallet to the merchant, and checks that the amounts add up. It only says
                settled once the pay link proves the merchant was paid.
              </p>
              <p className="stmt">Recomputed from chain on every load. Nothing stored.</p>
              <Link className="link" href={RECEIPT_EXAMPLE_PATH}>
                Open this receipt live →
              </Link>
              <br />
              <Link className="link" href={PAYBOX_PURCHASE_PATH}>
                A flat white bought through PayBox →
              </Link>
            </div>
            <div className="cert rcpt">
              <Band seed={SEED.e} className="strip band" />
              <div className="rc-top">
                <span className="rc-title">Certificate of settlement</span>
                <span className="serialtxt">
                  <span>Tx</span>
                  {short(RECEIPT_EXAMPLE.tx, 8, 7)}
                </span>
              </div>
              <div className="rc-head">
                <div>
                  <p className="rc-verdict">
                    Swept <PendMark className="pendmark" />
                  </p>
                  <p className="rc-amt">
                    <b>$3.10 USDC</b> on Solana · swept 3 s later
                  </p>
                </div>
                <div className="rc-seal" role="img" aria-label="Seal drawn from the transaction hash, a visual checksum">
                  <Seal hex={TX_HASH} />
                </div>
              </div>
              <ol className="hops">
                <li>
                  <span className="hn">1</span>
                  <span className="hk">Paid</span>
                  <span className="hp">6Uph…Tov3 → E38J…kQ2</span>
                  <span className="hv">$3.10</span>
                  <a className="ex" href={`https://solscan.io/tx/${RECEIPT_EXAMPLE.tx}`} aria-label="Payment on Solscan">
                    ↗
                  </a>
                </li>
                <li>
                  <span className="hn">2</span>
                  <span className="hk">
                    Swept<small>+3 s</small>
                  </span>
                  <span className="hp">E38J…kQ2 → 6vZE…utD5</span>
                  <span className="hv">$3.038</span>
                  <a className="ex" href={SWEEP_URL} aria-label="Sweep on Solscan">
                    ↗
                  </a>
                </li>
                <li>
                  <span className="hn">3</span>
                  <span className="hk">
                    Swept<small>same tx</small>
                  </span>
                  <span className="hp">E38J…kQ2 → FudP…YRTZ · JBGU…ftqk</span>
                  <span className="hv">$0.062</span>
                  <a className="ex" href={SWEEP_URL} aria-label="Sweep legs on Solscan">
                    ↗
                  </a>
                </li>
              </ol>
              <ul className="checks" aria-label="Checks">
                <St as="li" state="ok">PAYMENT_CONFIRMED</St>
                <St as="li" state="ok">PAID_FROM_PAYER</St>
                <St as="li" state="ok">PAID_IN_USDC</St>
                <St as="li" state="ok">AMOUNTS_RECONCILE</St>
                <St as="li" state="pend">MERCHANT_PAID · pending</St>
              </ul>
              <p className="rc-note">
                <b>Swept, not settled:</b> the money reached three wallets to the cent, but without the pay link Tender won&rsquo;t say which one is
                the merchant&rsquo;s.
              </p>
              <div className="rc-foot">
                <span>Seal drawn from the tx hash — a visual checksum, not a security feature.</span>
                <span className="mono">Real mainnet payment · read live</span>
              </div>
            </div>
          </div>
        </section>

        <div className="wrap">
          <Micro text={`FOR MERCHANTS · CHECK YOUR PAY LINK · OPEN REGISTRY · PULL REQUEST · TENDER_CATALOG · TENDER_STORE_NAME · NO CODE · ${CATALOG.join(" · ")} · `} />
        </div>

        <section className="sec" id="merchants" aria-labelledby="h-m">
          <div className="shead">
            <h2 className="h2" id="h-m">
              For merchants
            </h2>
            <p className="lead">
              Your MoonPay Commerce pay link already works. Make sure agents can pay it, get listed where they look, or open your own store inside
              PayBox.
            </p>
          </div>
          <div className="merch">
            <article className="mcol">
              <h3 className="h3">Check your pay link</h3>
              <p className="d">Six checks, from &ldquo;does it resolve&rdquo; to a live x402 quote. Every failure comes with a fix.</p>
              <form className="pc" action="/check" method="get">
                <label className="fl" htmlFor="pl">
                  Pay link
                </label>
                <div className="field">
                  <input id="pl" name="link" defaultValue={EXAMPLES.ready.link} spellCheck={false} autoComplete="off" />
                </div>
                <Micro className="sigline" text="PAY LINK · AGENT-READINESS · RESOLVES · LIVE · FIELDS · RAIL · QUOTE · VERIFIED · " />
                <button className="btn sm" type="submit">
                  Check link <Arrow />
                </button>
              </form>
            </article>
            <article className="mcol">
              <h3 className="h3">List in the open registry</h3>
              <p className="d">
                Add one JSON entry by pull request. Agents find you through <code>find_merchants</code>, and each listing carries a seal drawn
                from its pay link.
              </p>
              <ul className="reg">
                {registry.merchants.map((m) => (
                  <li key={m.id}>
                    <Rosette seed={sha256Hex(m.id)} />
                    <div>
                      <b>{m.merchant}</b>
                      <span>
                        {m.title} · {m.pricing}
                      </span>
                    </div>
                    <a className="id" href={hosted(m.id)} aria-label={`${m.title} pay link`}>
                      {m.id.slice(0, 8)}…
                    </a>
                  </li>
                ))}
                <li>
                  <span className="ghost" aria-hidden="true">
                    +
                  </span>
                  <div>
                    <b>Your link</b>
                    <span>One entry, one pull request</span>
                  </div>
                  <Link className="id" href="/merchants#list">
                    PR
                  </Link>
                </li>
              </ul>
            </article>
            <article className="mcol">
              <h3 className="h3">Your own storefront in PayBox</h3>
              <ol className="steps">
                <li>Upload the Tender plugin as your own PayBox project.</li>
                <li>In the portal&rsquo;s variables, set your pay link ids and store name.</li>
                <li>That&rsquo;s it. No code changes.</li>
              </ol>
              <dl className="cert env">
                <dt>TENDER_CATALOG</dt>
                <dd>
                  {CATALOG.map((id, n) => (
                    <span key={id}>
                      {id}
                      {n < CATALOG.length - 1 ? "," : ""}
                      {n < CATALOG.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </dd>
                <dt>TENDER_STORE_NAME</dt>
                <dd>{HERO.merchant}</dd>
              </dl>
            </article>
          </div>
        </section>

        <div className="wrap">
          <Band seed={SEED.b} />
        </div>

        <section className="sec" id="agents" aria-labelledby="h-a">
          <div className="shead">
            <h2 className="h2" id="h-a">
              For agents
            </h2>
            <p className="lead">Five tools in one PayBox plugin. Ask in plain words; Tender finds the merchant, checks every guard and only then proposes a payment.</p>
          </div>
          <div className="agrid">
            <div className="cert slip">
              <p className="ask">Ask your agent</p>
              <q>Buy a flat white from Tender Coffee, don&rsquo;t spend more than fifty cents.</q>
              <ol className="trace" aria-label="What happens">
                <li>
                  <b>find_merchants</b>
                  <span>Tender Coffee · 1 match</span>
                </li>
                <li>
                  <b>inspect_checkout</b>
                  <span>$0.25 under a $0.50 cap · 6 guards pass</span>
                </li>
                <li>
                  <b>checkout</b>
                  <span>x402 proposal sent to PayBox for approval</span>
                </li>
                <li>
                  <b>verify_purchase</b>
                  <span>settled · receipt rebuilt from chain</span>
                </li>
              </ol>
            </div>
            <ul className="tools">
              <li>
                <code>find_merchants</code>
                <p>Search the open registry.</p>
              </li>
              <li>
                <code>inspect_checkout</code>
                <p>Dry run: price, quote, balance, and every reason it would refuse.</p>
              </li>
              <li>
                <code>checkout</code>
                <p>Fail-closed x402 proposal. One failed guard and nothing is sent.</p>
              </li>
              <li>
                <code>list_catalog</code>
                <p>A store&rsquo;s products.</p>
              </li>
              <li>
                <code>verify_purchase</code>
                <p>The on-chain receipt for a payment.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="sec proofsec" aria-label="Proof">
          <div className="proof">
            <div>
              <b>22</b>
              <span>guard scenarios against live MoonPay Commerce</span>
            </div>
            <div>
              <b>0</b>
              <span>proposals where a refusal was due</span>
            </div>
            <div>
              <b>45</b>
              <span>core tests</span>
            </div>
            <div>
              <b>USDC</b>
              <span>Solana live · Base supported</span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

