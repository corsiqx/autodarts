import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AutodartsApiClient } from '../autodarts/autodarts-api.client';
import { AutodartsSessionService } from '../autodarts/autodarts-session.service';
import { idOf, isObject, list, num, str } from '../dashboard/dashboard.mapper';
import { CreateGameDto } from './dto/create-game.dto';
import { MatchView, MatchViewTurn, toMatchView, toTurn } from './play.mapper';
import { TtlCache } from '../dashboard/ttl-cache';
import { segmentByName } from './segments';

export type MatchAction = 'undo' | 'next-player' | 'next-leg';

/** Ids end up in upstream URLs, so only plain id characters are allowed. */
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

const ACTION_PATHS: Record<MatchAction, string> = {
  undo: '/undo',
  'next-player': '/players/next',
  'next-leg': '/games/next',
};

/** Starts games on the Autodarts game server and plays them through it. */
@Injectable()
export class PlayService {
  private readonly logger = new Logger(PlayService.name);
  /** The visit before the running one; it only changes when the turn passes on. */
  private readonly previousTurns = new TtlCache<MatchViewTurn | null>(120_000);

  constructor(
    private readonly autodarts: AutodartsApiClient,
    private readonly sessions: AutodartsSessionService,
  ) {}

  /**
   * Same steps as play.autodarts.com: private lobby, host first, then bots and guests,
   * then start. A lobby that fails half way is deleted again.
   */
  async create(
    userId: string,
    game: CreateGameDto,
  ): Promise<{ matchId: string }> {
    const session = await this.sessions.ensure(userId);
    const boardId = game.boardId ?? null;

    const lobby = await this.autodarts.request(
      userId,
      'POST',
      '/gs/v0/lobbies',
      {
        variant: 'X01',
        isPrivate: true,
        bullOffMode: game.bullOff ? 'Normal' : 'Off',
        legs: game.legs,
        ...(game.sets ? { sets: game.sets } : {}),
        settings: {
          baseScore: game.baseScore,
          inMode: game.inMode,
          outMode: game.outMode,
          bullMode: game.bullMode,
          maxRounds: 50,
        },
      },
    );
    const lobbyId = isObject(lobby) ? idOf(lobby.id) : '';
    if (!SAFE_ID.test(lobbyId)) {
      throw new BadRequestException({
        code: 'lobby_failed',
        message: 'Autodarts hat kein Spiel angelegt.',
      });
    }

    const base = `/gs/v0/lobbies/${lobbyId}`;
    try {
      await this.autodarts.request(userId, 'POST', `${base}/players`, {
        name: session.autodartsUsername ?? session.user.name,
        userId: session.autodartsUserId,
        boardId,
      });
      let bot = 0;
      for (const opponent of game.opponents) {
        if (opponent.kind === 'bot') {
          bot++;
          await this.autodarts.request(userId, 'POST', `${base}/players`, {
            name: `Bot ${opponent.average}${bot > 1 ? ` (${bot})` : ''}`,
            cpuPPR: opponent.average,
            cpuSpeed: 'realistic',
          });
        } else {
          await this.autodarts.request(userId, 'POST', `${base}/players`, {
            name: opponent.name,
            hostId: session.autodartsUserId,
            boardId,
          });
        }
      }
      const match = await this.autodarts.request(
        userId,
        'POST',
        `${base}/start`,
      );
      const matchId = isObject(match) ? idOf(match.id) : lobbyId;
      return { matchId: matchId || lobbyId };
    } catch (error) {
      await this.autodarts
        .request(userId, 'DELETE', base)
        .catch((cleanup) =>
          this.logger.warn(`Lobby cleanup failed: ${String(cleanup)}`),
        );
      throw error;
    }
  }

