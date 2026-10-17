// Pure, deterministic geometry for the intaglio language: rosettes, the mark,
// microprint and microprint rings. Safe on the server and in the browser.

export const TAU = Math.PI * 2;

/** Byte reader over a 64-char hex digest, wrapping around. */
export function bytes(hex: string): (i: number) => number {
  return (i) => parseInt(hex.substr((i * 2) % 64, 2), 16) || 0;
}

export interface RosetteGeometry {
  paths: string[];
  inner: number;
  color: string;
}

/** Small seeded rosette in a 100×100 box (the prototype's `rosette`). */
export function rosette(hex: string, o: { n?: number; k?: number; R?: number; A?: number; col?: string } = {}): RosetteGeometry {
  const b = bytes(hex);
  const n = o.n ?? 5 + (b(0) % 6);
  const k = o.k ?? 9 + (b(1) % 6);
  const R = o.R ?? 30;
  const A = o.A ?? 8 + (b(2) % 4);
  const paths: string[] = [];
  for (let j = 0; j < k; j++) {
    const phi = (TAU * j) / k;
    let d = "";
    for (let t = 0; t <= TAU + 0.001; t += 0.035) {
      const r = R + A * Math.sin(n * t + phi) + 2.2 * Math.sin(3 * n * t - phi);
      d += (t === 0 ? "M" : "L") + (50 + r * Math.cos(t)).toFixed(2) + " " + (50 + r * Math.sin(t)).toFixed(2);
    }
    paths.push(d + "Z");
  }
  return { paths, inner: R - A - 5, color: o.col ?? "#2f5d4a" };
}

/** The Tender mark's inner rosette, in a 26×26 box. */
export function markPath(): string {
  let d = "";
  for (let t = 0; t <= TAU + 0.01; t += 0.02) {
    const r = 6.6 + 2.4 * Math.sin(9 * t);
    d += (t === 0 ? "M" : "L") + (13 + r * Math.cos(t)).toFixed(2) + " " + (13 + r * Math.sin(t)).toFixed(2);
  }
  return d + "Z";
}

/** Repeat a microprint phrase until it overfills any line it sits on. */
export function microprint(text: string, length = 2400): string {
  return text.repeat(Math.ceil(length / Math.max(1, text.length)));
}

/** A microprint ring for a 1000×1000 viewBox. */
export function microRing(r: number, text: string, size: number): { d: string; text: string; textLength: string } {
  const circ = 2 * Math.PI * r;
  const per = size * 0.62;
  const reps = Math.max(1, Math.round(circ / (per * text.length)));
  return { d: `M500 ${500 - r} a${r} ${r} 0 1 1 -0.01 0Z`, text: text.repeat(reps), textLength: (circ - 2).toFixed(1) };
}

/** "6ad323565c71e316b383ea8a" → "6AD3 2356 5C71 E316 B383 EA8A" */
export function serialGroups(id: string): string {
  return id.toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

/** Shorten an address or hash for display: first and last characters. */
export function short(value: string, head = 4, tail = 4): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}
