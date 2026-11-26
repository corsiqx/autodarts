import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatchHistory, MatchType } from '../../core/stats/stats.model';
import { StatsApiService } from '../../core/stats/stats-api.service';
import { UsersStore } from '../../core/users/users.store';
import { PlayerTag } from '../../shared/player-tag';

const date = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

interface TypeFilter {
  type: MatchType;
  label: string;
  icon: string;
  count: (h: MatchHistory) => number;
}

const TYPES: TypeFilter[] = [
  { type: 'Local', label: 'Lokal', icon: 'ph-house', count: (h) => h.counts.local },
  { type: 'Online', label: 'Online', icon: 'ph-globe-hemisphere-west', count: (h) => h.counts.online },
  { type: 'Match Making', label: 'Matchmaking', icon: 'ph-users-three', count: (h) => h.counts.matchmaking },
  { type: 'Tournament', label: 'Turniere', icon: 'ph-trophy', count: (h) => h.counts.tournament },
];

const TYPE_ICONS: Record<string, string> = {
  Local: 'ph-house',
  Online: 'ph-globe-hemisphere-west',
  'Match Making': 'ph-users-three',
  Tournament: 'ph-trophy',
};

/** "Match-Verlauf" tab: matches newest first, filterable by type, 10 per page. */
@Component({
  selector: 'app-match-history',
  imports: [RouterLink, PlayerTag],
  host: { class: 'block' },
  templateUrl: './match-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHistoryTab {
  private readonly api = inject(StatsApiService);
  private readonly users = inject(UsersStore);

  protected readonly types = TYPES;
  protected readonly type = signal<MatchType | null>(null);
  protected readonly page = signal(0);
  protected readonly data = signal<MatchHistory | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly pages = computed(() => this.data()?.totalPages ?? 1);

  constructor() {
    effect(() => {
      const type = this.type();
      const page = this.page();
      untracked(() => void this.load(type, page));
    });
  }

  protected toggleType(type: MatchType): void {
    this.type.update((current) => (current === type ? null : type));
    this.page.set(0);
  }

  protected go(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.pages() - 1));
  }

  protected date(value: string | null): string {
    return value ? date.format(new Date(value)) : '';
  }

  protected time(value: string | null): string {
    return value ? time.format(new Date(value)) : '';
  }

  protected icon(type: string | null): string {
    return TYPE_ICONS[type ?? ''] ?? 'ph-target';
  }

  private async load(type: MatchType | null, page: number): Promise<void> {
    const userId = this.users.session()?.user.id;
    if (!userId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.history(userId, page, type));
      if (type === this.type() && page === this.page()) this.data.set(data);
    } catch {
      this.error.set('Match-Verlauf konnte nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }
}
