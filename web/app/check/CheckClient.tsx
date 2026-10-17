"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Readiness, ReadinessCheck } from "@/lib/readiness";
import { Band } from "@/components/Band";
import { CopyButton } from "@/components/CopyButton";
import { ReadinessSeal } from "@/components/ReadinessSeal";
import { Seal } from "@/components/Seal";
import { Arrow, FailMark, Micro, OkMark, PendMark, type StState } from "@/components/print";
import type { RingState } from "@/lib/seal/draw";
import { serialGroups } from "@/lib/seal/geometry";
import { sha256Hex } from "@/lib/seal/sha256";
import { EXAMPLES, REGISTRY_EDIT_URL } from "@/lib/site";

type View =
  | { kind: "idle" }
  | { kind: "loading"; link: string }
  | { kind: "done"; link: string; result: Readiness; at: Date; run: number }
  | { kind: "error"; link: string; message: string };

const BAND_SEED = "9caf580c3bcbc6f5c985f4d43fa7c862ad460079d9e82f3892feaeaf22d213e8";
const REG_SEED = "745548e8464cbc585e98b78a5ef84df50f78edac32e2ce0c9905b03acdbabd66";

const EXPECTED = [
  ["Pay link resolves", "The link opens a product on MoonPay Commerce."],
  ["Link is live", "Enabled and accepting payments."],
  ["No customer fields", "No email, name or address to fill in."],
  ["USDC on Solana or Base", "A chain PayBox can pay on."],
  ["Live x402 quote", "MoonPay Commerce quotes an agent payment."],
  ["Verified merchant", "Strict buyers can require it."],
] as const;

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
const word = (n: number) => WORDS[n] ?? String(n);
const RAIL_NAME: Record<string, string> = { solana: "Solana", base: "Base" };
const railName = (r: string) => RAIL_NAME[r] ?? r;

/** Refusal Tender would give for a failing readiness check, where one maps cleanly. */
const REFUSAL: Record<string, string> = { fields: "REQUIRES_CUSTOMER_DETAILS", active: "LINK_INACTIVE", rail: "RAIL_UNAVAILABLE" };

const ST_WORD: Record<ReadinessCheck["state"], string> = { ok: "OK", warn: "Warn", fail: "Fail" };
const ST_CLASS: Record<ReadinessCheck["state"], StState> = { ok: "ok", warn: "warn", fail: "fail" };

