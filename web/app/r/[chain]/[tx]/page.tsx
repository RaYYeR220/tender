import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { formatUsd } from "@tender/core";
import type { Product, Receipt, ReceiptCheck, Transfer } from "@tender/core";
import { Band } from "@/components/Band";
import { Roll } from "@/components/Roll";
import { Seal } from "@/components/Seal";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Arrow, FailMark, Micro, OkMark, OutArrow, PendMark, Rosette, type StState } from "@/components/print";
import { loadReceipt } from "@/lib/receipt";
import { short } from "@/lib/seal/geometry";
import { sha256Hex } from "@/lib/seal/sha256";
import { hosted } from "@/lib/site";
import "./receipt.css";

export const dynamic = "force-dynamic";

const RAIL = { solana: { name: "Solana", unit: "SOL", explorer: "Solscan" }, base: { name: "Base", unit: "BASE", explorer: "Basescan" } } as const;
type Chain = keyof typeof RAIL;
const isChain = (c: string): c is Chain => c === "solana" || c === "base";
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const word = (n: number) => WORDS[n] ?? String(n);

export async function generateMetadata({ params }: PageProps<"/r/[chain]/[tx]">): Promise<Metadata> {
  const { chain, tx } = await params;
  const rail = isChain(chain) ? RAIL[chain].name : "chain";
  return {
    title: `Receipt ${short(tx, 8, 6)}`,
    description: `Public receipt for a MoonPay Commerce payment on ${rail}, recomputed from chain on every load. Nothing stored.`,
    robots: { index: false, follow: true },
  };
}

