import { Matrix3, apply } from './homography';

/**
 * Blends several straightened camera pictures into one: every spot of the board comes mostly
 * from the camera that resolves it best (most camera pixels per board area, i.e. the camera that
 * looks at it most directly), with soft transitions in between.
 */

export interface FusionCamera {
  /** Camera pixels → board coordinates (radius 1 = outer double wire, y down). */
  matrix: Matrix3;
  width: number;
  height: number;
}

/** Mask resolution; masks are stretched over the view, so this only sets transition smoothness. */
const MASK_SIZE = 192;
/** Higher = the sharpest camera dominates more, lower = smoother blending. */
const SHARPNESS = 3;

export function invert(m: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-15) return null;
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}

/** Camera pixels per board area around a board point; 0 when the camera does not see it. */
function density(inverse: Matrix3, cam: FusionCamera, x: number, y: number): number {
  const step = 0.01;
  const p = apply(inverse, [x, y]);
  if (!Number.isFinite(p[0]) || p[0] < 0 || p[1] < 0 || p[0] > cam.width || p[1] > cam.height) {
    return 0;
  }
  const px = apply(inverse, [x + step, y]);
  const py = apply(inverse, [x, y + step]);
  const jx = [(px[0] - p[0]) / step, (px[1] - p[1]) / step];
  const jy = [(py[0] - p[0]) / step, (py[1] - p[1]) / step];
  // Fade out towards the picture edge so no hard border shows.
  const edge = Math.min(p[0], p[1], cam.width - p[0], cam.height - p[1]);
  const fade = Math.min(1, edge / 40);
  return Math.abs(jx[0] * jy[1] - jx[1] * jy[0]) * fade;
}

/**
 * One alpha mask per camera (as data URLs), in view coordinates. Layers are stacked in order;
 * layer k gets alpha w_k / (w_1 + … + w_k), which makes the stack a weighted average.
 */
export function fusionMasks(cams: FusionCamera[], viewRadius: number): string[] | null {
  const inverses = cams.map((cam) => invert(cam.matrix));
  if (inverses.some((m) => m === null) || cams.length === 0) return null;

  const canvases = cams.map(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MASK_SIZE;
    return canvas;
  });
  const images = canvases.map((canvas) => canvas.getContext('2d')!.createImageData(MASK_SIZE, MASK_SIZE));

  for (let row = 0; row < MASK_SIZE; row++) {
    for (let col = 0; col < MASK_SIZE; col++) {
      const x = ((col + 0.5) / MASK_SIZE) * 2 * viewRadius - viewRadius;
      const y = ((row + 0.5) / MASK_SIZE) * 2 * viewRadius - viewRadius;
      const weights = cams.map((cam, k) => density(inverses[k]!, cam, x, y) ** SHARPNESS);
      const max = Math.max(...weights);
      let sum = 0;
      weights.forEach((w, k) => {
        // Relative weights keep the numbers small and well-behaved.
        const rel = max > 0 ? w / max : 0;
        sum += rel;
        // The bottom layer is always opaque where it sees anything, so no gaps appear.
        const alpha = k === 0 ? (rel > 0 ? 1 : 0) : sum > 0 ? rel / sum : 0;
        const at = (row * MASK_SIZE + col) * 4;
        const pixels = images[k].data;
        pixels[at] = pixels[at + 1] = pixels[at + 2] = 255;
        pixels[at + 3] = Math.round(alpha * 255);
      });
    }
  }

  return canvases.map((canvas, k) => {
    canvas.getContext('2d')!.putImageData(images[k], 0, 0);
    return canvas.toDataURL('image/png');
  });
}
