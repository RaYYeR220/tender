import Link from "next/link";
import { Band } from "./Band";
import { MarkGlyph, Micro } from "./print";
import { LICENSE_URL, MOONPAY_COMMERCE_URL, PAYBOX_URL, REPO_URL, X402_URL } from "@/lib/site";

type Section = "check" | "merchants" | "docs";

const FOOT_SEED = "745548e8464cbc585e98b78a5ef84df50f78edac32e2ce0c9905b03acdbabd66";

export function SiteHeader({ current, micro }: { current?: Section; micro: string }) {
  const cur = (s: Section) => (current === s ? ({ "aria-current": "page" } as const) : {});
  return (
    <header className="nav">
      <Link className="mark" href="/" aria-label="Tender home">
        <MarkGlyph />
        Tender
      </Link>
      <nav aria-label="Main">
        <ul>
          <li><Link href="/check" {...cur("check")}>Check</Link></li>
          <li><Link href="/merchants" {...cur("merchants")}>Merchants</Link></li>
          <li><Link href="/docs" {...cur("docs")}>Docs</Link></li>
          <li className="gh"><a href={REPO_URL}>GitHub</a></li>
        </ul>
      </nav>
      <Micro className="micro" text={micro} />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <Band seed={FOOT_SEED} className="band tall" />
      <div className="row">
        <Link className="mark" href="/" aria-label="Tender home">
          <MarkGlyph />
          Tender
        </Link>
        <nav aria-label="Footer">
          <a href={MOONPAY_COMMERCE_URL}>MoonPay Commerce</a>
          <a href={PAYBOX_URL}>PayBox</a>
          <a href={X402_URL}>x402</a>
          <a href={LICENSE_URL}>MIT</a>
          <a href={REPO_URL}>GitHub</a>
        </nav>
        <p className="disc">Not affiliated with MoonPay.</p>
      </div>
      <Micro text="TENDER · AGENT CHECKOUT · x402 · USDC · BASE · SOLANA · MIT · NOT AFFILIATED WITH MOONPAY · " />
    </footer>
  );
}
