import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatchDetail, MatchPlayerStats } from '../../core/stats/stats.model';
import { StatsApiService } from '../../core/stats/stats-api.service';
import { UsersStore } from '../../core/users/users.store';
import { Dartboard } from '../../shared/dartboard';
import { renderHeat } from '../../shared/heatmap';
import { PlayerTag } from '../../shared/player-tag';
import { TopNav } from '../../shared/top-nav';

type Tab = 'stats' | 'heat' | 'visits';

/** Player colours: banner gradient, chart line, heat dots. */
export const PLAYER_COLORS = [
  // Violet to cobalt, like the active player tile in a match.
  { from: '#6d4bf0', to: '#2f45c9', line: '#8f74ff', dot: '#a68fff' },
  // Sky to deep blue.
  { from: '#3ab4f7', to: '#1a5fb0', line: '#56c2ff', dot: '#56c2ff' },
  { from: '#e8c64b', to: '#a8651a', line: '#e8c64b', dot: '#ffd866' },
  { from: '#3fcf8e', to: '#13704f', line: '#3fcf8e', dot: '#5cffb0' },
  { from: '#f2607e', to: '#8a2440', line: '#f2607e', dot: '#ff7a95' },
  { from: '#30d0e3', to: '#0d6f86', line: '#30d0e3', dot: '#5ee8f7' },
];

const one = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('de-DE');
const when = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const MODE: Record<string, string> = { Straight: 'S', Double: 'D', Master: 'M' };

interface CompareRow {
  label: string;
  values: string[];
  /** Bar length per player, 0–100. */
  bars: number[];
  /** Index of the better player, or null on a tie / no data. */
  best: number | null;
}

