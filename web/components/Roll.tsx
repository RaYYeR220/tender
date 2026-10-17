"use client";

import { useEffect, useRef } from "react";

/** A serial that rolls digit by digit into place on load. Static under reduced motion. */
export function Roll({ text, ms = 1200, className }: { text: string; ms?: number; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current?.firstChild;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const locked = i / text.length < p * 1.15;
        out += /[0-9A-Za-z]/.test(ch) && !locked ? "0123456789ABCDEF"[Math.floor(Math.random() * 16)] : ch;
      }
      node.nodeValue = out;
      if (p < 1) raf = requestAnimationFrame(frame);
      else node.nodeValue = text;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      node.nodeValue = text;
    };
  }, [text, ms]);
  return (
    <b ref={ref} className={`roll${className ? ` ${className}` : ""}`}>
      {text}
    </b>
  );
}
