import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/autodarts/dashboard.store';
import { Avatar } from '../../shared/avatar';
import { averageTierClasses } from '../../shared/average-tier';
import { Flag } from '../../shared/flag';

const oneDecimal = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

interface Figure {
  label: string;
  value: string;
}

/** Name, flag, average badge and headline numbers of the signed-in Autodarts account. */
@Component({
  selector: 'app-player-strip',
  imports: [Avatar, Flag],
  host: { class: 'block' },
  templateUrl: './player-strip.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerStrip {
  protected readonly store = inject(DashboardStore);
  protected readonly profile = computed(() => this.store.home().data?.profile ?? null);

  /** Average bracket next to the name, as on play.autodarts.com (Ø 32,0 shows as 30). */
  protected readonly averageBadge = computed(() => {
    const average = this.profile()?.average;
    if (average === null || average === undefined) return null;
    return {
      value: Math.floor(average / 10) * 10,
      exact: oneDecimal.format(average),
      tier: averageTierClasses(average),
    };
  });

  protected readonly figures = computed<Figure[]>(() => {
    const p = this.profile();
    if (!p) return [];
    const figure = (label: string, value: number | null, format: (n: number) => string) =>
      value === null ? null : { label, value: format(value) };
    return [
      figure('3-Dart-Ø', p.average, (n) => oneDecimal.format(n)),
      figure('Siegquote', p.winRate, (n) => `${oneDecimal.format(n)} %`),
      figure('Checkout', p.checkoutRate, (n) => `${whole.format(n)} %`),
      figure('First 9 Ø', p.first9Average, (n) => oneDecimal.format(n)),
      figure('Turniere', p.tournamentsPlayed, (n) => whole.format(n)),
    ].filter((f): f is Figure => f !== null);
  });
}
