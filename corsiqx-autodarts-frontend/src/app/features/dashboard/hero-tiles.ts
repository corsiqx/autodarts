import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/autodarts/dashboard.store';
import { RouterLink } from '@angular/router';
import { LiveMatchPanel } from './live-match-panel';

const count = new Intl.NumberFormat('de-DE');

/** "Jetzt spielen" and "Gegner finden"; a running match takes over the whole row. */
@Component({
  selector: 'app-hero-tiles',
  imports: [LiveMatchPanel, RouterLink],
  host: { class: 'block' },
  templateUrl: './hero-tiles.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroTiles {
  protected readonly store = inject(DashboardStore);

  protected readonly live = computed(() => {
    const match = this.store.match().data;
    return !!match && !match.finished;
  });

  protected readonly online = computed(() => {
    const value = this.store.home().data?.onlinePlayers;
    return typeof value === 'number' ? count.format(value) : null;
  });
}