export default async function ReceiptPage({ params, searchParams }: PageProps<"/r/[chain]/[tx]">) {
  const { chain, tx: rawTx } = await params;
  if (!isChain(chain)) notFound();
  let tx = rawTx;
  try {
    tx = decodeURIComponent(rawTx).trim();
  } catch {
    notFound();
  }
  const sp = await searchParams;
  const payer = one(sp.payer);
  const link = one(sp.link);

  let body: ReactNode;
  if (!payer) {
    body = (
      <Problem
        chain={chain}
        tx={tx}
        payer=""
        link={link}
        word="Needs a payer"
        code="PAYER_REQUIRED"
        message="A receipt is rebuilt from the payer's side: add the wallet that paid, and the pay link if you have it."
      />
    );
  } else {
    const result = await loadReceipt(tx, payer, link || null);
    if (!result.ok) {
      body = <Problem chain={chain} tx={tx} payer={payer} link={link} word={problemWord(result.code)} code={result.code} message={result.message} />;
    } else {
      if (result.receipt.rail !== chain) {
        const q = new URLSearchParams({ payer, ...(link ? { link } : {}) });
        redirect(`/r/${result.receipt.rail}/${tx}?${q}`);
      }
      body = <Certificate receipt={result.receipt} product={result.product} payer={payer} linkId={result.link} tx={tx} chain={chain} />;
    }
  }

  return (
    <>
      <SiteHeader micro={`CERTIFICATE OF SETTLEMENT · RECOMPUTED FROM CHAIN ON EVERY LOAD · NOTHING STORED · ${tx} · `} />
      <main id="main" className="pg-rcpt" data-surface="receipt">
        <div className="sec rtop">
          <p className="crumb">
            <span>/r/{chain}/</span>
            <b className="long">{short(tx, 17, 16)}</b>
            <b className="short">{short(tx, 8, 7)}</b>
          </p>
          <p>Public receipt · read from {RAIL[chain].name} on this load</p>
        </div>
        <section className="sec rsec" aria-label="Receipt">
          {body}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function problemWord(code: string): string {
  switch (code) {
    case "TX_NOT_FOUND":
      return "Not found";
    case "NOT_A_PAYMENT":
      return "Not a payment";
    case "INVALID_TX":
    case "INVALID_PAYER":
    case "INVALID_REFERENCE":
      return "Invalid";
    case "UNAVAILABLE":
    case "RPC_UNAVAILABLE":
      return "Unavailable";
    default:
      return "Not verified";
  }
}

// ---------- helpers ----------

function pct(part: bigint, total: bigint): string {
  if (total === 0n) return "0%";
  const bp = Number((part * 10000n) / total);
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : bp % 10 === 0 ? 1 : 2)}%`;
}

function sumUsd(transfers: Transfer[]): bigint {
  return transfers.reduce((s, t) => s + BigInt(t.amount), 0n);
}

function usd(atomic: bigint): string {
  const s = atomic.toString().padStart(7, "0");
  const whole = s.slice(0, -6).replace(/^0+(?=\d)/, "");
  const frac = s.slice(-6).replace(/0+$/, "").padEnd(2, "0");
  return `$${whole}.${frac}`;
}

function delta(a: number | null, b: number | null): string | null {
  if (a === null || b === null) return null;
  const d = Math.max(0, b - a);
  if (d < 90) return `${d} s`;
  if (d < 5400) return `${Math.round(d / 60)} min`;
  return `${Math.round(d / 3600)} h`;
}

function when(at: number | null): string | null {
  if (at === null) return null;
  const d = new Date(at * 1000);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

const CHECK_STATE = (ok: boolean | null): { cls: StState; word: string } =>
  ok === true ? { cls: "ok", word: "OK" } : ok === false ? { cls: "fail", word: "Fail" } : { cls: "pend", word: "Pending" };

// ---------- the certificate ----------

function Certificate({ receipt, product, payer, linkId, tx, chain }: { receipt: Receipt; product: Product | null; payer: string; linkId: string | null; tx: string; chain: Chain }) {
  const R = RAIL[chain];
  const { payment, sweep, checks, status } = receipt;
  const seed = sha256Hex(tx);
  const merchantLeg = sweep?.merchant ?? null;
  const fees = sweep?.fees ?? [];
  const legs = merchantLeg ? [merchantLeg, ...fees] : [...fees].sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
  const paid = BigInt(payment.amount);
  const swept = sumUsd(legs);
  const dt = delta(payment.at, sweep?.at ?? null);
  const pass = checks.filter((c) => c.ok === true).length;
  const failing = checks.filter((c) => c.ok === false);
  const pending = checks.filter((c) => c.ok === null);
  const amount = payment.amountUsd.replace(/^\$/, "");
  const reconcile = checks.find((c) => c.name === "AMOUNTS_RECONCILE");

  const verdict: Record<Receipt["status"], { word: string; tag: string; tone: StState; mark: ReactNode; line: string; text: string }> = {
    settled: {
      word: "Settled",
      tag: "SETTLED",
      tone: "ok",
      mark: <OkMark />,
      line: `${pass} OF ${checks.length} CHECKS PASS · MERCHANT PAID ON ${R.name.toUpperCase()}`,
      text: "The USDC left the payer, landed in the deposit wallet MoonPay Commerce assigns this payer for this pay link, and the sweep paid the merchant's listed payout wallet. Every unit is accounted for.",
    },
    swept: {
      word: "Swept",
      tag: "SWEPT",
      tone: "pend",
      mark: <PendMark />,
      line: "PAID AND SWEPT ON · MERCHANT NOT CONFIRMED",
      text: linkId
        ? `The money moved on from the deposit wallet, but not every link to this pay link could be confirmed: ${pending[0]?.detail ?? "the binding is unconfirmed."}`
        : "The payment left the payer and the deposit wallet swept it on, to the unit. Without the pay link, Tender can't tell the merchant's wallet from the fee wallets, so it stops short of settled.",
    },
    awaiting_sweep: {
      word: "Paid",
      tag: "AWAITING SWEEP",
      tone: "pend",
      mark: <PendMark />,
      line: "AWAITING SWEEP · MOONPAY COMMERCE SWEEPS FROM $3",
      text: `The payment is confirmed and sits in the deposit wallet. MoonPay Commerce moves a deposit wallet to the merchant once it holds at least $3${
        receipt.depositBalance ? `; this one holds ${formatUsd(receipt.depositBalance)}` : ""
      }. Reload to recompute.`,
    },
    unverified: {
      word: "Unverified",
      tag: "UNVERIFIED",
      tone: "fail",
      mark: <FailMark />,
      line: `${word(failing.length).toUpperCase()} CHECK${failing.length === 1 ? "" : "S"} FAIL · NOT PROOF OF PAYMENT`,
      text: `Not proof that the merchant was paid. ${failing.map((c) => c.detail).join(" ")}`,
    },
  };
  const v = verdict[status];

  const meta: [string, ReactNode][] = [
    ["Merchant", product ? product.merchant.name : merchantLeg ? <span className="mono">{short(merchantLeg.to)}</span> : "Not identified"],
    ...(product ? ([["For", product.name]] as [string, ReactNode][]) : []),
    ["Payer", <span className="mono" key="p">{short(payer)}</span>],
    ["Rail", "x402 · MoonPay Commerce"],
  ];

  const third = merchantLeg
    ? { title: "Merchant", sub: short(merchantLeg.to), seed: merchantLeg.to }
    : sweep
      ? { title: "Payout wallets", sub: `${legs.length} wallet${legs.length === 1 ? "" : "s"}`, seed: sweep.tx }
      : { title: "Merchant", sub: "not swept yet", seed: payment.to + "pending" };

  type Hop = { n: number; k: string; at: string; path: ReactNode; value: string; href?: string; hrefLabel: string };
  const hops: Hop[] = [
    {
      n: 1,
      k: "Paid",
      at: "t",
      path: (
        <>
          <i>payer</i> {short(payer)} → <i>deposit</i> {short(payment.to)}
        </>
      ),
      value: payment.amountUsd,
      href: payment.explorer,
      hrefLabel: short(payment.tx, 8, 7),
    },
  ];
  if (sweep && merchantLeg) {
    hops.push({
      n: 2,
      k: "Swept",
      at: dt ? `t + ${dt}` : "sweep",
      path: (
        <>
          <i>deposit</i> {short(payment.to)} → <i>merchant</i> {short(merchantLeg.to)}
        </>
      ),
      value: merchantLeg.amountUsd,
      href: sweep.explorer,
      hrefLabel: short(sweep.tx, 8, 6),
    });
    if (fees.length) {
      hops.push({
        n: 3,
        k: "Fees",
        at: "same sweep",
        path: (
          <>
            <i>deposit</i> {short(payment.to)} → {fees.map((f) => `${f.amountUsd} to ${short(f.to)}`).join(" · ")}
          </>
        ),
        value: usd(sumUsd(fees)),
        href: sweep.explorer,
        hrefLabel: short(sweep.tx, 8, 6),
      });
    }
  } else if (sweep) {
    legs.forEach((leg, i) =>
      hops.push({
        n: i + 2,
        k: "Swept",
        at: i === 0 ? (dt ? `t + ${dt}` : "sweep") : "same sweep",
        path: (
          <>
            <i>deposit</i> {short(payment.to)} → <i>wallet</i> {short(leg.to)}
          </>
        ),
        value: leg.amountUsd,
        href: sweep.explorer,
        hrefLabel: short(sweep.tx, 8, 6),
      }),
    );
  } else {
    hops.push({
      n: 2,
      k: "Sweep",
      at: "pending",
      path: (
        <>
          <i>deposit</i> {short(payment.to)} → <i>merchant</i> not on chain yet
        </>
      ),
      value: "—",
      hrefLabel: "pending",
    });
  }

  const merchantBp = merchantLeg && swept > 0n ? Number((BigInt(merchantLeg.amount) * 10000n) / swept) : 0;
  const firstBp = legs[0] && swept > 0n ? Number((BigInt(legs[0].amount) * 10000n) / swept) : 0;

  return (
    <article className={`cert doc tone-${v.tone}`}>
      <Band seed={seed} className="strip band" />
      <div className="d-top">
        <span className="d-title">Tender · certificate of settlement</span>
        <span className={`spec-tag ${v.tone}`}>{v.tag}</span>
      </div>

      <div className="d-head">
        <div>
          <h1 className={`verdict ${v.tone}`}>
            {v.word} {v.mark}
          </h1>
          <span className={`vword ${v.tone}`}>{v.line}</span>
          <p className="amount">
            <b>{payment.amountUsd}</b>
            <span>
              USDC on {R.name}
              {merchantLeg && dt ? ` · merchant paid ${dt} later` : sweep && dt ? ` · swept ${dt} later` : ""}
            </span>
          </p>
          <p className="vexpl">{v.text}</p>
          <dl className={`meta m${meta.length}`}>
            {meta.map(([k]) => (
              <dt key={k}>{k}</dt>
            ))}
            {meta.map(([k, val]) => (
              <dd key={k}>{val}</dd>
            ))}
          </dl>
        </div>
        <div className="sealbox">
          <div className="tseal" role="img" aria-label="Seal drawn from the transaction hash, a visual checksum">
            <div className="ink">
              <Seal hex={seed} />
            </div>
            <div className="tseal-core">
              <div>
                <b>{amount}</b>
                <small>USDC · {R.unit}</small>
              </div>
            </div>
          </div>
          <p>
            Seal drawn from the tx hash — a visual checksum,
            <br />
            not a security feature.
          </p>
        </div>
      </div>

      <dl className="serialrow">
        <dt>Payment tx</dt>
        <dd>
          <Roll text={payment.tx} ms={1400} />
        </dd>
        {sweep && (
          <>
            <dt>Sweep tx</dt>
            <dd className="second">{sweep.tx}</dd>
          </>
        )}
        {when(payment.at) && (
          <>
            <dt>Block time</dt>
            <dd className="second">{when(payment.at)}</dd>
          </>
        )}
      </dl>

      <section className="blk" aria-labelledby="h-hops">
        <div className="blk-h">
          <h2 id="h-hops">{word(hops.length)} hops</h2>
          <span>Payer → deposit wallet → merchant, read from {R.name} on this load</span>
        </div>
        <div className="route" aria-hidden="true">
          <div className="node">
            <Rosette seed={sha256Hex(payer)} />
            <b>Payer</b>
            <span>{short(payer)}</span>
          </div>
          <div className="edge">
            <b>{payment.amountUsd}</b>
            <Band seed={seed} className="band" />
            <span>payment · t</span>
          </div>
          <div className="node">
            <Rosette seed={sha256Hex(payment.to)} />
            <b>Deposit wallet</b>
            <span>{short(payment.to)}</span>
          </div>
          <div className={`edge${sweep ? "" : " wait"}`}>
            <b>{merchantLeg ? merchantLeg.amountUsd : sweep ? usd(swept) : "pending"}</b>
            {sweep ? <Band seed={sha256Hex(sweep.tx)} className="band" /> : null}
            <span>{sweep ? `sweep · ${dt ? `t + ${dt}` : "later"}` : "not swept yet"}</span>
          </div>
          <div className="node">
            <Rosette seed={sha256Hex(third.seed)} />
            <b>{third.title}</b>
            <span>{third.sub}</span>
          </div>
        </div>
        <ol className="hops">
          {hops.map((h) => (
            <li key={h.n}>
              <span className="hn">{h.n}</span>
              <span className="hk">
                {h.k}
                <small>{h.at}</small>
              </span>
              <span className="hp">{h.path}</span>
              <span className="hv">{h.value}</span>
              {h.href ? (
                <a className="hx" href={h.href}>
                  {h.hrefLabel} ↗<span className="vh"> on {R.explorer}</span>
                </a>
              ) : (
                <span className="hx wait">{h.hrefLabel}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="cols">
        <section className="blk" aria-labelledby="h-ck">
          <div className="blk-h">
            <h2 id="h-ck">{word(checks.length)} checks</h2>
            <span>
              {pass} of {checks.length} pass{pending.length ? ` · ${pending.length} pending` : ""}
              {failing.length ? ` · ${failing.length} failing` : ""}
            </span>
          </div>
          <ul className="ck">
            {checks.map((c: ReceiptCheck) => {
              const s = CHECK_STATE(c.ok);
              return (
                <li key={c.name}>
                  <span className={`st ${s.cls}`}>
                    <i aria-hidden="true" />
                    {s.word}
                  </span>
                  <div>
                    <b className="ckname">{c.name}</b>
                    <p>{c.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="blk" aria-labelledby="h-fee">
          <div className="blk-h">
            <h2 id="h-fee">Where the {payment.amountUsd} went</h2>
          </div>
          <div className="ledger">
            {sweep ? (
              <>
                {merchantLeg ? (
                  <>
                    <div className="lrow">
                      <span>
                        Merchant payout<small>{pct(BigInt(merchantLeg.amount), paid)}</small>
                      </span>
                      <i />
                      <b>{merchantLeg.amountUsd}</b>
                    </div>
                    {fees.map((f) => (
                      <div className="lrow sub" key={f.to}>
                        <span>
                          Fee to {short(f.to)}
                          <small>{pct(BigInt(f.amount), paid)}</small>
                        </span>
                        <i />
                        <b>{f.amountUsd}</b>
                      </div>
                    ))}
                  </>
                ) : (
                  legs.map((l, n) => (
                    <div className={`lrow${n ? " sub" : ""}`} key={l.to}>
                      <span>
                        To {short(l.to)}
                        <small>{pct(BigInt(l.amount), paid)}</small>
                      </span>
                      <i />
                      <b>{l.amountUsd}</b>
                    </div>
                  ))
                )}
                <div className="lrow tot">
                  <span>Paid out by the sweep</span>
                  <i />
                  <b>{usd(swept)}</b>
                </div>
                <div className="bar" aria-hidden="true">
                  <i className="m" style={{ flex: merchantLeg ? merchantBp : firstBp }} />
                  {(merchantLeg ? fees : legs.slice(1)).map((f, n) => (
                    <i key={f.to} className={n === 0 ? "f1" : "f2"} style={{ flex: swept > 0n ? Number((BigInt(f.amount) * 10000n) / swept) : 0 }} />
                  ))}
                </div>
                <div className="barkey" aria-hidden="true">
                  <span>
                    {merchantLeg ? "merchant" : "largest leg"} {pct(BigInt((merchantLeg ?? legs[0])?.amount ?? "0"), swept)}
                  </span>
                  <span>
                    {merchantLeg ? "fees" : "other legs"} {pct(swept - BigInt((merchantLeg ?? legs[0])?.amount ?? "0"), swept)}
                  </span>
                </div>
                {reconcile && (
                  <p className="recon">
                    <span className={`st ${CHECK_STATE(reconcile.ok).cls}`}>
                      <i aria-hidden="true" />
                      {reconcile.ok ? "Reconciles to the unit" : "Does not reconcile"}
                    </span>
                  </p>
                )}
                {!merchantLeg && (
                  <p className="lnote">
                    {linkId
                      ? "None of these wallets is a payout wallet listed on the pay link, so no leg can be called the merchant's share."
                      : "Without the pay link, Tender can't say which leg is the merchant's share and which are fees."}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="lrow">
                  <span>In the deposit wallet</span>
                  <i />
                  <b>{payment.amountUsd}</b>
                </div>
                <p className="recon">
                  <span className="st pend">
                    <i aria-hidden="true" />
                    Sweep pending
                  </span>
                </p>
                <p className="lnote">Nothing has left the deposit wallet yet, so there is no split to show. Reload to recompute.</p>
              </>
            )}
          </div>
        </section>
      </div>

      {!linkId && (
        <section className="blk addlink" aria-labelledby="h-add">
          <div className="blk-h">
            <h2 id="h-add">Recompute with the pay link</h2>
            <span>Proves the deposit wallet and the merchant&rsquo;s payout wallet</span>
          </div>
          <LinkForm chain={chain} tx={tx} payer={payer} link="" />
        </section>
      )}

      <div className="d-foot">
        <div>
          <p className="note">Recomputed from chain on every load. Nothing stored.</p>
          <Micro className="sigline" text={`RECOMPUTED FROM CHAIN ON EVERY LOAD · NOTHING STORED · ${v.tag} · ${short(payment.tx, 8, 7)} · ${sweep ? short(sweep.tx, 8, 6) + " · " : ""}`} />
        </div>
        <div className="d-links">
          {linkId && (
            <a className="link" href={hosted(linkId)}>
              Open the pay link →
            </a>
          )}
          <a className="btn sm" href={payment.explorer}>
            View on {R.explorer} <OutArrow />
          </a>
        </div>
      </div>
      {status === "unverified" && (
        <div className="specimen" aria-hidden="true">
          UNVERIFIED
        </div>
      )}
    </article>
  );
}

function LinkForm({ chain, tx, payer, link, withPayer = false }: { chain: Chain; tx: string; payer: string; link: string; withPayer?: boolean }) {
  return (
    <form className="lform" action={`/r/${chain}/${tx}`} method="get">
      {withPayer ? (
        <div className="lf">
          <label className="fl" htmlFor="payer">
            Payer wallet
          </label>
          <input id="payer" name="payer" defaultValue={payer} required spellCheck={false} autoComplete="off" placeholder={chain === "base" ? "0x…" : "Solana address"} />
        </div>
      ) : (
        <input type="hidden" name="payer" value={payer} />
      )}
      <div className="lf">
        <label className="fl" htmlFor="plink">
          Pay link {withPayer ? "(optional)" : ""}
        </label>
        <input id="plink" name="link" defaultValue={link} spellCheck={false} autoComplete="off" placeholder="https://moonpay.hel.io/pay/…" />
      </div>
      <button className="btn sm" type="submit">
        Recompute <Arrow />
      </button>
    </form>
  );
}

function Problem({ chain, tx, payer, link, word: w, code, message }: { chain: Chain; tx: string; payer: string; link: string; word: string; code: string; message: string }) {
  const retry = code === "UNAVAILABLE" || code === "RPC_UNAVAILABLE";
  return (
    <article className="cert doc tone-fail problem">
      <Band seed={sha256Hex(tx)} className="strip band" />
      <div className="d-top">
        <span className="d-title">Tender · certificate of settlement</span>
        <span className="spec-tag fail">NOT ISSUED</span>
      </div>
      <div className="d-head">
        <div>
          <h1 className="verdict fail">
            {w} <FailMark />
          </h1>
          <span className="vword fail">{code}</span>
          <p className="vexpl">{message}</p>
        </div>
      </div>
      <dl className="serialrow">
        <dt>Transaction</dt>
        <dd>{tx}</dd>
      </dl>
      <section className="blk" aria-labelledby="h-fix">
        <div className="blk-h">
          <h2 id="h-fix">{retry ? "Try again" : "Check the details"}</h2>
          <span>Nothing is stored; every load reads the chain again</span>
        </div>
        <LinkForm chain={chain} tx={tx} payer={payer} link={link} withPayer />
      </section>
      <div className="d-foot">
        <div>
          <p className="note">Recomputed from chain on every load. Nothing stored.</p>
          <Micro className="sigline" text={`NOT ISSUED · ${code} · NOTHING STORED · `} />
        </div>
      </div>
    </article>
  );
}
