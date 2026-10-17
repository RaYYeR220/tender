// The hero seal as a static SVG string, for the Open Graph card (no canvas there).
import { TAU, bytes } from "./geometry";

interface Ring {
  R: number;
  A: number;
  n: number;
  B?: number;
  m?: number;
  sp?: number;
  k: number;
  col: string;
  a: number;
  w: number;
  step: number;
}

function ring(o: Ring): string {
  const st = (o.step * Math.PI) / 180;
  let d = "";
  for (let j = 0; j < o.k; j++) {
    const phi = (TAU * j) / o.k;
    for (let t = 0; t <= TAU + st / 2; t += st) {
      const r = o.R + o.A * Math.sin(o.n * t + phi) + (o.B ?? 0) * Math.sin((o.m ?? 0) * t - (o.sp ?? 1) * phi);
      d += `${t === 0 ? "M" : "L"}${(500 + r * Math.cos(t)).toFixed(1)} ${(500 + r * Math.sin(t)).toFixed(1)}`;
    }
    d += "Z";
  }
  return `<path d="${d}" fill="none" stroke="${o.col}" stroke-opacity="${o.a}" stroke-width="${o.w}" stroke-linejoin="round"/>`;
}

function circle(R: number, col: string, w: number, a: number): string {
  return `<circle cx="500" cy="500" r="${R}" fill="none" stroke="${col}" stroke-opacity="${a}" stroke-width="${w}"/>`;
}

function epi(lobes: number, size: number, dd: number, k: number, col: string, a: number, w: number): string {
  const r = (size - dd) / (lobes + 1);
  const R = lobes * r;
  let d = "";
  for (let j = 0; j < k; j++) {
    const rot = (TAU / lobes) * (j / k);
    for (let t = 0; t <= TAU + 0.002; t += 0.01) {
      const x = (R + r) * Math.cos(t) - dd * Math.cos(((R + r) / r) * t);
      const y = (R + r) * Math.sin(t) - dd * Math.sin(((R + r) / r) * t);
      const xr = x * Math.cos(rot) - y * Math.sin(rot);
      const yr = x * Math.sin(rot) + y * Math.cos(rot);
      d += `${t === 0 ? "M" : "L"}${(500 + xr).toFixed(1)} ${(500 + yr).toFixed(1)}`;
    }
    d += "Z";
  }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${a}" stroke-width="${w}"/>`;
}

export function heroSealSvg(hex: string): string {
  const b = bytes(hex);
  const rope = 54 + (b(0) % 4) * 6;
  const lace = 16 + (b(2) % 4) * 2;
  const petal = 7 + (b(4) % 5);
  const w = 1.25;
  const parts = [
    circle(494, "#1f3a2f", w * 2, 0.85),
    circle(486, "#1f3a2f", w, 0.6),
    ring({ R: 452, A: 12, n: rope, B: 3, m: rope * 3, sp: 2, k: 10, col: "#1f3a2f", a: 0.55, w, step: 0.5 }),
    circle(432, "#1f3a2f", w, 0.55),
    ring({ R: 386, A: 30, n: lace, B: 9, m: lace * 3, sp: 1, k: 26, col: "#2f5d4a", a: 0.4, w, step: 0.9 }),
    circle(345, "#1f3a2f", w * 1.4, 0.6),
    circle(338, "#1f3a2f", w, 0.4),
    ring({ R: 250, A: 78, n: petal, B: 12, m: petal * 4, sp: 1, k: 30, col: "#2f5d4a", a: 0.4, w, step: 1 }),
    circle(172, "#1f3a2f", w, 0.5),
    ring({ R: 154, A: 10, n: 28 + (b(6) % 4) * 4, k: 9, col: "#8a6a3f", a: 0.6, w, step: 0.6 }),
    epi(11 + (b(7) % 5), 132, 38, 7, "#1f3a2f", 0.5, w),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">${parts.join("")}</svg>`;
}
