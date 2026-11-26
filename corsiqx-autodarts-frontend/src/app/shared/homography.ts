/**
 * Straightens a camera picture of the board into a front view.
 * The Board Manager's calibration gives the bull and 20 points on each ring wire; their true
 * positions on a board are known, so a perspective transform (homography) maps one onto the other.
 */

export type Point = [number, number];
/** Row-major 3×3 matrix. */
export type Matrix3 = [number, number, number, number, number, number, number, number, number];

export interface CamCalibration {
  bull: Point;
  doubleOuter: Point[];
  doubleInner: Point[];
  trebleOuter: Point[];
  trebleInner: Point[];
}

/** Ring radii relative to the outer double wire (170 mm). */
const RINGS: [keyof Omit<CamCalibration, 'bull'>, number][] = [
  ['doubleOuter', 1],
  ['doubleInner', 160 / 170],
  ['trebleOuter', 107 / 170],
  ['trebleInner', 97 / 170],
];

/** Shoelace sum; with screen coordinates (y down) a positive value means clockwise. */
function clockwise(points: Point[]): boolean {
  let sum = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  });
  return sum > 0;
}

/**
 * Pairs of (camera pixel, board position). Board positions: x right, y down, radius 1 = outer
 * double wire. Points 19 and 0 enclose the 20 (as play.autodarts.com marks it), so point i sits
 * on the wire 9° + i·18° from the top, running in the same direction as in the picture.
 */
export function correspondences(cal: CamCalibration): { from: Point; to: Point }[] {
  const direction = clockwise(cal.doubleOuter) ? 1 : -1;
  const pairs: { from: Point; to: Point }[] = [{ from: cal.bull, to: [0, 0] }];
  for (const [ring, radius] of RINGS) {
    cal[ring].forEach((pixel, i) => {
      const angle = (direction * (9 + 18 * i) * Math.PI) / 180;
      pairs.push({ from: pixel, to: [radius * Math.sin(angle), -radius * Math.cos(angle)] });
    });
  }
  return pairs;
}

/** Least-squares homography (h33 = 1) from at least four point pairs; coordinates are normalised first. */
export function solveHomography(pairs: { from: Point; to: Point }[]): Matrix3 | null {
  if (pairs.length < 4) return null;
  const norm = (points: Point[]) => {
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    const spread =
      points.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / points.length || 1;
    const k = Math.SQRT2 / spread;
    return { cx, cy, k };
  };
  const a = norm(pairs.map((p) => p.from));
  const b = norm(pairs.map((p) => p.to));

  // Normal equations AᵀA·h = Aᵀb for the 8 unknowns.
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  const add = (row: number[], value: number) => {
    for (let i = 0; i < 8; i++) {
      atb[i] += row[i] * value;
      for (let j = 0; j < 8; j++) ata[i][j] += row[i] * row[j];
    }
  };
  for (const { from, to } of pairs) {
    const x = (from[0] - a.cx) * a.k;
    const y = (from[1] - a.cy) * a.k;
    const u = (to[0] - b.cx) * b.k;
    const v = (to[1] - b.cy) * b.k;
    add([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    add([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const h = solve(ata, atb);
  if (!h) return null;
  const hn: Matrix3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];

  // Undo the normalisation: H = Tb⁻¹ · Hn · Ta.
  const ta: Matrix3 = [a.k, 0, -a.k * a.cx, 0, a.k, -a.k * a.cy, 0, 0, 1];
  const tbInv: Matrix3 = [1 / b.k, 0, b.cx, 0, 1 / b.k, b.cy, 0, 0, 1];
  return multiply(tbInv, multiply(hn, ta));
}

export function multiply(m: Matrix3, n: Matrix3): Matrix3 {
  const r = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) r[i * 3 + j] += m[i * 3 + k] * n[k * 3 + j];
    }
  }
  return r as Matrix3;
}

export function apply(m: Matrix3, [x, y]: Point): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/** CSS `matrix3d(...)` for a 2D homography (column-major 4×4). */
export function toMatrix3d(m: Matrix3): string {
  const v = [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]];
  return `matrix3d(${v.map((n) => +n.toPrecision(10)).join(',')})`;
}

/** Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}
