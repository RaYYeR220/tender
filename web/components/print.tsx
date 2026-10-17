import type { ReactNode } from "react";
import { markPath, microprint, rosette } from "@/lib/seal/geometry";

// Server-rendered pieces of the intaglio language: no client JavaScript.

const MARK_D = markPath();

export function MarkGlyph() {
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="12" fill="none" stroke="#1f3a2f" />
      <circle cx="13" cy="13" r="9.5" fill="none" stroke="#1f3a2f" strokeWidth=".6" />
      <path d={MARK_D} fill="none" stroke="#2f5d4a" strokeWidth=".55" />
    </svg>
  );
}

/** A line of microprint. Decorative, so hidden from assistive tech. */
export function Micro({ text, className = "mrule" }: { text: string; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {microprint(text)}
    </div>
  );
}

/** Small seeded rosette (100×100 viewBox). */
export function Rosette({ seed, className }: { seed: string; className?: string }) {
  const g = rosette(seed);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="#1f3a2f" strokeWidth=".9" />
      <circle cx="50" cy="50" r="45.5" fill="none" stroke="#1f3a2f" strokeWidth=".5" />
      {g.paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={g.color} strokeWidth=".45" opacity=".75" />
      ))}
      <circle cx="50" cy="50" r={g.inner} fill="none" stroke="#8a6a3f" strokeWidth=".5" opacity=".8" />
    </svg>
  );
}

export type StState = "ok" | "warn" | "fail" | "pend";

/** Status: glyph + word, never colour alone. */
export function St({ state, children, as: Tag = "span" }: { state: StState; children: ReactNode; as?: "span" | "li" }) {
  return (
    <Tag className={`st ${state}`}>
      <i aria-hidden="true" />
      {children}
    </Tag>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function OutArrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** Verdict marks: a closed double ring with a tick, or a dashed red ring with a cross. */
export function OkMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#2f5d4a" strokeWidth=".9" />
      <circle cx="20" cy="20" r="16.2" fill="none" stroke="#2f5d4a" strokeWidth=".5" />
      <path d="M12.5 20.5l5 5 10-11" fill="none" stroke="#2f5d4a" strokeWidth="1.6" />
    </svg>
  );
}

export function FailMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="none" stroke="#b8321f" strokeDasharray="3 2.4" />
      <path d="M14 14l12 12M26 14 14 26" stroke="#b8321f" strokeWidth="1.6" />
    </svg>
  );
}

export function PendMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="none" stroke="#8a6a3f" strokeDasharray="1.2 2.6" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="15" fill="none" stroke="#8a6a3f" strokeWidth=".5" />
      <path d="M20 11v9l6 4" fill="none" stroke="#7f5f36" strokeWidth="1.5" />
    </svg>
  );
}
