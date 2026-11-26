import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { DashboardStore } from '../../core/autodarts/dashboard.store';
import { UsersStore } from '../../core/users/users.store';
import { TopNav } from '../../shared/top-nav';
import { CommunityPanel } from './community-panel';
import { HeroTiles } from './hero-tiles';
import { PlayerStrip } from './player-strip';
import { TournamentsPanel } from './tournaments-panel';
import { X01Summary } from './x01-summary';

/** Refresh intervals while the tab is visible; slow-changing parts poll rarely. */
const MATCH_POLL_MS = 4_000;
const BOARDS_POLL_MS = 15_000;
const FRIENDS_POLL_MS = 45_000;
const TOURNAMENTS_POLL_MS = 180_000;
const HOME_POLL_MS = 300_000;

@Component({
  selector: 'app-dashboard-page',
  imports: [TopNav, PlayerStrip, HeroTiles, TournamentsPanel, X01Summary, CommunityPanel],
  providers: [DashboardStore],
  templateUrl: './dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly users = inject(UsersStore);
  protected readonly dashboard = inject(DashboardStore);
  private readonly destroyRef = inject(DestroyRef);

  /** The guard ensures a session; the empty fallback only covers sign-out. */
  protected get userId(): string {
    return this.users.session()?.user.id ?? '';
  }

  ngOnInit(): void {
    this.poll(HOME_POLL_MS, () => this.dashboard.loadHome(this.userId));
    this.poll(MATCH_POLL_MS, () => this.dashboard.loadMatch(this.userId));
    this.poll(BOARDS_POLL_MS, () => this.dashboard.loadBoards(this.userId));
    this.poll(FRIENDS_POLL_MS, () => this.dashboard.loadFriends(this.userId));
    this.poll(TOURNAMENTS_POLL_MS, () => this.dashboard.loadTournaments(this.userId));
  }

  private poll(intervalMs: number, load: () => Promise<void>): void {
    timer(0, intervalMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.userId && document.visibilityState !== 'hidden') {
          void load();
        }
      });
  }
}
