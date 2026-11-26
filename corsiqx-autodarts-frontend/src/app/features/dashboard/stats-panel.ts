import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DashboardStore } from '../../core/autodarts/dashboard.store';

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

@Component({
  selector: 'app-stats-panel',
  host: { class: 'block' },
  templateUrl: './stats-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPanel {
  readonly userId = input.required<string>();
  protected readonly store = inject(DashboardStore);

  protected formatNumber(value: number): string {
    return numberFormat.format(value);
  }

  protected formatDate(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
  }

  protected reload(): void {
    void this.store.loadStats(this.userId());
  }
}
