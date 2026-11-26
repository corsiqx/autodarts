import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { StatVariant, StatsOverview } from '../../core/stats/stats.model';
import { StatsApiService } from '../../core/stats/stats-api.service';
import { UsersStore } from '../../core/users/users.store';
import { TotalFigure, TotalsCard } from '../../shared/totals-card';
import { VariantSwitch, variantLabel } from '../../shared/variant-switch';


const LIMITS = [10, 25, 50, 100, 250, 500];

const one = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('de-DE');

/** Labels for the generic (non-X01) figures. */
const LABELS: Record<string, string> = {
  mpr: 'Marks pro Runde',
  first9MPR: 'Marks pro Runde (erste 9)',
  mark5: '5-Mark-Runden',
  mark6: '6-Mark-Runden',
  mark7: '7-Mark-Runden',
  mark8: '8-Mark-Runden',
  mark9: '9-Mark-Runden',
  whiteHorse: 'White Horses',
  average: 'Durchschnitt',
  first9Average: 'Durchschnitt erste 9',
  checkoutPercent: 'Checkout %',
  hits: 'Treffer',
  hitRate: 'Trefferquote',
};

interface CompareBar {
  label: string;
  value: number;
  previous: number | null;
  fill: number;
  marker: number | null;
  trend: 'up' | 'down' | 'same';
  text: string;
  previousText: string;
}

function bar(label: string, value: number, previous: number | null, format = (n: number) => one.format(n)): CompareBar {
  const scale = Math.max(value, previous ?? 0, 1) * 1.35;
  return {
    label,
    value,
    previous,
    fill: (value / scale) * 100,
    marker: previous !== null ? (previous / scale) * 100 : null,
    trend: previous === null || value === previous ? 'same' : value > previous ? 'up' : 'down',
    text: format(value),
    previousText: previous === null ? '–' : format(previous),
  };
}

/** "Übersicht" tab: all-time totals and the breakdown of the last N legs against the N before. */
@Component({
  selector: 'app-stats-overview',
  imports: [FormsModule, NgTemplateOutlet, TotalsCard, VariantSwitch],
  host: { class: 'block' },
  templateUrl: './stats-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsOverviewTab {
  private readonly api = inject(StatsApiService);
  private readonly users = inject(UsersStore);

  protected readonly limits = LIMITS;
  protected readonly variant = signal<StatVariant>('x01');
  protected readonly limit = signal(100);
  protected readonly data = signal<StatsOverview | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly variantLabel = computed(() => variantLabel(this.variant()));

  protected readonly totals = computed<TotalFigure[]>(() => {
    const d = this.data();
    return [
      { value: d?.totalLegs ?? null, label: 'Gespielte Legs gesamt' },
      { value: d?.legsWon ?? null, label: 'Gewonnene Legs gesamt' },
      { value: d?.soloGames ?? null, label: 'Solo-Spiele gesamt' },
    ];
  });

  /** Previous values only count when there was a previous window. */
  private prev(key: string): number | null {
    const d = this.data();
    return d && d.previousLegs ? (d.previous[key] ?? null) : null;
  }

  protected readonly x01 = computed(() => {
    const d = this.data();
    if (!d || d.variant !== 'x01' || !d.legs) return null;
    const c = d.current;
    const average = c['average'] ?? 0;
    const prevAverage = this.prev('average');
    const avgScale = Math.max(average, prevAverage ?? 0, 1);
    const checkout = (c['checkoutPercent'] ?? 0) * 100;
    const prevCheckoutRaw = this.prev('checkoutPercent');
    const prevCheckout = prevCheckoutRaw === null ? null : prevCheckoutRaw * 100;
    const legs = d.legs;
    const rows = [
      ['60+', 'plus60'],
      ['100+', 'plus100'],
      ['140+', 'plus140'],
      ['170+', 'plus170'],
      ['180', 'total180'],
    ].map(([label, key]) => {
      const total = c[key] ?? 0;
      return { label, total: whole.format(total), perLeg: two.format(total / legs) };
    });
    return {
      average: one.format(average),
      averageHeight: (average / avgScale) * 100,
      previousAverage: prevAverage === null ? null : one.format(prevAverage),
      previousAverageHeight: prevAverage === null ? null : (prevAverage / avgScale) * 100,
      checkout: one.format(checkout),
      checkoutDash: Math.min(checkout, 100),
      previousCheckout: prevCheckout === null ? null : one.format(prevCheckout),
      previousCheckoutAngle: prevCheckout === null ? null : (Math.min(prevCheckout, 100) / 100) * 360,
      checkoutHits: whole.format(c['checkoutsHit'] ?? 0),
      checkoutTries: whole.format(c['checkouts'] ?? 0),
      legs: whole.format(legs),
      legsWon: whole.format(d.legsWonInWindow ?? 0),
      rows,
      bars: [
        bar('Durchschnitt bis 170', c['averageUntil170'] ?? 0, this.prev('averageUntil170')),
        bar('Durchschnitt erste 9', c['first9Average'] ?? 0, this.prev('first9Average')),
        bar('Durchschnittliche Checkout-Punkte', c['checkoutPointsAverage'] ?? 0, this.prev('checkoutPointsAverage')),
      ],
    };
  });

  /** Other variants: every non-zero number Autodarts sends, compared with the previous window. */
  protected readonly generic = computed<CompareBar[]>(() => {
    const d = this.data();
    if (!d || d.variant === 'x01') return [];
    return Object.entries(d.current)
      .filter(([key, value]) => !['dartsThrown', 'score'].includes(key) && (value !== 0 || (this.prev(key) ?? 0) !== 0))
      .map(([key, value]) =>
        bar(
          LABELS[key] ?? key.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase()),
          key.toLowerCase().includes('percent') || key.toLowerCase().includes('rate') ? value * 100 : value,
          this.prev(key) === null
            ? null
            : key.toLowerCase().includes('percent') || key.toLowerCase().includes('rate')
              ? this.prev(key)! * 100
              : this.prev(key),
          (n) => (Number.isInteger(n) ? whole.format(n) : two.format(n)),
        ),
      );
  });

  constructor() {
    effect(() => {
      const variant = this.variant();
      const limit = this.limit();
      untracked(() => void this.load(variant, limit));
    });
  }

  private async load(variant: StatVariant, limit: number): Promise<void> {
    const userId = this.users.session()?.user.id;
    if (!userId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.overview(userId, variant, limit));
      // Ignore answers for a selection that changed meanwhile.
      if (variant === this.variant() && limit === this.limit()) this.data.set(data);
    } catch {
      this.error.set('Statistik konnte nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }
}
