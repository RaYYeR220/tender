import type { Metadata } from "next";
import Link from "next/link";
import registry from "../../../registry/merchants.json";
import { Band } from "@/components/Band";
import { Seal } from "@/components/Seal";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Arrow, Micro, OutArrow } from "@/components/print";
import { serialGroups } from "@/lib/seal/geometry";
import { sha256Hex } from "@/lib/seal/sha256";
import { REGISTRY_EDIT_URL, REGISTRY_FILE_URL, checkHref, hosted } from "@/lib/site";
import "./merchants.css";

export const metadata: Metadata = {
  title: "Merchants",
  description: "The open registry of MoonPay Commerce merchants whose pay links agents can pay in USDC. Listed by pull request, re-checked live.",
  alternates: { canonical: "/merchants" },
};

interface Listing {
  id: string;
  title: string;
  merchant: string;
  category: string;
  summary: string;
  pricing: string;
  rails: string[];
  tags: string[];
  added: string;
}

const LISTINGS: Listing[] = registry.merchants;
const RAIL_NAME: Record<string, string> = { solana: "Solana", base: "Base" };
const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

const SAMPLE = `{
  "id": "<24-character pay link id>",
  "title": "Flat white",
  "merchant": "Your store",
  "category": "food & drink",
  "summary": "One line an agent can match on.",
  "pricing": "$0.25",
  "rails": ["solana"],
  "tags": ["coffee"],
  "added": "${registry.updated}"
}`;

