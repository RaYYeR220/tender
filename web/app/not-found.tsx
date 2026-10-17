import Link from "next/link";
import { Band } from "@/components/Band";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Arrow, Micro } from "@/components/print";
import "./not-found.css";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <>
      <SiteHeader micro="NOT FOUND · NO SUCH CERTIFICATE · NOTHING ISSUED · NOTHING STORED · " />
      <main id="main" className="pg-404">
        <section className="sec">
          <div className="cert nf">
            <Band seed="b8321f0000000000000000000000000000000000000000000000000000000404" className="strip band" />
            <div className="nf-top">
              <span className="nf-title">Tender · certificate</span>
              <span className="serialtxt">
                <span>No.</span>404
              </span>
            </div>
            <div className="nf-body">
              <h1>No such certificate</h1>
              <p>
                This page was never issued. If you followed a receipt link, check that it has the right chain, transaction and{" "}
                <span className="mono">?payer=</span>.
              </p>
              <div className="nf-links">
                <Link className="btn" href="/">
                  Back to Tender <Arrow />
                </Link>
                <Link className="link" href="/check">
                  Check a pay link →
                </Link>
                <Link className="link" href="/merchants">
                  Browse the registry →
                </Link>
              </div>
            </div>
            <Micro className="sigline nf-sig" text="NOT ISSUED · 404 · NO SUCH CERTIFICATE · " />
            <div className="void" aria-hidden="true">
              VOID
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
