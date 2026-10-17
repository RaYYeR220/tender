"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { heroSeal } from "@/lib/seal/draw";
import { microRing } from "@/lib/seal/geometry";

const OUTER = microRing(474, "TENDER · AGENT CHECKOUT · x402 · USDC · BASE · SOLANA · ", 8.6);

/** The hero's deep object: a guilloche seal drawn from the hash of a real pay link. */
export function HeroSeal({ hex, id, amount, unit, label, children }: { hex: string; id: string; amount: string; unit: string; label: string; children?: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const ca = useRef<HTMLCanvasElement>(null);
  const cb = useRef<HTMLCanvasElement>(null);
  const inner = microRing(178, `${id} · `, 7.4);

  useEffect(() => {
    const el = stage.current;
    if (!el || !ca.current || !cb.current) return;
    let last = 0;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (!w || w === last) return;
      last = w;
      heroSeal(ca.current!, cb.current!, w, hex);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hex]);

  return (
    <div className="stage" ref={stage}>
      <div className="seal" role="img" aria-label={label}>
        <div className="lay layA">
          <div className="ink">
            <canvas ref={ca} />
            <svg viewBox="0 0 1000 1000" aria-hidden="true">
              <defs>
                <path id="mpA" d={OUTER.d} />
              </defs>
              <text className="mptext" fontWeight="500" fontSize="8.6" fill="#1f3a2f" textLength={OUTER.textLength} lengthAdjust="spacing">
                <textPath href="#mpA">{OUTER.text}</textPath>
              </text>
            </svg>
          </div>
        </div>
        <div className="lay layB">
          <div className="ink">
            <canvas ref={cb} />
            <svg viewBox="0 0 1000 1000" aria-hidden="true">
              <defs>
                <path id="mpB" d={inner.d} />
              </defs>
              <text className="mptext" fontWeight="500" fontSize="7.4" fill="#2f5d4a" textLength={inner.textLength} lengthAdjust="spacing">
                <textPath href="#mpB">{inner.text}</textPath>
              </text>
            </svg>
          </div>
        </div>
        <div className="core">
          <div>
            <b>{amount}</b>
            <small>{unit}</small>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
