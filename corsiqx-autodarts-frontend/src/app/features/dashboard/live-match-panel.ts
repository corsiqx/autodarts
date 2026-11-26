import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../../core/autodarts/dashboard.store';
import { initials } from '../../shared/initials';

@Component({
  selector: 'app-live-match-panel',
  imports: [NgTemplateOutlet],
  host: { class: 'block' },
  templateUrl: './live-match-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveMatchPanel {
  protected readonly store = inject(DashboardStore);
  protected readonly initials = initials;

  protected readonly match = computed(() => this.store.match().data);

  /** "Leg 2 · Best of 3" style line, built only from fields Autodarts sent. */
  protected readonly progress = computed(() => {
    const match = this.match();
    if (!match) return '';
    const parts: string[] = [];
    if (match.target.sets) parts.push(`Set ${match.set ?? 1} von ${match.target.sets}`);
    if (match.leg !== null) {
      parts.push(match.target.legs ? `Leg ${match.leg} von ${match.target.legs}` : `Leg ${match.leg}`);
    }
    if (match.round !== null) parts.push(`Runde ${match.round}`);
    return parts.join('   ');
  });

  protected readonly winnerName = computed(() => {
    const match = this.match();
    return match?.winner !== null && match?.winner !== undefined
      ? (match.players[match.winner]?.name ?? null)
      : null;
  });
}
