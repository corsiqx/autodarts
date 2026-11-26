import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DashboardBoard } from '../../core/autodarts/dashboard.model';
import { DashboardApiService } from '../../core/autodarts/dashboard-api.service';
import { CreateGamePayload, InOutMode, Opponent } from '../../core/play/play.model';
import { PlayApiService } from '../../core/play/play-api.service';
import { ApiErrorBody } from '../../core/users/user.model';
import { UsersStore } from '../../core/users/users.store';
import { Avatar } from '../../shared/avatar';
import { BOT_LEVELS } from '../../shared/average-tier';
import { BotTag } from '../../shared/bot-tag';
import { TopNav } from '../../shared/top-nav';

const SETTINGS_KEY = 'corsiqx.play-settings';
const MAX_PLAYERS = 6;

interface SavedSettings {
  baseScore: number;
  inMode: InOutMode;
  outMode: InOutMode;
  bullMode: '25/50' | '50/50';
  legs: number;
  sets: number | null;
  bullOff: boolean;
  scoring: string;
  opponents: Opponent[];
}

const DEFAULTS: SavedSettings = {
  baseScore: 501,
  inMode: 'Straight',
  outMode: 'Double',
  bullMode: '25/50',
  legs: 1,
  sets: null,
  bullOff: false,
  scoring: 'manual',
  opponents: [{ kind: 'bot', average: 40 }],
};

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SavedSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Game settings and players, then starts the match on the Autodarts game server. */
@Component({
  selector: 'app-play-setup-page',
  imports: [FormsModule, Avatar, BotTag, TopNav],
  templateUrl: './play-setup.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaySetupPage implements OnInit {
  protected readonly users = inject(UsersStore);
  private readonly play = inject(PlayApiService);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly router = inject(Router);

  protected readonly baseScores = [301, 501, 701, 901];
  protected readonly modes: { value: InOutMode; label: string }[] = [
    { value: 'Straight', label: 'Single' },
    { value: 'Double', label: 'Double' },
    { value: 'Master', label: 'Master' },
  ];
  protected readonly botLevels = BOT_LEVELS;

  private readonly saved = loadSettings();
  protected readonly baseScore = signal(this.saved.baseScore);
  protected readonly inMode = signal<InOutMode>(this.saved.inMode);
  protected readonly outMode = signal<InOutMode>(this.saved.outMode);
  protected readonly bullMode = signal(this.saved.bullMode);
  protected readonly legs = signal(this.saved.legs);
  protected readonly sets = signal<number | null>(this.saved.sets);
  protected readonly bullOff = signal(this.saved.bullOff);
  protected readonly scoring = signal(this.saved.scoring);
  protected readonly opponents = signal<Opponent[]>(this.saved.opponents);

  protected readonly guestName = signal('');
  protected readonly boards = signal<DashboardBoard[] | null>(null);
  protected readonly starting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly full = computed(() => this.opponents().length + 1 >= MAX_PLAYERS);

  protected readonly summary = computed(() => {
    const sets = this.sets();
    const legs = this.legs();
    const target = sets
      ? `First to ${sets} ${sets === 1 ? 'Set' : 'Sets'} (je ${legs} ${legs === 1 ? 'Leg' : 'Legs'})`
      : `First to ${legs} ${legs === 1 ? 'Leg' : 'Legs'}`;
    const label = (m: InOutMode) => this.modes.find((x) => x.value === m)?.label ?? m;
    return `${this.baseScore()} · ${target} · ${label(this.inMode())} In · ${label(this.outMode())} Out`;
  });

  protected readonly scoringBoard = computed(
    () => this.boards()?.find((b) => b.id === this.scoring()) ?? null,
  );

  ngOnInit(): void {
    const userId = this.users.session()?.user.id;
    if (!userId) return;
    firstValueFrom(this.dashboardApi.boards(userId))
      .then((boards) => {
        this.boards.set(boards);
        const current = this.scoring();
        const known = current === 'manual' || boards.some((b) => b.id === current);
        // Prefer a board that is online right now when the saved choice is gone.
        if (!known) this.scoring.set(boards.find((b) => b.connected)?.id ?? 'manual');
      })
      .catch(() => this.boards.set([]));
  }

  protected changeLegs(delta: number): void {
    this.legs.update((n) => Math.min(11, Math.max(1, n + delta)));
  }

  protected changeSets(delta: number): void {
    this.sets.update((n) => {
      const next = (n ?? 0) + delta;
      return next < 1 ? null : Math.min(7, next);
    });
  }

  protected addBot(average: number): void {
    if (this.full()) return;
    this.opponents.update((list) => [...list, { kind: 'bot', average }]);
  }

  protected addGuest(): void {
    const name = this.guestName().trim();
    if (!name || this.full()) return;
    this.opponents.update((list) => [...list, { kind: 'guest', name: name.slice(0, 32) }]);
    this.guestName.set('');
  }

  protected removeOpponent(index: number): void {
    this.opponents.update((list) => list.filter((_, i) => i !== index));
  }

  protected async start(): Promise<void> {
    const userId = this.users.session()?.user.id;
    if (!userId || this.starting()) return;
    const game: CreateGamePayload = {
      baseScore: this.baseScore(),
      inMode: this.inMode(),
      outMode: this.outMode(),
      bullMode: this.bullMode(),
      legs: this.legs(),
      ...(this.sets() ? { sets: this.sets() ?? undefined } : {}),
      bullOff: this.bullOff(),
      boardId: this.scoring() === 'manual' ? null : this.scoring(),
      opponents: this.opponents(),
    };
    this.save();
    this.starting.set(true);
    this.error.set(null);
    try {
      const { matchId } = await firstValueFrom(this.play.create(userId, game));
      await this.router.navigate(['/match', matchId]);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.starting.set(false);
    }
  }

  private save(): void {
    const settings: SavedSettings = {
      baseScore: this.baseScore(),
      inMode: this.inMode(),
      outMode: this.outMode(),
      bullMode: this.bullMode(),
      legs: this.legs(),
      sets: this.sets(),
      bullOff: this.bullOff(),
      scoring: this.scoring(),
      opponents: this.opponents(),
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Remembering the settings is a convenience only.
    }
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Server nicht erreichbar.';
      const body = (error.error ?? {}) as ApiErrorBody;
      if (typeof body.message === 'string') return body.message;
    }
    return 'Das Spiel konnte nicht gestartet werden.';
  }
}
