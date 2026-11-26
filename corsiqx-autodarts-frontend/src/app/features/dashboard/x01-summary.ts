import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { StatVariant, StatsOverview } from '../../core/stats/stats.model';
import { StatsApiService } from '../../core/stats/stats-api.service';
import { UsersStore } from '../../core/users/users.store';
import { TotalFigure, TotalsCard } from '../../shared/totals-card';
import { VariantSwitch, variantLabel } from '../../shared/variant-switch';

/** "X01-Leistung" on the start page (or another variant): all-time legs, wins and solo games. */
@Component({
  selector: 'app-x01-summary',
  imports: [RouterLink, TotalsCard, VariantSwitch],
  host: { class: 'block' },
  template: `
    <section aria-labelledby="summary-heading">
      <div class="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="summary-heading" class="font-display text-2xl font-bold uppercase">{{ label() }}-Leistung</h2>
        <a routerLink="/stats" class="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-bone">
          Alle Statistiken<i class="ph ph-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
      <app-variant-switch class="mb-3" [(value)]="variant" />
      @if (error()) {
        <p class="rounded-xl border border-line bg-surface/70 px-5 py-5 text-sm text-danger" role="alert">{{ error() }}</p>
      } @else if (figures(); as figures) {
        <app-totals-card [class.opacity-60]="loading()" [figures]="figures" />
      } @else {
        <div class="h-24 rounded-xl border border-line bg-surface/70 motion-safe:animate-pulse" aria-label="Statistik wird geladen"></div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class X01Summary {
  private readonly api = inject(StatsApiService);
  private readonly users = inject(UsersStore);

  protected readonly variant = signal<StatVariant>('x01');
  protected readonly label = computed(() => variantLabel(this.variant()));
  private readonly overview = signal<StatsOverview | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly figures = computed<TotalFigure[] | null>(() => {
    const o = this.overview();
    return o
      ? [
          { value: o.totalLegs, label: 'Gespielte Legs gesamt' },
          { value: o.legsWon, label: 'Gewonnene Legs gesamt' },
          { value: o.soloGames, label: 'Solo-Spiele gesamt' },
        ]
      : null;
  });

  constructor() {
    effect(() => {
      const variant = this.variant();
      untracked(() => void this.load(variant));
    });
  }

  private async load(variant: StatVariant): Promise<void> {
    const userId = this.users.session()?.user.id;
    if (!userId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const overview = await firstValueFrom(this.api.overview(userId, variant));
      if (variant === this.variant()) this.overview.set(overview);
    } catch {
      this.error.set('Statistik konnte nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }
}