function listNumbers(ns: number[]): string {
  if (ns.length === 1) return String(ns[0]);
  return `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}

/** One readiness request. Returns the next view, or null when it was cancelled. */
async function requestCheck(link: string, signal: AbortSignal): Promise<Extract<View, { kind: "done" | "error" }> | null> {
  try {
    const res = await fetch(`/api/check?link=${encodeURIComponent(link)}`, { cache: "no-store", signal });
    const body = (await res.json().catch(() => null)) as (Readiness & { error?: string }) | null;
    if (signal.aborted) return null;
    if (!res.ok || !body || !Array.isArray(body.checks)) {
      return { kind: "error", link, message: body?.error ?? `The check service answered HTTP ${res.status}. Try again in a minute.` };
    }
    return { kind: "done", link, result: body, at: new Date(), run: 0 };
  } catch {
    if (signal.aborted) return null;
    return { kind: "error", link, message: "The check could not reach the server. Check your connection and try again." };
  }
}

export function CheckClient({ initialLink }: { initialLink: string }) {
  const [value, setValue] = useState(initialLink);
  const [view, setView] = useState<View>(() => (initialLink ? { kind: "loading", link: initialLink } : { kind: "idle" }));
  const [focus, setFocus] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const results = useRef<HTMLElement>(null);
  const runs = useRef(0);

  // Starts a request; state changes only in the promise callback, after the network answers.
  const fetchCheck = useCallback((link: string) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    void requestCheck(link, ctl.signal).then((next) => {
      if (!next || ctl.signal.aborted) return;
      if (next.kind === "done") runs.current += 1;
      setView(next.kind === "done" ? { ...next, run: runs.current } : next);
    });
  }, []);

  const run = useCallback(
    (raw: string, scroll: boolean) => {
      const link = raw.trim();
      if (!link) return;
      setFocus(null);
      setView({ kind: "loading", link });
      window.history.replaceState(null, "", `/check?link=${encodeURIComponent(link)}`);
      if (scroll) {
        requestAnimationFrame(() =>
          results.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }),
        );
      }
      fetchCheck(link);
    },
    [fetchCheck],
  );

  // Deep links (/check?link=…) start in the loading state and run once on mount.
  useEffect(() => {
    if (initialLink) fetchCheck(initialLink);
    return () => abort.current?.abort();
  }, [initialLink, fetchCheck]);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(value, true);
  }

  function example(link: string) {
    setValue(link);
    run(link, true);
  }

  const loading = view.kind === "loading";
  const done = view.kind === "done" ? view : null;
  const entry = done?.result.agentReady ? done.result.entry : null;

  return (
    <>
      <section className="sec ctop">
        <div className="shead">
          <h1 className="h1c">Check your pay link</h1>
          <p className="lead">
            Six checks tell you whether an agent can pay your MoonPay Commerce link. Each check is one ring of the seal. A complete seal means the link is
            agent-ready; a failing check leaves its ring broken.
          </p>
        </div>
        <form className="cert cform" onSubmit={submit} action="/check" method="get">
          <div>
            <label className="fl" htmlFor="link">
              Pay link
            </label>
            <input
              id="link"
              name="link"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://moonpay.hel.io/pay/…"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              inputMode="url"
              required
              aria-describedby="link-hint"
            />
            <Micro className="sigline" text="PAY LINK · AGENT-READINESS · RESOLVES · LIVE · FIELDS · RAIL · QUOTE · VERIFIED · " />
            <p className="hint" id="link-hint">
              Paste a pay link or its 24-character id. Checked live against MoonPay Commerce; nothing is stored.
            </p>
            <div className="examples">
              <span>Try</span>
              <button type="button" className="exbtn" onClick={() => example(EXAMPLES.ready.link)} disabled={loading}>
                {EXAMPLES.ready.label}
              </button>
              <button type="button" className="exbtn" onClick={() => example(EXAMPLES.fields.link)} disabled={loading}>
                {EXAMPLES.fields.label}
              </button>
            </div>
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Checking…" : "Check link"} <Arrow />
          </button>
        </form>
      </section>

      <div className="wrap">
        <Band seed={done?.result.product ? sha256Hex(done.result.product.id) : BAND_SEED} />
      </div>

      <section className="sec results" aria-label="Results" ref={results}>
        <p className="vh" aria-live="polite" role="status">
          {view.kind === "loading"
            ? "Checking the pay link live."
            : view.kind === "error"
              ? `Check failed. ${view.message}`
              : done
                ? `${done.result.agentReady ? "Agent-ready" : "Not agent-ready"}. ${done.result.checks.filter((c) => c.state === "fail").length} failing, ${done.result.checks.filter((c) => c.state === "warn").length} warnings.`
                : ""}
        </p>
        {view.kind === "idle" && <Specimen />}
        {view.kind === "loading" && <Loading link={view.link} />}
        {view.kind === "error" && <ErrorCert link={view.link} message={view.message} onRetry={() => run(view.link, false)} />}
        {done && <Result key={done.run} view={done} focus={focus} setFocus={setFocus} />}
      </section>

      {entry && done?.result.product && (
        <>
          <div className="wrap">
            <Band seed={REG_SEED} />
          </div>
          <Registry entry={entry} id={done.result.product.id} merchant={done.result.product.merchant.name} />
        </>
      )}
    </>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return (
    <div className="crows" role="table" aria-label="Checks">
      <div className="chdr" role="row">
        <span role="columnheader">Ring</span>
        <span role="columnheader">State</span>
        <span role="columnheader">Check</span>
        <span role="columnheader">Fix</span>
      </div>
      {children}
    </div>
  );
}

function Result({ view, focus, setFocus }: { view: Extract<View, { kind: "done" }>; focus: number | null; setFocus: (n: number | null) => void }) {
  const { result, at } = view;
  const { product, checks, quote, agentReady } = result;
  const id = product?.id ?? "";
  const seed = sha256Hex(id || view.link);
  const states = checks.map((c) => c.state as RingState);
  const fails = checks.map((c, i) => (c.state === "fail" ? i + 1 : 0)).filter(Boolean);
  const warns = checks.map((c, i) => (c.state === "warn" ? i + 1 : 0)).filter(Boolean);
  const oks = checks.filter((c) => c.state === "ok").length;
  const dynamic = product?.pricing.mode === "dynamic";
  const code = checks.map((c) => (c.state === "fail" ? REFUSAL[c.id] : undefined)).find(Boolean);
  const fieldsIdx = checks.findIndex((c) => c.id === "fields" && c.state === "fail");
  const fieldsRing = fieldsIdx >= 0 ? fieldsIdx + 1 : 0;
  const date = at.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  let summary: string;
  if (agentReady) {
    const rails = [...new Set(quote.map((q) => railName(q.rail)))].join(" or ") || product?.rails.map(railName).join(" or ") || "Solana";
    summary = dynamic
      ? `Agents can pay this link in USDC on ${rails}; the buyer picks the amount.`
      : `Agents can pay this link: ${quote[0]?.amountUsd ?? "the listed price"} in USDC on ${rails}.`;
    if (warns.length) {
      const w = checks.filter((c) => c.state === "warn");
      summary +=
        w.length === 1 && w[0].id === "verified"
          ? " One warning: the merchant isn't verified, and strict buyers can refuse it."
          : ` ${word(w.length)} warning${w.length > 1 ? "s" : ""}: ${w.map((c) => c.label.toLowerCase()).join(", ")}.`;
    }
  } else {
    summary = `${word(fails.length)} check${fails.length === 1 ? " fails" : "s fail"}. Tender refuses this link${code ? ` with ${code}` : ""} before any proposal is made.`;
  }

  const cap = agentReady
    ? warns.length
      ? `Ring ${listNumbers(warns)} ${warns.length > 1 ? "are" : "is"} dotted for a warning. Ring 1 is the outermost.`
      : "Every ring is closed. Ring 1 is the outermost. Drawn from the pay link's hash."
    : `Ring${fails.length > 1 ? "s" : ""} ${listNumbers(fails)} ${fails.length > 1 ? "are" : "is"} broken. Fix ${fails.length > 1 ? "them" : "it"} and the seal closes.`;

  const sealLabel = `Seal with ${checks.length} ring${checks.length > 1 ? "s" : ""}: ${oks} complete${warns.length ? `, ${warns.length} dotted for a warning` : ""}${fails.length ? `, ${fails.length} broken for a failed check` : ""}`;

  return (
    <div>
      <div className="rlabel">
        <h2>{product ? `${product.name} · ${product.merchant.name}` : "Pay link"}</h2>
        <span>{id || view.link}</span>
      </div>
      <article className={`cert rcert${agentReady ? "" : " fail-cert"}`} aria-label={`Readiness certificate, ${agentReady ? "agent-ready" : "not agent-ready"}`}>
        <Band seed={seed} className="strip band" />
        <div className="rc-top">
          <span className="rc-title">Certificate of agent-readiness</span>
          <span className="serialtxt">
            <span>No.</span>
            {id ? serialGroups(id) : "not issued"}
          </span>
        </div>
        <div className="rgrid">
          <div>
            <ReadinessSeal id={id || "pay link"} states={states} focus={focus} label={sealLabel}>
              <div>
                {agentReady ? (
                  <b>Ready</b>
                ) : (
                  <b className="two">
                    Not
                    <br />
                    ready
                  </b>
                )}
                <small>
                  {agentReady ? `${oks} ✓${warns.length ? ` · ${warns.length} !` : ""}` : `${fails.length} ✗`}
                </small>
              </div>
            </ReadinessSeal>
            <p className="sealcap">{cap}</p>
          </div>
          <div>
            <p className="verdict">
              {agentReady ? "Agent-ready" : "Not agent-ready"} {agentReady ? <OkMark className="vmark" /> : <FailMark className="vmark" />}
            </p>
            <p className="vsub">{summary}</p>
            {quote.length > 0 && (
              <div className="quotes" aria-label="Live x402 quote">
                {quote.map((q) => (
                  <div className="qbox" key={q.rail}>
                    <b>{q.amountUsd.replace(/^\$/, "")}</b>
                    <small>USDC · {railName(q.rail).toUpperCase()}</small>
                    <span>{dynamic ? "probe amount" : q.feeUsd && q.feeUsd !== "$0.00" ? `incl. ${q.feeUsd} fees` : "no added fees"}</span>
                  </div>
                ))}
              </div>
            )}
            <Rows>
              {checks.map((c, i) => (
                <div
                  key={c.id}
                  className={`crow ${c.state}`}
                  role="row"
                  onMouseEnter={() => setFocus(i)}
                  onMouseLeave={() => setFocus(null)}
                >
                  <span className="chip" role="cell">
                    {i + 1}
                  </span>
                  <span className={`st ${ST_CLASS[c.state]}`} role="cell">
                    <i aria-hidden="true" />
                    {ST_WORD[c.state]}
                  </span>
                  <div className="cbody" role="cell">
                    <span className="cl">{c.label}</span>
                    <span className="cd">{c.detail}</span>
                  </div>
                  <span className="cf" role="cell">
                    {c.fix ?? (c.state === "ok" ? "—" : c.id === "x402" && fieldsRing ? `Clears once ring ${fieldsRing} is fixed; re-run the check.` : "")}
                  </span>
                </div>
              ))}
            </Rows>
          </div>
        </div>
        <div className="rfoot">
          <Micro
            className="sigline"
            text={`${agentReady ? "AGENT-READY" : "NOT AGENT-READY"} · ${id || "PAY LINK"} · ${fails.map((n) => `RING ${n} BROKEN`).join(" · ") || "USDC · x402"} · `}
          />
          <span>
            Checked live · {date} · {agentReady ? "eligible for the registry" : "not eligible for the registry yet"}
          </span>
        </div>
      </article>
    </div>
  );
}

function Loading({ link }: { link: string }) {
  return (
    <div aria-busy="true">
      <div className="rlabel">
        <h2>Checking…</h2>
        <span>{link}</span>
      </div>
      <article className="cert rcert" aria-label="Readiness certificate, checking">
        <Band seed={BAND_SEED} className="strip band" />
        <div className="rc-top">
          <span className="rc-title">Certificate of agent-readiness</span>
          <span className="serialtxt">
            <span>No.</span>pending
          </span>
        </div>
        <div className="rgrid">
          <div>
            <ReadinessSeal id="checking" states={EXPECTED.map(() => "pending")} focus={null} label="Seal drawing while the checks run" className="loading">
              <div>
                <b>Wait</b>
                <small>LIVE</small>
              </div>
            </ReadinessSeal>
            <p className="sealcap">Each ring draws in as its check comes back.</p>
          </div>
          <div>
            <p className="verdict">
              Checking <PendMark className="vmark" />
            </p>
            <p className="vsub">Reading the pay link from MoonPay Commerce and asking for a live x402 quote. This takes a few seconds.</p>
            <Rows>
              {EXPECTED.map(([label, detail], i) => (
                <div key={label} className="crow pend" role="row">
                  <span className="chip" role="cell">
                    {i + 1}
                  </span>
                  <span className="st pend" role="cell">
                    <i aria-hidden="true" />
                    Wait
                  </span>
                  <div className="cbody" role="cell">
                    <span className="cl">{label}</span>
                    <span className="cd">{detail}</span>
                  </div>
                  <span className="cf" role="cell" />
                </div>
              ))}
            </Rows>
          </div>
        </div>
        <div className="rfoot">
          <Micro className="sigline" text="CHECKING LIVE · MOONPAY COMMERCE · x402 QUOTE · NOTHING STORED · " />
          <span>Checking live · nothing stored</span>
        </div>
      </article>
    </div>
  );
}

function Specimen() {
  return (
    <div>
      <div className="rlabel">
        <h2>Six checks, one ring each</h2>
        <span>awaiting a pay link</span>
      </div>
      <article className="cert rcert idle" aria-label="Readiness certificate, not yet issued">
        <Band seed={BAND_SEED} className="strip band" />
        <div className="rc-top">
          <span className="rc-title">Certificate of agent-readiness</span>
          <span className="serialtxt">
            <span>No.</span>not issued
          </span>
        </div>
        <div className="rgrid">
          <div>
            <ReadinessSeal id="awaiting a pay link" states={EXPECTED.map(() => "pending")} focus={null} label="Unissued seal with six rings, one per check">
              <div>
                <b>Blank</b>
                <small>6 RINGS</small>
              </div>
            </ReadinessSeal>
            <p className="sealcap">Ring 1 is the outermost. Each one is drawn when its check passes.</p>
          </div>
          <div>
            <p className="verdict">Not yet checked</p>
            <p className="vsub">Paste a pay link above, or try one of the two examples. These are the checks an agent runs before it pays:</p>
            <Rows>
              {EXPECTED.map(([label, detail], i) => (
                <div key={label} className="crow idle" role="row">
                  <span className="chip" role="cell">
                    {i + 1}
                  </span>
                  <span className="st idle" role="cell">
                    <i aria-hidden="true" />
                    <span className="vh">Not checked</span>
                  </span>
                  <div className="cbody" role="cell">
                    <span className="cl">{label}</span>
                    <span className="cd">{detail}</span>
                  </div>
                  <span className="cf" role="cell" />
                </div>
              ))}
            </Rows>
          </div>
        </div>
        <div className="rfoot">
          <Micro className="sigline" text="NOT ISSUED · PASTE A PAY LINK · SIX CHECKS · ONE RING EACH · " />
          <span>Checked live against MoonPay Commerce · nothing stored</span>
        </div>
      </article>
    </div>
  );
}

function ErrorCert({ link, message, onRetry }: { link: string; message: string; onRetry: () => void }) {
  return (
    <div>
      <div className="rlabel">
        <h2>Could not check this link</h2>
        <span>{link}</span>
      </div>
      <article className="cert rcert fail-cert" aria-label="Readiness check failed">
        <Band seed={BAND_SEED} className="strip band" />
        <div className="rc-top">
          <span className="rc-title">Certificate of agent-readiness</span>
          <span className="serialtxt">
            <span>No.</span>not issued
          </span>
        </div>
        <div className="errbody">
          <p className="verdict">
            No answer <FailMark className="vmark" />
          </p>
          <p className="vsub">{message}</p>
          <button type="button" className="btn sm" onClick={onRetry}>
            Try again <Arrow />
          </button>
        </div>
        <div className="rfoot">
          <Micro className="sigline" text="NOT ISSUED · NO ANSWER · TRY AGAIN · " />
          <span>Nothing was stored</span>
        </div>
      </article>
    </div>
  );
}

function Registry({ entry, id, merchant }: { entry: Record<string, unknown>; id: string; merchant: string }) {
  const json = JSON.stringify(entry, null, 2);
  const seed = sha256Hex(id);
  return (
    <section className="sec" id="registry" aria-labelledby="h-reg">
      <div className="shead">
        <h2 className="h2" id="h-reg">
          List it in the open registry
        </h2>
        <p className="lead">
          This entry comes straight from the passing check above. Open a pull request and agents will find {merchant} through{" "}
          <span className="mono" style={{ fontSize: 15 }}>
            find_merchants
          </span>
          .
        </p>
      </div>
      <div className="regrid">
        <div className="cert json">
          <Band seed={seed} className="strip band" />
          <div className="json-top">
            <span className="rc-title">Registry entry</span>
            <span className="serialtxt">
              <span>No.</span>
              {serialGroups(id)}
            </span>
          </div>
          <pre aria-label="Registry entry JSON" tabIndex={0}>
            <JsonLines value={entry} />
          </pre>
        </div>
        <aside className="regside">
          <div className="minseal" role="img" aria-label={`${merchant}'s registry seal, drawn from its pay link id`}>
            <Seal hex={seed} />
          </div>
          <p className="cap">{merchant}&rsquo;s registry seal, drawn from its pay link id. Every listing gets its own.</p>
          <div className="btns">
            <a className="btn" href={REGISTRY_EDIT_URL}>
              Open pull request <Arrow />
            </a>
            <CopyButton text={json} />
          </div>
          <p className="note">
            Copy the entry, then add it to the <span className="mono">merchants</span> list in the file GitHub opens. Adjust the category, summary and tags
            first; GitHub turns your edit into a pull request.
          </p>
        </aside>
      </div>
    </section>
  );
}

/** Line-numbered, lightly highlighted JSON. Values are rendered as text only. */
function JsonLines({ value }: { value: Record<string, unknown> }) {
  const keys = Object.keys(value);
  return (
    <>
      <span className="l">
        <span className="p">{"{"}</span>
      </span>
      {keys.map((k, i) => {
        const v = value[k];
        const comma = i < keys.length - 1 ? <span className="p">,</span> : null;
        let rendered: ReactNode;
        if (Array.isArray(v)) {
          rendered = (
            <>
              <span className="p">[</span>
              {v.map((x, j) => (
                <span key={j}>
                  {JSON.stringify(x)}
                  {j < v.length - 1 ? <span className="p">, </span> : null}
                </span>
              ))}
              <span className="p">]</span>
            </>
          );
        } else rendered = JSON.stringify(v);
        return (
          <span className="l" key={k}>
            {"  "}
            <span className="k">{JSON.stringify(k)}</span>
            <span className="p">:</span> {rendered}
            {comma}
          </span>
        );
      })}
      <span className="l">
        <span className="p">{"}"}</span>
      </span>
    </>
  );
}