export default function MerchantsPage() {
  return (
    <>
      <SiteHeader current="merchants" micro={`OPEN REGISTRY · ${LISTINGS.length} LISTINGS · ${LISTINGS.map((m) => m.id).join(" · ")} · LISTED BY PULL REQUEST · `} />
      <main id="main" className="pg-merch" data-surface="registry">
        <section className="sec mtop" aria-labelledby="h-reg">
          <div className="shead">
            <h1 className="h1c" id="h-reg">
              The open registry
            </h1>
            <div>
              <p className="lead">
                MoonPay Commerce pay links that agents can pay in USDC, listed by pull request. Agents search it with <code>find_merchants</code>, and every
                listing is checked again, live, when an agent uses it.
              </p>
              <dl className="regmeta">
                <div>
                  <dt>Listings</dt>
                  <dd>{LISTINGS.length}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{fmtDate(registry.updated)}</dd>
                </div>
                <div>
                  <dt>Machine-readable</dt>
                  <dd>
                    <a href="/registry.json">/registry.json</a>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <div className="wrap">
          <Band seed={sha256Hex(LISTINGS.map((m) => m.id).join(""))} />
        </div>

        <section className="sec ledger-sec" aria-label="Listings">
          <ol className="ledger">
            {LISTINGS.map((m, n) => {
              const seed = sha256Hex(m.id);
              const priced = /^\$\d/.test(m.pricing);
              return (
                <li key={m.id} className="cert lcert">
                  <Band seed={seed} className="strip band" />
                  <div className="lc-top">
                    <span className="rc-title">Certificate of listing · {String(n + 1).padStart(2, "0")}</span>
                    <span className="serialtxt">
                      <span>No.</span>
                      {serialGroups(m.id)}
                    </span>
                  </div>
                  <div className="lc-body">
                    <div className="lc-seal" role="img" aria-label={`Seal drawn from the pay link id of ${m.title}`}>
                      <Seal hex={seed} />
                    </div>
                    <div className="lc-main">
                      <h2>{m.title}</h2>
                      <p className="by">
                        sold by <b>{m.merchant}</b>
                      </p>
                      <p className="sum">{m.summary}</p>
                    </div>
                    <div className={`amt${priced ? "" : " open"}`}>
                      {priced ? (
                        <>
                          <b>{m.pricing.replace(/^\$/, "")}</b>
                          <small>USDC</small>
                        </>
                      ) : (
                        <>
                          <b>{m.pricing}</b>
                          <small>USDC · BUYER SETS</small>
                        </>
                      )}
                    </div>
                  </div>
                  <dl className="lc-facts">
                    <div>
                      <dt>Category</dt>
                      <dd>{m.category}</dd>
                    </div>
                    <div>
                      <dt>Rails</dt>
                      <dd className="rails">
                        {m.rails.map((r) => (
                          <span key={r} className="rail">
                            USDC · {RAIL_NAME[r] ?? r}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt>Tags</dt>
                      <dd>{m.tags.join(" · ") || "—"}</dd>
                    </div>
                    <div>
                      <dt>Listed</dt>
                      <dd>{fmtDate(m.added)}</dd>
                    </div>
                  </dl>
                  <div className="lc-foot">
                    <Micro className="sigline" text={`LISTED · ${m.id} · ${m.merchant} · ${m.title} · USDC · ${m.rails.join(" · ")} · `} />
                    <div className="lc-links">
                      <a className="link" href={hosted(m.id)}>
                        Pay link <OutArrow />
                        <span className="vh"> for {m.title} on MoonPay Commerce</span>
                      </a>
                      <Link className="btn sm" href={checkHref(hosted(m.id))}>
                        Check live <Arrow />
                        <span className="vh"> {m.title}</span>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
            <li className="lcert ghostcert">
              <div className="ghost-in">
                <span className="ghost" aria-hidden="true">
                  +
                </span>
                <div>
                  <h2>Your pay link</h2>
                  <p>One JSON entry, one pull request. It gets its own seal, drawn from its id.</p>
                </div>
                <a className="link" href="#list">
                  How to list it →
                </a>
              </div>
            </li>
          </ol>
        </section>

        <div className="wrap">
          <Micro text="LIST YOUR PAY LINK · CHECK · COPY THE ENTRY · OPEN A PULL REQUEST · RE-CHECKED LIVE ON EVERY USE · registry/merchants.json · " />
        </div>

        <section className="sec" id="list" aria-labelledby="h-list">
          <div className="shead">
            <h2 className="h2" id="h-list">
              List your pay link
            </h2>
            <p className="lead">The registry is one JSON file in the Tender repository. Getting listed takes a passing check and a pull request; no account, no fee.</p>
          </div>
          <div className="listgrid">
            <ol className="lsteps">
              <li>
                <span className="cp-n">I</span>
                <div>
                  <h3>Check the link</h3>
                  <p>
                    Run it through <Link href="/check">the readiness check</Link>. Every check must pass; a warning, such as an unverified merchant, is allowed.
                  </p>
                </div>
              </li>
              <li>
                <span className="cp-n">II</span>
                <div>
                  <h3>Copy the entry</h3>
                  <p>A passing check prints your registry entry. Adjust the category, summary and tags so agents can find you.</p>
                </div>
              </li>
              <li>
                <span className="cp-n">III</span>
                <div>
                  <h3>Open a pull request</h3>
                  <p>
                    Add the entry to the <code>merchants</code> list in <a href={REGISTRY_FILE_URL}>registry/merchants.json</a>. GitHub turns your edit
                    into a pull request.
                  </p>
                </div>
              </li>
              <li>
                <span className="cp-n">IV</span>
                <div>
                  <h3>Checked on every use</h3>
                  <p>A listing is a pointer, not a promise: Tender re-reads the live price and refuses before signing if the link stops passing.</p>
                </div>
              </li>
            </ol>
            <div className="cert json">
              <Band seed="9caf580c3bcbc6f5c985f4d43fa7c862ad460079d9e82f3892feaeaf22d213e8" className="strip band" />
              <div className="json-top">
                <span className="rc-title">Entry format</span>
                <span className="serialtxt">
                  <span>File</span>registry/merchants.json
                </span>
              </div>
              <pre tabIndex={0} aria-label="Registry entry format">
                {SAMPLE}
              </pre>
              <div className="json-foot">
                <a className="btn" href={REGISTRY_EDIT_URL}>
                  Open pull request <Arrow />
                </a>
                <Link className="link" href="/check">
                  Check a link first →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
