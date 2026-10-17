"use client";

import { useEffect, useRef, useState } from "react";

/** Copies text to the clipboard and says so, in words. */
export function CopyButton({ text, label = "Copy entry", className = "btn sm line" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("fail");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }

  return (
    <button type="button" className={className} onClick={copy}>
      <span aria-live="polite">{state === "done" ? "Copied ✓" : state === "fail" ? "Select and copy it" : label}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5.5" y="5.5" width="7" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3.5 10.5v-8h6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </button>
  );
}
