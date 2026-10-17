"use client";

import { useEffect, useRef } from "react";
import { band } from "@/lib/seal/draw";

/** Seeded guilloche braid: section dividers and certificate strips. */
export function Band({ seed, className = "band" }: { seed: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let last = "";
    const ro = new ResizeObserver(([entry]) => {
      const key = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
      if (key === last) return;
      last = key;
      band(cv, seed);
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, [seed]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
