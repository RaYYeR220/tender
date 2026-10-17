// Canvas guilloche drawing, ported from the V03 intaglio kit. Browser only.
import { TAU, bytes } from "./geometry";

type Ctx = CanvasRenderingContext2D;

export interface RingOptions {
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
  step?: number;
  rot?: number;
  dash?: number[];
  /** [from, to] in radians: leaves the ring broken. */
  gap?: [number, number];
}

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

function fit(cv: HTMLCanvasElement) {
  const r = cv.getBoundingClientRect();
  const d = dpr();
  cv.width = Math.max(1, Math.round(r.width * d));
  cv.height = Math.max(1, Math.round(r.height * d));
  const c = cv.getContext("2d")!;
  c.setTransform(d, 0, 0, d, 0, 0);
  c.lineJoin = "round";
  return { c, w: r.width, h: r.height, dpr: d };
}

/** Polar guilloche ring, drawn k times with shifted phase. */
export function ring(ctx: Ctx, c: number, s: number, o: RingOptions) {
  ctx.strokeStyle = o.col;
  ctx.globalAlpha = o.a;
  ctx.lineWidth = o.w;
  ctx.setLineDash(o.dash ?? []);
  const st = ((o.step ?? 0.25) * Math.PI) / 180;
  for (let j = 0; j < o.k; j++) {
    const phi = (TAU * j) / o.k;
    let pen = false;
    ctx.beginPath();
    for (let t = 0; t <= TAU + st / 2; t += st) {
      const tt = (t + (o.rot ?? 0)) % TAU;
      if (o.gap && tt > o.gap[0] && tt < o.gap[1]) {
        pen = false;
        continue;
      }
      const r = (o.R + o.A * Math.sin(o.n * t + phi) + (o.B ?? 0) * Math.sin((o.m ?? 0) * t - (o.sp ?? 1) * phi)) * s;
      const x = c + r * Math.cos(tt);
      const y = c + r * Math.sin(tt);
      if (!pen) {
        ctx.moveTo(x, y);
        pen = true;
      } else ctx.lineTo(x, y);
    }
    if (!o.gap) ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export function circle(ctx: Ctx, c: number, s: number, R: number, col: string, w: number, a: number, dash?: number[]) {
  ctx.globalAlpha = a;
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.arc(c, c, R * s, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Epitrochoid rosette at the centre of a seal. */
export function epi(ctx: Ctx, c: number, s: number, o: { lobes: number; size: number; d: number; k: number; col: string; a: number; w: number }) {
  ctx.strokeStyle = o.col;
  ctx.globalAlpha = o.a;
  ctx.lineWidth = o.w;
  const L = o.lobes;
  const d = o.d;
  const r = (o.size - d) / (L + 1);
  const R = L * r;
  for (let j = 0; j < o.k; j++) {
    const rot = (TAU / L) * (j / o.k);
    ctx.beginPath();
    for (let t = 0; t <= TAU + 0.002; t += 0.004) {
      const x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
      const y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
      const xr = x * Math.cos(rot) - y * Math.sin(rot);
      const yr = x * Math.sin(rot) + y * Math.cos(rot);
      if (t === 0) ctx.moveTo(c + xr * s, c + yr * s);
      else ctx.lineTo(c + xr * s, c + yr * s);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/** Horizontal guilloche braid: the banknote border. */
export function band(cv: HTMLCanvasElement, hex: string) {
  const b = bytes(hex);
  const { c, w, h, dpr: d } = fit(cv);
  if (w < 2 || h < 2) return;
  const hair = (Math.max(0.5, 0.5 * d) / d) * 1.1;
  const rule = (y: number, a: number, lw: number) => {
    c.globalAlpha = a;
    c.strokeStyle = "#1f3a2f";
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  };
  const small = h < 20;
  if (!small) {
    rule(0.5, 0.7, 1);
    rule(3.5, 0.45, 0.6);
    rule(h - 0.5, 0.7, 1);
    rule(h - 3.5, 0.45, 0.6);
  }
  const mid = h / 2;
  const A = small ? (h / 2 - 1.2) * 0.78 : (h / 2 - 8) * 0.66;
  const B = A * 0.28;
  const lam = 46 + (b(0) % 5) * 7;
  const k = 9 + (b(1) % 4) * 2;
  const ph = (b(2) / 255) * TAU;
  const braid = (lam: number, k: number, A: number, B: number, col: string, a: number, lw: number, m: number) => {
    c.strokeStyle = col;
    c.globalAlpha = a;
    c.lineWidth = lw;
    for (let j = 0; j < k; j++) {
      const phi = (TAU * j) / k + ph;
      c.beginPath();
      for (let x = 0; x <= w + 1; x += 1) {
        const t = (TAU * x) / lam;
        const y = mid + A * Math.sin(t + phi) + B * Math.sin(m * t - 2 * phi);
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  };
  braid(lam, k, A, B, "#2f5d4a", 0.42, hair, 3);
  braid(lam * 1.618, Math.max(5, k - 4), A * 0.92, B * 0.6, "#7f9a8c", 0.42, hair, 2);
  c.globalAlpha = 1;
}

/** Compact seal: a visual checksum of a hash. */
export function seal(cv: HTMLCanvasElement, hex: string) {
  const b = bytes(hex);
  const f = fit(cv);
  const S = Math.min(f.w, f.h);
  if (S < 2) return;
  const c = f.c;
  c.setTransform(1, 0, 0, 1, 0, 0);
  const px = Math.round(S * f.dpr);
  const s = px / 1000;
  const m = px / 2;
  const thin = Math.max(0.5, 0.55 * f.dpr);
  circle(c, m, s, 494, "#1f3a2f", thin * 1.6, 0.85);
  circle(c, m, s, 484, "#1f3a2f", thin, 0.6);
  const n0 = 36 + (b(0) % 4) * 6;
  ring(c, m, s, { R: 440, A: 16, n: n0, B: 4, m: 3 * n0, sp: 2, k: 8, col: "#1f3a2f", a: 0.5, w: thin, step: 0.3 });
  circle(c, m, s, 404, "#1f3a2f", thin, 0.55);
  const n1 = 7 + (b(1) % 5);
  ring(c, m, s, { R: 300, A: 70, n: n1, B: 10, m: 4 * n1, sp: 1, k: 24 + (b(2) % 3) * 6, col: "#2f5d4a", a: 0.34, w: thin, step: 0.4 });
  circle(c, m, s, 206, "#1f3a2f", thin, 0.5);
  ring(c, m, s, { R: 186, A: 9, n: 24 + (b(3) % 4) * 4, k: 7, col: "#8a6a3f", a: 0.55, w: thin * 0.9, step: 0.45 });
  epi(c, m, s, { lobes: 9 + (b(4) % 5), size: 160, d: 46, k: 6, col: "#1f3a2f", a: 0.45, w: thin });
  c.globalAlpha = 1;
}

/** The hero seal, as two layers that counter-rotate. */
export function heroSeal(ca: HTMLCanvasElement, cb: HTMLCanvasElement, size: number, hex: string) {
  const b = bytes(hex);
  const P = {
    rope: { n: 54 + (b(0) % 4) * 6, k: 10 + (b(1) % 3) * 2 },
    lace: { n: 16 + (b(2) % 4) * 2, k: 40 + (b(3) % 3) * 8 },
    petal: { n: 7 + (b(4) % 5), k: 56 + (b(5) % 3) * 8 },
    bistre: { n: 28 + (b(6) % 4) * 4, k: 9 },
    epi: { lobes: 11 + (b(7) % 5) },
  };
  const d = dpr();
  const px = Math.round(size * d);
  const s = px / 1000;
  const c = px / 2;
  const thin = Math.max(0.55, 0.62 * d * (size < 500 ? 0.85 : 1));
  ca.width = ca.height = px;
  const a = ca.getContext("2d")!;
  a.lineJoin = "round";
  circle(a, c, s, 494, "#1f3a2f", thin * 1.4, 0.85);
  circle(a, c, s, 489, "#1f3a2f", thin, 0.6);
  ring(a, c, s, { R: 452, A: 12, n: P.rope.n, B: 3, m: P.rope.n * 3, sp: 2, k: P.rope.k, col: "#1f3a2f", a: 0.55, w: thin, step: 0.18 });
  circle(a, c, s, 432, "#1f3a2f", thin, 0.55);
  ring(a, c, s, { R: 386, A: 30, n: P.lace.n, B: 9, m: P.lace.n * 3, sp: 1, k: P.lace.k, col: "#2f5d4a", a: 0.3, w: thin, step: 0.22 });
  circle(a, c, s, 345, "#1f3a2f", thin * 1.2, 0.6);
  circle(a, c, s, 340, "#1f3a2f", thin * 0.8, 0.4);
  cb.width = cb.height = px;
  const g = cb.getContext("2d")!;
  g.lineJoin = "round";
  ring(g, c, s, { R: 250, A: 78, n: P.petal.n, B: 12, m: P.petal.n * 4, sp: 1, k: P.petal.k, col: "#2f5d4a", a: 0.3, w: thin, step: 0.25 });
  circle(g, c, s, 172, "#1f3a2f", thin, 0.5);
  ring(g, c, s, { R: 154, A: 10, n: P.bistre.n, k: P.bistre.k, col: "#8a6a3f", a: 0.5, w: thin * 0.9, step: 0.3 });
  epi(g, c, s, { lobes: P.epi.lobes, size: 132, d: 38, k: 7, col: "#1f3a2f", a: 0.42, w: thin });
}

// ---------- readiness seal: one ring per check ----------

export type RingState = "ok" | "warn" | "fail" | "pending";

export interface RingSpec {
  R: number;
  A: number;
  n: number;
  B: number;
  m: number;
  sp: number;
  k: number;
  step: number;
  col: string;
}

const SIX: RingSpec[] = [
  { R: 438, A: 12, n: 60, B: 3, m: 180, sp: 2, k: 10, step: 0.18, col: "#1f3a2f" },
  { R: 372, A: 22, n: 18, B: 6, m: 54, sp: 1, k: 16, step: 0.22, col: "#2f5d4a" },
  { R: 306, A: 17, n: 26, B: 5, m: 78, sp: 1, k: 12, step: 0.25, col: "#1f3a2f" },
  { R: 240, A: 28, n: 9, B: 6, m: 36, sp: 1, k: 20, step: 0.3, col: "#2f5d4a" },
  { R: 178, A: 12, n: 30, B: 3, m: 90, sp: 2, k: 9, step: 0.3, col: "#1f3a2f" },
  { R: 126, A: 13, n: 12, B: 4, m: 36, sp: 1, k: 10, step: 0.35, col: "#2f5d4a" },
];
const SIX_SEP = [411, 338, 279, 201, 153, 104];
const PATTERNS = [
  { n: 60, sp: 2, k: 10, step: 0.18 },
  { n: 18, sp: 1, k: 16, step: 0.22 },
  { n: 26, sp: 1, k: 12, step: 0.25 },
  { n: 9, sp: 1, k: 20, step: 0.3 },
  { n: 30, sp: 2, k: 9, step: 0.3 },
  { n: 12, sp: 1, k: 10, step: 0.35 },
  { n: 40, sp: 2, k: 10, step: 0.32 },
];

/** Ring layout for any number of checks; six reproduces the prototype exactly. */
export function ringLayout(count: number): { rings: RingSpec[]; sep: number[] } {
  if (count === 6) return { rings: SIX, sep: SIX_SEP };
  const n = Math.max(1, Math.min(7, count));
  const outer = 458;
  const inner = 104;
  const w = (outer - inner) / n;
  const rings: RingSpec[] = [];
  const sep: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = PATTERNS[i % PATTERNS.length];
    const R = outer - w * (i + 0.5);
    const A = Math.min(28, w * (i % 2 ? 0.34 : 0.2));
    rings.push({ R, A, n: p.n, B: Math.max(2, A * 0.25), m: p.n * 3, sp: p.sp, k: p.k, step: p.step, col: i % 2 ? "#2f5d4a" : "#1f3a2f" });
    sep.push(outer - w * (i + 1));
  }
  return { rings, sep };
}

export const INDEX_ANGLE = (-52 * Math.PI) / 180;

/** Base plate of the readiness seal: frame circles, separators, index line. */
export function readinessBase(cv: HTMLCanvasElement, size: number, sep: number[]) {
  const d = dpr();
  const px = Math.round(size * d);
  const s = px / 1000;
  const c = px / 2;
  const thin = Math.max(0.5, 0.58 * d * (size < 360 ? 0.85 : 1));
  cv.width = cv.height = px;
  const g = cv.getContext("2d")!;
  circle(g, c, s, 494, "#1f3a2f", thin * 1.5, 0.85);
  circle(g, c, s, 488, "#1f3a2f", thin, 0.6);
  circle(g, c, s, 458, "#1f3a2f", thin * 0.8, 0.5);
  sep.forEach((R) => circle(g, c, s, R, "#1f3a2f", thin * 0.8, 0.32));
  g.globalAlpha = 0.25;
  g.strokeStyle = "#1f3a2f";
  g.lineWidth = thin * 0.8;
  g.setLineDash([2 * d, 3 * d]);
  g.beginPath();
  g.moveTo(c + 104 * s * Math.cos(INDEX_ANGLE), c + 104 * s * Math.sin(INDEX_ANGLE));
  g.lineTo(c + 458 * s * Math.cos(INDEX_ANGLE), c + 458 * s * Math.sin(INDEX_ANGLE));
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
}

/** One readiness ring: whole when it passes, dotted bistre on a warning, broken red on a failure. */
export function readinessRing(cv: HTMLCanvasElement, size: number, r: RingSpec, i: number, state: RingState) {
  const d = dpr();
  const px = Math.round(size * d);
  const s = px / 1000;
  const c = px / 2;
  const thin = Math.max(0.5, 0.58 * d * (size < 360 ? 0.85 : 1));
  cv.width = cv.height = px;
  const x = cv.getContext("2d")!;
  x.lineJoin = "round";
  const o: RingOptions = { R: r.R, A: r.A, n: r.n, B: r.B, m: r.m, sp: r.sp, k: r.k, step: r.step, col: r.col, a: 0.46, w: thin };
  if (state === "warn") {
    o.col = "#8a6a3f";
    o.dash = [1.4 * d, 2.6 * d];
    o.a = 0.7;
  }
  if (state === "pending") {
    o.col = "#7f9a8c";
    o.dash = [1 * d, 4 * d];
    o.a = 0.55;
    o.k = Math.ceil(r.k / 2);
  }
  if (state === "fail") {
    const c0 = (((96 + i * 44) % 360) * Math.PI) / 180;
    o.gap = [c0, c0 + (66 * Math.PI) / 180];
    o.col = "#b8321f";
    o.a = 0.72;
    o.k = Math.ceil(r.k / 2);
    o.dash = [5 * d, 3.5 * d];
  }
  ring(x, c, s, o);
  if (state === "fail" && o.gap) {
    x.globalAlpha = 0.95;
    x.strokeStyle = "#b8321f";
    x.lineWidth = thin * 2.2;
    [o.gap[0], o.gap[1]].forEach((a, j) => {
      const r0 = (r.R - r.A - r.B - 10) * s;
      const r1 = (r.R + r.A + r.B + 10) * s;
      const da = (j ? 1 : -1) * 0.012;
      x.beginPath();
      x.moveTo(c + r0 * Math.cos(a), c + r0 * Math.sin(a));
      x.lineTo(c + ((r0 + r1) / 2) * Math.cos(a + da * 3), c + ((r0 + r1) / 2) * Math.sin(a + da * 3));
      x.lineTo(c + r1 * Math.cos(a), c + r1 * Math.sin(a));
      x.stroke();
    });
  }
  x.globalAlpha = 1;
}
