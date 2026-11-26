import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { timer } from 'rxjs';
import { DashboardStore } from '../../core/autodarts/dashboard.store';
import { UsersStore } from '../../core/users/users.store';
import { Avatar } from '../../shared/avatar';
import { CommunityPanel } from './community-panel';
import { HeroTiles } from './hero-tiles';
import { PlayerStrip } from './player-strip';
import { StatsPanel } from './stats-panel';
import { TournamentsPanel } from './tournaments-panel';

/** Refresh intervals while the tab is visible; slow-changing parts poll rarely. */
const MATCH_POLL_MS = 4_000;
const BOARDS_POLL_MS = 15_000;
const FRIENDS_POLL_MS = 45_000;
const TOURNAMENTS_POLL_MS = 180_000;
const HOME_POLL_MS = 300_000;

interface NavItem {
  label: string;
  href: string;
  external: boolean;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [Avatar, PlayerStrip, HeroTiles, TournamentsPanel, StatsPanel, CommunityPanel],
  providers: [DashboardStore],
  templateUrl: './dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly users = inject(UsersStore);
  protected readonly dashboard = inject(DashboardStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly nav: NavItem[] = [
    { label: 'Start', href: 'start', external: false },
    { label: 'Turniere', href: 'turniere', external: false },
    { label: 'Freunde', href: 'freunde', external: false },
    { label: 'Stats', href: 'statistik', external: false },
    { label: 'Spielen', href: 'https://play.autodarts.com/play', external: true },
  ];

  /** The guard ensures a session; the empty fallback only covers sign-out. */
  protected get userId(): string {
    return this.users.session()?.user.id ?? '';
  }

  ngOnInit(): void {
    void this.dashboard.loadStats(this.userId);
    this.poll(HOME_POLL_MS, () => this.dashboard.loadHome(this.userId));
    this.poll(MATCH_POLL_MS, () => this.dashboard.loadMatch(this.userId));
    this.poll(BOARDS_POLL_MS, () => this.dashboard.loadBoards(this.userId));
    this.poll(FRIENDS_POLL_MS, () => this.dashboard.loadFriends(this.userId));
    this.poll(TOURNAMENTS_POLL_MS, () => this.dashboard.loadTournaments(this.userId));
  }

  /** In-page sections; plain `#id` links would resolve against the base href and leave the page. */
  protected scrollTo(id: string): void {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (id === 'start') {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
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
