import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { CheckClient } from "./CheckClient";
import "./check.css";

export const metadata: Metadata = {
  title: "Check your pay link",
  description: "Six live checks tell you whether an agent can pay your MoonPay Commerce pay link, with a fix for every failure and a registry entry when it passes.",
  alternates: { canonical: "/check" },
};

export default async function CheckPage({ searchParams }: PageProps<"/check">) {
  const { link } = await searchParams;
  const initial = typeof link === "string" ? link.trim().slice(0, 300) : "";
  return (
    <>
      <SiteHeader current="check" micro="CERTIFICATE OF AGENT-READINESS · SIX CHECKS · ONE RING EACH · RESOLVES · LIVE · FIELDS · RAIL · QUOTE · VERIFIED · " />
      <main id="main" className="pg-check" data-surface="check">
        <CheckClient initialLink={initial} />
      </main>
      <SiteFooter />
    </>
  );
}
