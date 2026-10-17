import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import registry from "../../registry/merchants.json";
import { heroSealSvg } from "@/lib/seal/svg";
import { sha256Hex } from "@/lib/seal/sha256";

export const alt = "Tender: any MoonPay Commerce checkout, paid by your agent. A guilloche seal drawn from a real pay link.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HERO = registry.merchants[0];

export default async function Image() {
  const dir = join(process.cwd(), "assets", "og");
  const [regular, italic, mono] = await Promise.all([
    readFile(join(dir, "Fraunces-144-Regular.ttf")),
    readFile(join(dir, "Fraunces-144-Italic.ttf")),
    readFile(join(dir, "IBMPlexMono-Medium.ttf")),
  ]);
  const hash = sha256Hex(HERO.id);
  const seal = `data:image/svg+xml;base64,${Buffer.from(heroSealSvg(hash)).toString("base64")}`;
  const ink = "#14231c";
  const green = "#2f5d4a";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#efece2", padding: 26 }}>
        <div style={{ flex: 1, display: "flex", border: "1.5px solid #1f3a2f", padding: 5 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              border: "1px solid #1f3a2f",
              background: "#f6f3ea",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640, padding: "54px 0 46px 56px" }}>
              <div style={{ display: "flex", alignItems: "center", fontFamily: "Plex", fontSize: 17, letterSpacing: 2.4, color: green }}>
                <div style={{ width: 34, height: 1.5, background: green, marginRight: 14 }} />
                PAYBOX PLUGIN · MOONPAY COMMERCE · x402
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Fraunces", fontSize: 78, lineHeight: 0.98, letterSpacing: -3, color: ink }}>
                <span>Any MoonPay Commerce checkout,&nbsp;</span>
                <span style={{ fontFamily: "FrauncesItalic", color: green, marginRight: 6 }}>paid</span>
                <span>&nbsp;by your agent.</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 40, letterSpacing: -1, color: ink }}>Tender</div>
                <div style={{ display: "flex", marginTop: 10, fontFamily: "Plex", fontSize: 15, letterSpacing: 1.2, color: "#55695e" }}>
                  GUARDED USDC CHECKOUT · RECEIPTS FROM CHAIN
                </div>
              </div>
            </div>
            <div style={{ position: "absolute", right: -34, top: 64, width: 500, height: 500, display: "flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={seal} width={500} height={500} alt="" />
              <div
                style={{
                  position: "absolute",
                  left: 197,
                  top: 197,
                  width: 106,
                  height: 106,
                  borderRadius: 53,
                  background: "#f6f3ea",
                  border: "1.5px solid #1f3a2f",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 34, letterSpacing: -1.5, color: ink }}>{HERO.pricing.replace(/^\$/, "")}</div>
                <div style={{ display: "flex", marginTop: 4, fontFamily: "Plex", fontSize: 9, letterSpacing: 2, color: green }}>USDC · SOL</div>
              </div>
            </div>
            <div style={{ position: "absolute", right: 30, top: 22, display: "flex", fontFamily: "Plex", fontSize: 15, letterSpacing: 2.2, color: "#b8321f" }}>
              No. TND {HERO.pricing.replace(/[$.]/g, "").padStart(4, "0")} {HERO.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: regular, style: "normal", weight: 400 },
        { name: "FrauncesItalic", data: italic, style: "italic", weight: 400 },
        { name: "Plex", data: mono, style: "normal", weight: 500 },
      ],
    },
  );
}
