import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DashboardApiService } from '../core/autodarts/dashboard-api.service';
import { UsersStore } from '../core/users/users.store';
import { Avatar } from './avatar';

export type NavSection = 'start' | 'play' | 'tournaments' | 'stats';

interface NavItem {
  key: NavSection;
  label: string;
  link: string;
  fragment?: string;
}

/** Sticky app bar: brand, sections, signed-in account and account switch. */
@Component({
  selector: 'app-top-nav',
  imports: [RouterLink, Avatar],
  host: { class: 'sticky top-0 z-20 block border-b border-line/70 bg-board/75 backdrop-blur-md' },
  template: `
    <div class="mx-auto flex h-16 w-full max-w-[100rem] items-center gap-2 px-4 sm:gap-4 sm:px-6">
      <a routerLink="/dashboard" class="flex shrink-0 items-center gap-2 font-display text-lg font-semibold uppercase tracking-[0.06em]">
        <i class="ph-fill ph-target text-2xl text-sky" aria-hidden="true"></i>
        <span class="hidden md:inline">corsiqx autodarts</span>
      </a>

      <nav class="mx-auto flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Bereiche">
        @for (item of items; track item.key) {
          <a
            [routerLink]="item.link"
            [fragment]="item.fragment"
            class="relative inline-flex h-10 shrink-0 items-center rounded-md px-2 text-[0.95rem] font-semibold transition-colors duration-150 hover:text-bone sm:px-3"
            [class]="active() === item.key ? 'text-bone' : 'text-muted'"
            [attr.aria-current]="active() === item.key ? 'page' : null"
          >
            {{ item.label }}
            @if (active() === item.key) {
              <span class="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-sky" aria-hidden="true"></span>
            }
          </a>
        }
      </nav>

      @if (users.session(); as session) {
        <div class="flex shrink-0 items-center gap-2">
          <app-avatar class="hidden! size-9 rounded-full ring-1 ring-line-strong sm:inline-grid!" [name]="session.user.name" [url]="avatarUrl()" />
          <span class="hidden min-w-0 leading-tight lg:grid">
            <span class="truncate text-sm font-semibold">{{ session.user.name }}</span>
            <span class="truncate text-xs text-muted">{{ session.autodarts.username ?? 'Autodarts' }}</span>
          </span>
          <button
            type="button"
            class="ml-1 inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border border-line-strong text-bone transition-colors duration-150 hover:border-accent/70 hover:bg-surface-2"
            title="Account wechseln"
            (click)="switchAccount()"
          >
            <i class="ph ph-arrows-left-right text-base" aria-hidden="true"></i>
            <span class="sr-only">Account wechseln</span>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNav {
  readonly active = input<NavSection>('start');

  protected readonly users = inject(UsersStore);
  private readonly router = inject(Router);
  private readonly api = inject(DashboardApiService);

  protected readonly items: NavItem[] = [
    { key: 'start', label: 'Start', link: '/dashboard' },
    { key: 'play', label: 'Spielen', link: '/play' },
    { key: 'tournaments', label: 'Turniere', link: '/dashboard', fragment: 'turniere' },
    { key: 'stats', label: 'Stats', link: '/stats' },
  ];

  protected readonly avatarUrl = signal<string | null>(null);

  constructor() {
    const userId = this.users.session()?.user.id;
    if (userId) {
      // The backend caches the profile, so every page asking for it is cheap.
      firstValueFrom(this.api.home(userId))
        .then((home) => this.avatarUrl.set(home.profile?.avatarUrl ?? null))
        .catch(() => undefined);
    }
  }

  protected switchAccount(): void {
    this.users.signOut();
    void this.router.navigate(['/']);
  }
}
