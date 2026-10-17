"use client";

import { useEffect, useRef } from "react";
import { seal } from "@/lib/seal/draw";

/** Compact seal drawn from a hash: a visual checksum, not a security feature. */
export function Seal({ hex }: { hex: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let last = 0;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w === last) return;
      last = w;
      seal(cv, hex);
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, [hex]);
  return <canvas ref={ref} aria-hidden="true" />;
}
