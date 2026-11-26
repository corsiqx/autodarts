import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { timer } from 'rxjs';
import { DashboardStore } from '../../core/autodarts/dashboard.store';
import { UsersStore } from '../../core/users/users.store';
import { initials } from '../../shared/initials';
import { BoardsPanel } from './boards-panel';
import { LiveMatchPanel } from './live-match-panel';
import { StatsPanel } from './stats-panel';

/** Live match refresh while the tab is visible. */
const MATCH_POLL_MS = 4_000;
const BOARDS_POLL_MS = 15_000;

@Component({
  selector: 'app-dashboard-page',
  imports: [LiveMatchPanel, BoardsPanel, StatsPanel],
  providers: [DashboardStore],
  templateUrl: './dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly users = inject(UsersStore);
  protected readonly dashboard = inject(DashboardStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly initials = initials;

  /** The guard ensures a session; the empty fallback only covers sign-out. */
  protected get userId(): string {
    return this.users.session()?.user.id ?? '';
  }

  ngOnInit(): void {
    void this.dashboard.loadStats(this.userId);
    this.poll(MATCH_POLL_MS, () => this.dashboard.loadMatch(this.userId));
    this.poll(BOARDS_POLL_MS, () => this.dashboard.loadBoards(this.userId));
  }

  protected switchAccount(): void {
    this.users.signOut();
    void this.router.navigate(['/']);
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
