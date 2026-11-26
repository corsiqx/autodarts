import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** Numbers clockwise from the top. */
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/**
 * Radii relative to the outer double wire (170 mm). Same ring sizes as play.autodarts.com,
 * so a tap lands in the same field there.
 */
const R = {
  bull: 7 / 170,
  outerBull: 17 / 170,
  trebleIn: 97 / 170,
  trebleOut: 107 / 170,
  doubleIn: 160 / 170,
  doubleOut: 1,
  numbers: 1.13,
  rim: 1.24,
};

export interface BoardHit {
  /** Segment name as the API expects it: S20, D16, T19, 25, Bull, Miss. */
  segment: string;
  x: number;
  y: number;
}

interface Sector {
  key: string;
  path: string;
  fill: string;
  segment: string;
}

const COLORS = {
  dark: '#11151f',
  light: '#e9dcc0',
  red: '#e3324a',
  green: '#0f9d58',
};

/** Annular sector between two radii, angles in degrees clockwise from the top. */
function sectorPath(r1: number, r2: number, from: number, to: number): string {
  const point = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(5)} ${(r * Math.sin(rad)).toFixed(5)}`;
  };
  return [
    `M ${point(r2, from)}`,
    `A ${r2} ${r2} 0 0 1 ${point(r2, to)}`,
    `L ${point(r1, to)}`,
    `A ${r1} ${r1} 0 0 0 ${point(r1, from)}`,
    'Z',
  ].join(' ');
}

function buildSectors(): Sector[] {
  const sectors: Sector[] = [];
  ORDER.forEach((n, i) => {
    const from = i * 18 - 9;
    const to = from + 18;
    const even = i % 2 === 0;
    const single = even ? COLORS.dark : COLORS.light;
    const ring = even ? COLORS.red : COLORS.green;
    sectors.push(
      { key: `D${n}`, segment: `D${n}`, fill: ring, path: sectorPath(R.doubleIn, R.doubleOut, from, to) },
      { key: `SO${n}`, segment: `S${n}`, fill: single, path: sectorPath(R.trebleOut, R.doubleIn, from, to) },
      { key: `T${n}`, segment: `T${n}`, fill: ring, path: sectorPath(R.trebleIn, R.trebleOut, from, to) },
      { key: `SI${n}`, segment: `S${n}`, fill: single, path: sectorPath(R.outerBull, R.trebleIn, from, to) },
    );
  });
  return sectors;
}

const SECTORS = buildSectors();

/** Which field a point (board coordinates, +y up) is in. */
export function segmentAt(x: number, y: number): string {
  const r = Math.hypot(x, y);
  if (r <= R.bull) return 'Bull';
  if (r <= R.outerBull) return '25';
  if (r > R.doubleOut) return 'Miss';
  const deg = (90 - (Math.atan2(y, x) * 180) / Math.PI + 9 + 720) % 360;
  const n = ORDER[Math.floor(deg / 18) % 20];
  if (r >= R.trebleIn && r <= R.trebleOut) return `T${n}`;
  if (r >= R.doubleIn) return `D${n}`;
  return `S${n}`;
}

/**
 * A drawn dartboard in Autodarts' coordinate system. Taps report the field and position;
 * `darts` are shown as markers.
 */
@Component({
  selector: 'app-dartboard',
  host: { class: 'block' },
  template: `
    <svg
      #svg
      viewBox="-1.26 -1.26 2.52 2.52"
      class="size-full touch-manipulation select-none"
      [class.cursor-crosshair]="!disabled()"
      role="img"
      [attr.aria-label]="disabled() ? 'Dartscheibe' : 'Dartscheibe, tippen um einen Wurf einzutragen'"
      (pointermove)="track($event)"
      (pointerleave)="hover.set(null)"
      (click)="tap($event)"
    >
      <defs>
        <radialGradient id="rim-glow" cx="0" cy="0" r="1.26" gradientUnits="userSpaceOnUse">
          <stop offset="0.9" stop-color="#3d7bff" stop-opacity="0.45" />
          <stop offset="1" stop-color="#3d7bff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle r="1.26" fill="url(#rim-glow)" />
      <circle [attr.r]="R.rim" fill="#0a0d14" stroke="#ff5a6e" stroke-opacity="0.55" stroke-width="0.008" />
      @for (sector of sectors; track sector.key) {
        <path
          [attr.d]="sector.path"
          [attr.fill]="sector.fill"
          [attr.fill-opacity]="hover() === sector.segment ? 0.72 : 1"
          stroke="#b9c0cc"
          stroke-opacity="0.35"
          stroke-width="0.004"
        />
      }
      <circle [attr.r]="R.outerBull" [attr.fill]="colors.green" [attr.fill-opacity]="hover() === '25' ? 0.72 : 1" stroke="#b9c0cc" stroke-opacity="0.35" stroke-width="0.004" />
      <circle [attr.r]="R.bull" [attr.fill]="colors.red" [attr.fill-opacity]="hover() === 'Bull' ? 0.72 : 1" stroke="#b9c0cc" stroke-opacity="0.35" stroke-width="0.004" />
      @for (label of labels; track label.n) {
        <text
          [attr.x]="label.x"
          [attr.y]="label.y"
          text-anchor="middle"
          dominant-baseline="central"
          font-family="Barlow Condensed, Barlow, sans-serif"
          font-weight="700"
          font-size="0.13"
          fill="#e9eefb"
          [attr.transform]="'rotate(' + label.rotate + ' ' + label.x + ' ' + label.y + ')'"
        >
          {{ label.n }}
        </text>
      }
      @if (heat().length) {
        <defs>
          <filter id="heat-glow" x="-1" y="-1" width="3" height="3">
            <feGaussianBlur stdDeviation="0.012" />
          </filter>
        </defs>
        <g filter="url(#heat-glow)">
          @for (dot of heat(); track $index) {
            <circle [attr.cx]="dot.x" [attr.cy]="-dot.y" r="0.03" [attr.fill]="dot.color" fill-opacity="0.55" />
            <circle [attr.cx]="dot.x" [attr.cy]="-dot.y" r="0.014" fill="#d9ff5a" fill-opacity="0.9" />
          }
        </g>
      }
      @for (dart of markers(); track $index; let i = $index) {
        <g [attr.transform]="'translate(' + dart.x + ' ' + -dart.y + ')'">
          <circle r="0.042" fill="#56c2ff" stroke="#07101f" stroke-width="0.012" />
          <text
            text-anchor="middle"
            dominant-baseline="central"
            font-family="Barlow Condensed, Barlow, sans-serif"
            font-weight="700"
            font-size="0.05"
            fill="#07101f"
          >
            {{ i + 1 }}
          </text>
        </g>
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dartboard {
  readonly disabled = input(false);
  readonly darts = input<({ x: number; y: number } | null)[]>([]);
  readonly hit = output<BoardHit>();
  /** Heatmap dots (board coordinates, +y up) in a player colour. */
  readonly heat = input<{ x: number; y: number; color: string }[]>([]);

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  protected readonly R = R;
  protected readonly colors = COLORS;
  protected readonly sectors = SECTORS;
  protected readonly hover = signal<string | null>(null);

  protected readonly labels = ORDER.map((n, i) => {
    const deg = i * 18;
    const rad = ((deg - 90) * Math.PI) / 180;
    // Numbers on the lower half are turned so they read upright.
    const rotate = deg > 90 && deg < 270 ? deg - 180 : deg;
    return {
      n,
      x: +(R.numbers * Math.cos(rad)).toFixed(4),
      y: +(R.numbers * Math.sin(rad)).toFixed(4),
      rotate,
    };
  });

  protected readonly markers = computed(() =>
    this.darts().filter((d): d is { x: number; y: number } => d !== null),
  );

  protected track(event: PointerEvent): void {
    if (this.disabled() || event.pointerType === 'touch') return;
    const at = this.toBoard(event);
    this.hover.set(at ? segmentAt(at.x, at.y) : null);
  }

  protected tap(event: MouseEvent): void {
    if (this.disabled()) return;
    const at = this.toBoard(event);
    if (!at) return;
    // Taps far outside the rim are not throws.
    if (Math.hypot(at.x, at.y) > R.rim) return;
    this.hit.emit({ segment: segmentAt(at.x, at.y), x: +at.x.toFixed(4), y: +at.y.toFixed(4) });
  }

  /** Screen point → board coordinates (+y up, radius 1 = outer double wire). */
  private toBoard(event: MouseEvent): { x: number; y: number } | null {
    const svg = this.svg().nativeElement;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: -point.y };
  }
}