/** /stats/match/:matchId — one finished match: comparison, heatmaps and every visit. */
@Component({
  selector: 'app-match-stats-page',
  imports: [RouterLink, TopNav, PlayerTag, Dartboard],
  templateUrl: './match-stats.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchStatsPage {
  /** Route parameter. */
  readonly matchId = input.required<string>();

  private readonly api = inject(StatsApiService);
  private readonly users = inject(UsersStore);

  protected readonly colors = PLAYER_COLORS;
  protected readonly tab = signal<Tab>('stats');
  protected readonly match = signal<MatchDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly legIndex = signal(0);
  protected readonly hiddenHeat = signal<Set<number>>(new Set());

  protected readonly chips = computed(() => {
    const m = this.match();
    if (!m) return [];
    const chips: string[] = [];
    if (m.baseScore) chips.push(String(m.baseScore));
    if (m.targetSets) chips.push(`Erster bis ${m.targetSets} ${m.targetSets === 1 ? 'Set' : 'Sets'}`);
    else if (m.targetLegs) chips.push(`Erster bis ${m.targetLegs} ${m.targetLegs === 1 ? 'Leg' : 'Legs'}`);
    if (m.inMode && m.outMode) chips.push(`${MODE[m.inMode] ?? m.inMode}I-${MODE[m.outMode] ?? m.outMode}O`);
    return chips;
  });

  protected readonly subtitle = computed(() => {
    const m = this.match();
    if (!m?.finishedAt) return '';
    return when.format(new Date(m.finishedAt));
  });

  protected readonly duration = computed(() => {
    const raw = this.match()?.duration ?? '';
    // "1h4m42.5s" → "1h 4m 42s"
    return raw.replace(/(\d+)(?:\.\d+)?([hms])/g, '$1$2 ').trim();
  });

  /** Rows that compare averages and rates; higher is better everywhere. */
  protected readonly compare = computed<CompareRow[]>(() => {
    const players = this.match()?.players ?? [];
    const row = (
      label: string,
      pick: (s: MatchPlayerStats) => number | null,
      format: (n: number, s: MatchPlayerStats) => string,
    ): CompareRow => {
      const raw = players.map((p) => (p.stats ? pick(p.stats) : null));
      const max = Math.max(...raw.map((v) => v ?? 0), 0);
      const top = raw.filter((v) => v !== null && v === max).length;
      const best = max > 0 && top === 1 ? raw.indexOf(max) : null;
      return {
        label,
        values: raw.map((v, i) => (v === null ? '–' : format(v, players[i].stats!))),
        bars: raw.map((v) => (v && max ? (v / max) * 100 : 0)),
        best,
      };
    };
    return [
      row('3-Dart-Average', (s) => s.average, (n) => one.format(n)),
      row(
        'Checkout %',
        (s) => (s.checkouts ? (s.checkoutPercent ?? 0) : null),
        (n, s) => `${whole.format(Math.round(n))}% (${s.checkoutsHit}/${s.checkouts})`,
      ),
      row('Durchschnitt erste 9', (s) => s.first9Average, (n) => one.format(n)),
      row('Durchschnitt bis 170', (s) => s.averageUntil170, (n) => one.format(n)),
      row('Höchstes Finish', (s) => s.highestFinish, (n) => whole.format(n)),
    ];
  });

  protected readonly counts = computed(() => {
    const players = this.match()?.players ?? [];
    const pick = (key: keyof MatchPlayerStats) => players.map((p) => (p.stats ? String(p.stats[key] ?? 0) : '–'));
    return [
      { label: 'Geworfene Darts', values: pick('dartsThrown') },
      { label: '60+', values: pick('plus60') },
      { label: '100+', values: pick('plus100') },
      { label: '140+', values: pick('plus140') },
      { label: '170+', values: pick('plus170') },
      { label: '180', values: pick('total180') },
    ];
  });

  /** Thermal heat layer per player (PNG data URLs), rendered once per match. */
  protected readonly heatLayers = computed(() => this.match()?.heat.map((dots) => renderHeat(dots)) ?? []);
  protected readonly hasHeat = computed(() => this.heatLayers().some((layer) => layer !== null));

  /** Split position in percent: left of it player 1, right of it player 2. */
  protected readonly split = signal(50);
  protected readonly dragging = signal(false);
  protected readonly roundSplit = computed(() => Math.round(this.split()));

  protected readonly leg = computed(() => this.match()?.legs[this.legIndex()] ?? null);

  /** Remaining score after each visit, as SVG polylines (x: visit, y: score). */
  protected readonly chart = computed(() => {
    const m = this.match();
    const leg = this.leg();
    if (!m || !leg) return null;
    const start = m.baseScore ?? 501;
    const rounds = Math.max(1, ...leg.visits.map((v) => v.length));
    const width = 600;
    const height = 160;
    const x = (i: number) => (i / rounds) * width;
    const y = (score: number) => height - (score / start) * height;
    const lines = leg.visits.map((visits, i) => {
      const scores = [start, ...visits.map((v) => v.remaining ?? start)];
      const points = scores.map((score, k) => ({ x: x(k), y: y(score), score }));
      return {
        path: smoothPath(points),
        points,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length].line,
      };
    });
    const ticks = Array.from({ length: rounds }, (_, i) => ({ x: x(i + 1), label: i + 1 }));
    const levels = [0, 100, 200, 300, 400, 500].filter((s) => s <= start).map((s) => ({ y: y(s), label: s }));
    return { width, height, rounds, lines, ticks, levels, start };
  });

  /** Visit rows aligned by round across players. */
  /** Visit the pointer is over in the chart (0 = start), or null. */
  protected readonly hover = signal<number | null>(null);

  /** Hover line position and each player's remaining score at that visit. */
  protected readonly hoverInfo = computed(() => {
    const c = this.chart();
    const round = this.hover();
    if (!c || round === null) return null;
    const x = (round / c.rounds) * c.width;
    return {
      round,
      x,
      /** Position in percent of the SVG box (its view box starts at -34). */
      left: ((x + 34) / (c.width + 44)) * 100,
      rows: c.lines.map((line) => ({ color: line.color, point: line.points[round] ?? null })),
    };
  });

  protected trackChart(event: PointerEvent, svg: Element): void {
    const c = this.chart();
    const matrix = svg instanceof SVGGraphicsElement ? svg.getScreenCTM() : null;
    if (!c || !matrix) return;
    const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const round = Math.round((at.x / c.width) * c.rounds);
    this.hover.set(Math.min(c.rounds, Math.max(0, round)));
  }

  protected readonly visitRows = computed(() => {
    const leg = this.leg();
    if (!leg) return [];
    const rounds = Math.max(0, ...leg.visits.map((v) => v.length));
    return Array.from({ length: rounds }, (_, r) => ({
      round: r + 1,
      cells: leg.visits.map((visits) => visits[r] ?? null),
    }));
  });

  constructor() {
    effect(() => {
      const id = this.matchId();
      untracked(() => void this.load(id));
    });
  }

  protected toggleHeat(index: number): void {
    this.hiddenHeat.update((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  protected startSplit(event: PointerEvent, box: HTMLElement): void {
    box.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.moveSplit(event, box);
  }

  protected moveSplit(event: PointerEvent, box: HTMLElement): void {
    if (!this.dragging()) return;
    const rect = box.getBoundingClientRect();
    this.split.set(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  }

  protected nudgeSplit(event: KeyboardEvent): void {
    const steps: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 };
    if (event.key === 'Home') this.split.set(0);
    else if (event.key === 'End') this.split.set(100);
    else if (steps[event.key]) this.split.update((s) => Math.min(100, Math.max(0, s + steps[event.key])));
    else return;
    event.preventDefault();
  }

  protected gradient(index: number): string {
    const c = PLAYER_COLORS[index % PLAYER_COLORS.length];
    return `linear-gradient(180deg, ${c.from}, ${c.to})`;
  }

  private async load(matchId: string): Promise<void> {
    const userId = this.users.session()?.user.id;
    if (!userId) return;
    this.match.set(null);
    this.error.set(null);
    this.legIndex.set(0);
    try {
      this.match.set(await firstValueFrom(this.api.match(userId, matchId)));
    } catch {
      this.error.set('Die Statistik zu diesem Match konnte nicht geladen werden.');
    }
  }
}

/** Smooth line through the points (Catmull-Rom as cubic Béziers), like a spline chart. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