  async state(userId: string, matchId: string): Promise<MatchView | null> {
    const session = await this.sessions.ensure(userId);
    const raw = await this.autodarts.get(
      userId,
      `${this.matchPath(matchId)}/state`,
    );
    const view = toMatchView(raw, session.autodartsUserId);
    if (view && isObject(raw)) {
      const previous = await this.previousTurn(userId, matchId, raw).catch(
        (error) => {
          this.logger.warn(`Previous visit failed: ${String(error)}`);
          return null;
        },
      );
      if (
        previous &&
        !view.recentTurns.some((turn) => turn.id === previous.id)
      ) {
        view.recentTurns = [previous, ...view.recentTurns];
      }
    }
    return view;
  }

  /**
   * The state only holds the running round, so the visit of the player before the current one
   * is read from `players/{id}/last-turn`, once per visit.
   */
  private previousTurn(
    userId: string,
    matchId: string,
    raw: Record<string, unknown>,
  ): Promise<MatchViewTurn | null> {
    const players = list(raw.players).filter(isObject);
    const current = num(raw.player);
    const running = list(raw.turns).filter(isObject).at(-1);
    if (players.length === 0 || current === null || current < 0 || !running) {
      return Promise.resolve(null);
    }
    const previousId = str(
      players[(current - 1 + players.length) % players.length].id,
    );
    if (!previousId || !SAFE_ID.test(previousId)) {
      return Promise.resolve(null);
    }
    const ids = players.map((player) => str(player.id));
    return this.previousTurns.get(
      `${matchId}:${idOf(running.id)}`,
      async () => {
        const turn = await this.autodarts.get(
          userId,
          `${this.matchPath(matchId)}/players/${previousId}/last-turn`,
        );
        return turn ? toTurn(turn, ids) : null;
      },
    );
  }

  async throwDart(
    userId: string,
    matchId: string,
    segmentName: string,
    coords?: { x: number; y: number },
  ): Promise<void> {
    const segment = segmentByName(segmentName);
    if (!segment) {
      throw new BadRequestException({
        code: 'invalid_segment',
        message: 'Unbekanntes Feld.',
      });
    }
    // A tap on the drawn board carries its position, like play.autodarts.com's board input.
    await this.autodarts.request(
      userId,
      'POST',
      `${this.matchPath(matchId)}/throws`,
      coords
        ? { entry: 'manual_coords', segment, coords }
        : { entry: 'manual_keyboard', segment },
    );
  }

  /** A whole visit by its total, like the score keypad on play.autodarts.com. */
  async scoreTurn(
    userId: string,
    matchId: string,
    score: number,
  ): Promise<void> {
    await this.autodarts.request(
      userId,
      'POST',
      `${this.matchPath(matchId)}/turns`,
      { score },
    );
  }

  async action(
    userId: string,
    matchId: string,
    action: MatchAction,
  ): Promise<void> {
    await this.autodarts.request(
      userId,
      'POST',
      `${this.matchPath(matchId)}${ACTION_PATHS[action]}`,
    );
  }

  async abort(userId: string, matchId: string): Promise<void> {
    await this.autodarts.request(userId, 'DELETE', this.matchPath(matchId));
  }

  /** Same players and settings again, started right away. */
  async rematch(userId: string, matchId: string): Promise<{ matchId: string }> {
    const lobby = await this.autodarts.request(
      userId,
      'POST',
      `/gs/v0/lobbies/from-match/${this.checkedId(matchId)}`,
    );
    const lobbyId = isObject(lobby) ? idOf(lobby.id) : '';
    if (!SAFE_ID.test(lobbyId)) {
      throw new BadRequestException({
        code: 'lobby_failed',
        message: 'Autodarts hat keine Revanche angelegt.',
      });
    }
    const match = await this.autodarts.request(
      userId,
      'POST',
      `/gs/v0/lobbies/${lobbyId}/start`,
    );
    return { matchId: (isObject(match) ? idOf(match.id) : '') || lobbyId };
  }

  private matchPath(matchId: string): string {
    return `/gs/v0/matches/${this.checkedId(matchId)}`;
  }

  private checkedId(matchId: string): string {
    if (!SAFE_ID.test(matchId)) {
      throw new BadRequestException({
        code: 'invalid_match_id',
        message: 'Ungültige Match-ID.',
      });
    }
    return matchId;
  }
}
