import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopNav } from '../../shared/top-nav';
import { MatchHistoryTab } from './match-history';
import { StatsOverviewTab } from './stats-overview';

/** /stats: overview per variant and the match history (`?tab=verlauf`). */
@Component({
  selector: 'app-stats-page',
  imports: [RouterLink, TopNav, StatsOverviewTab, MatchHistoryTab],
  template: `
    <div class="app-backdrop min-h-dvh overflow-x-clip">
      <app-top-nav active="stats" />
      <main class="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <h1 class="flex items-center gap-3 font-display text-4xl leading-none font-bold uppercase sm:text-5xl">
          <i class="ph-fill ph-chart-line-up text-sky" aria-hidden="true"></i>Statistiken
        </h1>

        <nav class="mt-6 flex gap-6 border-b border-line" aria-label="Statistik-Bereiche">
          <a
            routerLink="/stats"
            class="relative pb-3 text-[0.95rem] font-semibold transition-colors"
            [class]="history() ? 'text-muted hover:text-bone' : 'text-bone'"
            [attr.aria-current]="history() ? null : 'page'"
          >
            Übersicht
            @if (!history()) {
              <span class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-sky" aria-hidden="true"></span>
            }
          </a>
          <a
            routerLink="/stats"
            [queryParams]="{ tab: 'verlauf' }"
            class="relative pb-3 text-[0.95rem] font-semibold transition-colors"
            [class]="history() ? 'text-bone' : 'text-muted hover:text-bone'"
            [attr.aria-current]="history() ? 'page' : null"
          >
            Match-Verlauf
            @if (history()) {
              <span class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-sky" aria-hidden="true"></span>
            }
          </a>
        </nav>

        <div class="mt-6">
          @if (history()) {
            <app-match-history />
          } @else {
            <app-stats-overview />
          }
        </div>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage {
  /** Query parameter. */
  readonly tab = input<string>();
  protected readonly history = computed(() => this.tab() === 'verlauf');
}
