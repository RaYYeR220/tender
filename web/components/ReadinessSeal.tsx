"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { INDEX_ANGLE, readinessBase, readinessRing, ringLayout, type RingState } from "@/lib/seal/draw";
import { microRing } from "@/lib/seal/geometry";

const CHIP_COLOR: Record<RingState, string> = { ok: "#1f3a2f", warn: "#7f5f36", fail: "#b8321f", pending: "#55695e" };

/** Certificate of agent-readiness: one guilloche ring per check, outermost first. */
export function ReadinessSeal({
  id,
  states,
  focus,
  label,
  className = "",
  children,
}: {
  id: string;
  states: RingState[];
  focus: number | null;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const rings = useRef<(HTMLCanvasElement | null)[]>([]);
  const { rings: layout } = ringLayout(states.length);
  const mp = microRing(470, `TENDER · AGENT-READY · ${id} · `, 8);
  const key = states.join(",");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const { rings: spec, sep: seps } = ringLayout(key.split(",").length);
    const st = key.split(",") as RingState[];
    let last = 0;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (!w || w === last) return;
      last = w;
      if (base.current) readinessBase(base.current, w, seps);
      spec.forEach((r, i) => {
        const cv = rings.current[i];
        if (cv) readinessRing(cv, w, r, i, st[i]);
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);

  const mpId = `mp-${id.replace(/[^a-z0-9]/gi, "").slice(0, 24) || "seal"}`;

  return (
    <div ref={box} className={`rseal${focus !== null ? " focus" : ""} ${className}`} role="img" aria-label={label}>
      <canvas ref={base} className="base" />
      <svg className="mp" viewBox="0 0 1000 1000" aria-hidden="true">
        <defs>
          <path id={mpId} d={mp.d} />
        </defs>
        <text className="mptext" fontWeight="500" fontSize="8" fill="#1f3a2f" textLength={mp.textLength} lengthAdjust="spacing">
          <textPath href={`#${mpId}`}>{mp.text}</textPath>
        </text>
      </svg>
      {layout.map((_, i) => (
        <div key={i} className={`rg${focus === i ? " on" : ""}`}>
          <div className="ink" style={{ animationDelay: `${(0.2 + i * 0.17).toFixed(2)}s` }}>
            <canvas
              ref={(el) => {
                rings.current[i] = el;
              }}
            />
          </div>
        </div>
      ))}
      <svg className="chips" viewBox="0 0 1000 1000" aria-hidden="true">
        {layout.map((r, i) => {
          const x = 500 + r.R * Math.cos(INDEX_ANGLE);
          const y = 500 + r.R * Math.sin(INDEX_ANGLE);
          const st = states[i];
          const col = CHIP_COLOR[st];
          return (
            <g key={i}>
              <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="23" fill="#f6f3ea" stroke={col} strokeWidth="2" strokeDasharray={st === "ok" ? undefined : "6 4"} />
              <text className="mptext" x={x.toFixed(1)} y={(y + 8.5).toFixed(1)} textAnchor="middle" fontWeight="500" fontSize="24" fill={col}>
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="rcore">{children}</div>
    </div>
  );
}
