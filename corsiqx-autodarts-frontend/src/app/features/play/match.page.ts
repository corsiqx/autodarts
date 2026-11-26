import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom, timer } from 'rxjs';
import {
  BoardCamera,
  MatchAction,
  MatchView,
  MatchViewPlayer,
  MatchViewTurn,
} from '../../core/play/play.model';
import { PlayApiService } from '../../core/play/play-api.service';
import { ApiErrorBody } from '../../core/users/user.model';
import { UsersStore } from '../../core/users/users.store';
import { Avatar } from '../../shared/avatar';
import { botLevel } from '../../shared/average-tier';
import { BotTag } from '../../shared/bot-tag';
import { checkoutRoute } from '../../shared/checkout';
import { BoardHit, Dartboard } from '../../shared/dartboard';
import { Flag } from '../../shared/flag';
import { BoardCameraView } from './board-camera';
import { BoardCameraFusion, canFuse } from './board-camera-fusion';

const POLL_MS = 1_000;
const oneDecimal = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type Multiplier = 'S' | 'D' | 'T';
type InputMode = 'darts' | 'score';
/** What the middle shows: the drawn board, or camera n of the scoring board. */
type View = { kind: 'board' } | { kind: 'all' } | { kind: 'cam'; index: number };

const MODE_SHORT: Record<string, string> = { Straight: 'SI', Double: 'D', Master: 'M' };
const OUT_SHORT: Record<string, string> = { Straight: 'SO', Double: 'DO', Master: 'MO' };

