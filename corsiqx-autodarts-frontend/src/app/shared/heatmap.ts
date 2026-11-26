/**
 * Thermal-camera style heat layer for dart positions: every dart adds a soft blob of "heat",
 * overlapping blobs add up, and the sum is coloured blue → cyan → green → yellow → red.
 * The layer covers the dartboard's view box (−VIEW…+VIEW in board units, +y up).
 */

/** Must match the drawn dartboard's view box (`-1.26 -1.26 2.52 2.52`). */
const VIEW = 1.26;
const SIZE = 640;
/** Blob radius in board units (radius 1 = outer double wire). */
const BLOB = 0.06;
/** Heat one dart adds at its centre (0–1); a few darts on the same spot reach "red". */
const STRENGTH = 0.68;

const STOPS: [number, [number, number, number]][] = [
  [0, [20, 20, 255]],
  [0.25, [0, 170, 255]],
  [0.45, [40, 230, 120]],
  [0.65, [190, 255, 40]],
  [0.82, [255, 220, 30]],
  [1, [255, 60, 30]],
];

/** 256-step colour ramp built from the stops. */
const RAMP = (() => {
  const ramp = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const upper = STOPS.findIndex(([at]) => at >= t);
    const [t1, c1] = STOPS[Math.max(0, upper - 1)];
    const [t2, c2] = STOPS[Math.max(0, upper)];
    const k = t2 === t1 ? 0 : (t - t1) / (t2 - t1);
    for (let c = 0; c < 3; c++) ramp[i * 3 + c] = c1[c] + (c2[c] - c1[c]) * k;
  }
  return ramp;
})();

/** PNG data URL of the heat of these darts, transparent where nothing landed. */
export function renderHeat(points: { x: number; y: number }[]): string | null {
  if (!points.length) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Accumulate heat as alpha: overlapping blobs add up.
  const radius = (BLOB / (2 * VIEW)) * SIZE;
  for (const { x, y } of points) {
    const px = ((x + VIEW) / (2 * VIEW)) * SIZE;
    const py = ((VIEW - y) / (2 * VIEW)) * SIZE;
    const blob = ctx.createRadialGradient(px, py, 0, px, py, radius);
    blob.addColorStop(0, `rgba(0,0,0,${STRENGTH})`);
    blob.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }

  // 2. Colour every pixel by its heat; the faintest edge fades out.
  const image = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const heat = data[i + 3];
    if (!heat) continue;
    data[i] = RAMP[heat * 3];
    data[i + 1] = RAMP[heat * 3 + 1];
    data[i + 2] = RAMP[heat * 3 + 2];
    data[i + 3] = Math.min(255, heat * 3.2);
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