/** A running X01 match: player tiles left and right, board or camera in the middle. */
@Component({
  selector: 'app-match-page',
  imports: [NgTemplateOutlet, RouterLink, Avatar, Flag, Dartboard, BoardCameraView, BoardCameraFusion, BotTag],
  templateUrl: './match.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchPage implements OnInit {
  /** Route parameter. */
  readonly matchId = input.required<string>();

  private readonly users = inject(UsersStore);
  private readonly api = inject(PlayApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly abortDialog = viewChild<ElementRef<HTMLDialogElement>>('abortDialog');

  protected readonly numbers = Array.from({ length: 20 }, (_, i) => i + 1);
  protected readonly quickScores = [26, 41, 45, 60, 81, 85, 100, 140, 180];

  protected readonly match = signal<MatchView | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly multiplier = signal<Multiplier>('S');
  protected readonly inputMode = signal<InputMode>('darts');
  protected readonly typedScore = signal('');
  protected readonly keypadOpen = signal(false);
  protected readonly camera = signal<BoardCamera | null>(null);
  protected readonly view = signal<View>({ kind: 'board' });

  /** Actions run one after another, so fast taps keep their order. */
  private queue: Promise<void> = Promise.resolve();
  private inFlight = false;

  /**
   * Autodarts only sends the visits of the running round, so finished visits are collected here
   * (keyed by id, so undo and corrections replace them).
   */
  private readonly seenTurns = signal(new Map<string, MatchViewTurn>());

  protected readonly current = computed(() => {
    const m = this.match();
    return m && m.currentPlayer !== null ? (m.players[m.currentPlayer] ?? null) : null;
  });

  protected readonly turn = computed(() => {
    const m = this.match();
    const turn = m?.currentTurn;
    return turn && turn.playerIndex === m?.currentPlayer ? turn : null;
  });

  protected readonly turnThrows = computed(() => this.turn()?.throws ?? []);
  protected readonly turnCoords = computed(() => this.turn()?.coords ?? []);
  protected readonly turnPoints = computed(() => this.turn()?.points ?? 0);

  /** Manual entry is for people; bots throw by themselves. */
  protected readonly canEnter = computed(() => {
    const m = this.match();
    const player = this.current();
    return !!m && !!player && !player.isBot && !m.finished && !m.gameFinished;
  });

  protected readonly turnFull = computed(
    () => this.turnThrows().length >= 3 || !!this.match()?.turnBusted,
  );

  protected readonly checkout = computed(() => {
    const m = this.match();
    const player = this.current();
    if (!m || !player || player.score === null || m.gameFinished) return null;
    const left = 3 - this.turnThrows().length;
    if (player.score > 170 || left <= 0) return null;
    return checkoutRoute(player.score, m.outMode ?? 'Double', left);
  });

  /** Chips like "501", "Erster bis 3 Legs", "SI-DO". */
  protected readonly chips = computed(() => {
    const m = this.match();
    if (!m) return [];
    const chips = [String(m.baseScore ?? m.variant ?? 'X01')];
    if (m.setsToWin) chips.push(`Erster bis ${m.setsToWin} ${m.setsToWin === 1 ? 'Set' : 'Sets'}`);
    else if (m.legsToWin) chips.push(`Erster bis ${m.legsToWin} ${m.legsToWin === 1 ? 'Leg' : 'Legs'}`);
    chips.push(`${MODE_SHORT[m.inMode ?? ''] ?? 'SI'}-${OUT_SHORT[m.outMode ?? ''] ?? 'DO'}`);
    return chips;
  });

  protected readonly winner = computed(() => {
    const m = this.match();
    return m && m.winner !== null ? (m.players[m.winner] ?? null) : null;
  });

  protected readonly legWinner = computed(() => {
    const m = this.match();
    return m && m.gameFinished && m.gameWinner !== null ? (m.players[m.gameWinner] ?? null) : null;
  });

  /** Player tiles split into the left and right column (1 | 2, 1 3 | 2 4, …). */
  protected readonly sides = computed(() => {
    const players = this.match()?.players ?? [];
    const withIndex = players.map((player, index) => ({ player, index }));
    return {
      left: withIndex.filter((p) => p.index % 2 === 0),
      right: withIndex.filter((p) => p.index % 2 === 1),
    };
  });

  /** The board that scores this match: the current player's, else any human's. */
  private readonly boardId = computed(() => {
    const m = this.match();
    if (!m) return null;
    return this.current()?.boardId ?? m.players.find((p) => p.boardId)?.boardId ?? null;
  });

  protected readonly uid = computed(() => this.users.session()?.user.id ?? '');

  private get userId(): string {
    return this.uid();
  }

  constructor() {
    // Load the camera sources once per scoring board; show the camera by default when it is online.
    effect(() => {
      const boardId = this.boardId();
      untracked(() => {
        if (!boardId) {
          this.camera.set(null);
          this.view.set({ kind: 'board' });
          return;
        }
        if (this.camera()?.boardId === boardId) return;
        firstValueFrom(this.api.camera(this.userId, boardId))
          .then((camera) => {
            this.camera.set(camera);
            if (camera.connected) {
              this.view.set(canFuse(camera) ? { kind: 'all' } : { kind: 'cam', index: 0 });
            }
          })
          .catch(() => this.camera.set(null));
      });
    });
  }

  ngOnInit(): void {
    timer(0, POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (document.visibilityState !== 'hidden') void this.refresh();
      });
  }

  protected format(value: number | null): string {
    return value === null ? '0,0' : oneDecimal.format(value);
  }

  /** Last finished visit of a player, from the collected history. */
  protected lastVisit(index: number): MatchViewTurn | null {
    const turns = [...this.seenTurns().values()];
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].playerIndex === index) return turns[i];
    }
    return null;
  }

  /** Board → all cameras combined → camera 1 → camera 2 … → board. */
  protected nextView(): void {
    const camera = this.camera();
    const view = this.view();
    if (!camera) {
      this.view.set({ kind: 'board' });
    } else if (view.kind === 'board') {
      this.view.set(canFuse(camera) ? { kind: 'all' } : { kind: 'cam', index: 0 });
    } else if (view.kind === 'all') {
      this.view.set({ kind: 'cam', index: 0 });
    } else if (view.index + 1 < camera.cams) {
      this.view.set({ kind: 'cam', index: view.index + 1 });
    } else {
      this.view.set({ kind: 'board' });
    }
  }

  /** A combined stream failed: fall back to a single camera, which can also use the cloud. */
  protected fusionFailed(): void {
    this.view.set({ kind: 'cam', index: 0 });
  }

  protected boardHit(hit: BoardHit): void {
    if (!this.canEnter() || this.turnFull()) return;
    this.run(() =>
      this.api.throwDart(this.userId, this.matchId(), hit.segment, { x: hit.x, y: hit.y }),
    );
  }

  protected throwDart(number: number | 'Bull' | '25' | 'Miss'): void {
    const segment = typeof number === 'number' ? `${this.multiplier()}${number}` : number;
    this.multiplier.set('S');
    this.run(() => this.api.throwDart(this.userId, this.matchId(), segment));
  }

  protected typeDigit(digit: string): void {
    this.typedScore.update((value) => {
      const next = (value + digit).replace(/^0+(?=\d)/, '');
      return Number(next) > 180 ? value : next;
    });
  }

  protected deleteDigit(): void {
    this.typedScore.update((value) => value.slice(0, -1));
  }

  protected submitScore(score?: number): void {
    const value = score ?? Number(this.typedScore() || '0');
    if (!Number.isInteger(value) || value < 0 || value > 180) return;
    this.typedScore.set('');
    this.run(() => this.api.scoreTurn(this.userId, this.matchId(), value));
  }

  protected act(action: MatchAction): void {
    this.run(() => this.api.action(this.userId, this.matchId(), action));
  }

  protected openAbort(): void {
    this.abortDialog()?.nativeElement.showModal();
  }

  protected closeAbort(): void {
    this.abortDialog()?.nativeElement.close();
  }

  protected async abort(): Promise<void> {
    this.closeAbort();
    try {
      await firstValueFrom(this.api.abort(this.userId, this.matchId()));
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.actionError.set(this.message(error, 'Match konnte nicht abgebrochen werden.'));
    }
  }

  protected async rematch(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const { matchId } = await firstValueFrom(this.api.rematch(this.userId, this.matchId()));
      this.match.set(null);
      await this.router.navigate(['/match', matchId]);
    } catch (error) {
      this.actionError.set(this.message(error, 'Revanche konnte nicht gestartet werden.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected isActive(index: number): boolean {
    const m = this.match();
    return !!m && m.currentPlayer === index && !m.finished;
  }

  protected playerLabel(player: MatchViewPlayer): string {
    return player.isBot && player.botAverage !== null
      ? `Bot-Level ${botLevel(player.botAverage)}`
      : player.name;
  }

  private run(request: () => Observable<void>): void {
    this.actionError.set(null);
    this.queue = this.queue.then(async () => {
      this.busy.set(true);
      try {
        await firstValueFrom(request());
      } catch (error) {
        this.actionError.set(this.message(error, 'Eingabe wurde nicht angenommen.'));
      } finally {
        this.busy.set(false);
      }
      await this.refresh();
    });
  }

  private async refresh(): Promise<void> {
    if (this.inFlight || !this.userId) return;
    this.inFlight = true;
    try {
      const view = await firstValueFrom(this.api.state(this.userId, this.matchId()));
      this.remember(view);
      this.match.set(view);
      this.loadError.set(null);
    } catch (error) {
      this.loadError.set(this.message(error, 'Match konnte nicht geladen werden.'));
    } finally {
      this.inFlight = false;
    }
  }

  private remember(view: MatchView): void {
    if (view.id !== this.match()?.id) {
      this.seenTurns.set(new Map());
    }
    // Oldest first, so the map keeps play order.
    const finished = [...view.recentTurns].reverse().filter((turn) => turn.id);
    if (!finished.length) return;
    this.seenTurns.update((seen) => {
      const next = new Map(seen);
      for (const turn of finished) next.set(turn.id, turn);
      // A visit that came back as the running one (undo) is no longer finished.
      if (view.currentTurn?.id) next.delete(view.currentTurn.id);
      return next;
    });
  }

  private message(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Server nicht erreichbar.';
      const body = (error.error ?? {}) as ApiErrorBody;
      if (typeof body.message === 'string') return body.message;
    }
    return fallback;
  }
}
