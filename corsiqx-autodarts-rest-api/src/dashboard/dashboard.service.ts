import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AutodartsApiClient } from '../autodarts/autodarts-api.client';
import { AutodartsSessionService } from '../autodarts/autodarts-session.service';
import {
  BoardCamera,
  toBoardCamera,
  toCalibration,
  toSnapshotUrl,
  HomeFriend,
  HomeProfile,
  HomeTournament,
  toFriends,
  toHomeProfile,
  toOnlineCount,
  toPlayableTournaments,
} from './home.mapper';
import { TtlCache } from './ttl-cache';
import {
  DashboardBoard,
  LiveMatch,
  MatchHistoryEntry,
  StatFigure,
  toBoards,
  toHistory,
  toLiveMatch,
  toMatchId,
  lastPageIndex,
  toStatFigures,
  unwrapList,
} from './dashboard.mapper';

export type BoardAction = 'start' | 'stop' | 'reset';

export interface DashboardStats {
  x01: StatFigure[] | null;
  history: MatchHistoryEntry[] | null;
}

export interface HomeOverview {
  /** `null` when Autodarts did not deliver it. */
  profile: HomeProfile | null;
  onlinePlayers: number | null;
}

const HISTORY_SIZE = 10;
/** Tournament cards shown on the start page. */
const TOURNAMENT_LIMIT = 9;

/** Board and match ids end up in upstream URLs, so only plain id characters are allowed. */
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  private readonly profiles = new TtlCache<HomeProfile | null>(60_000);
  private readonly online = new TtlCache<number | null>(120_000);
  private readonly tournamentLists = new TtlCache<unknown>(90_000);
  private readonly requirements = new TtlCache<boolean>(300_000);

  constructor(
    private readonly autodarts: AutodartsApiClient,
    private readonly sessions: AutodartsSessionService,
  ) {}

  /** Stat strip data and the number of players online; each part is `null` on failure. */
  async home(userId: string): Promise<HomeOverview> {
    const [profile, online] = await Promise.allSettled([
      this.profile(userId),
      this.online.get('all', async () =>
        toOnlineCount(await this.autodarts.get(userId, '/us/v0/users/online')),
      ),
    ]);
    this.logFailures('Home', [profile, online]);
    return {
      profile: profile.status === 'fulfilled' ? profile.value : null,
      onlinePlayers: online.status === 'fulfilled' ? online.value : null,
    };
  }

  async friends(userId: string): Promise<HomeFriend[]> {
    return toFriends(await this.autodarts.get(userId, '/as/v0/friends/'));
  }

  /**
   * Upcoming tournaments this account can enter. Filtered locally by the published limits,
   * then confirmed with Autodarts' requirements check for the few cards that are shown.
   */
  async tournaments(userId: string): Promise<HomeTournament[]> {
    const [session, profile, raw] = await Promise.all([
      this.sessions.ensure(userId),
      this.profile(userId),
      this.tournamentLists.get(userId, () =>
        this.autodarts.get(userId, '/ts/v0/tournaments'),
      ),
    ]);
    const candidates = toPlayableTournaments(
      raw,
      {
        autodartsUserId: session.autodartsUserId,
        average: profile?.average ?? null,
        plus: profile?.plus ?? false,
        legsPlayed: profile?.legsPlayed ?? null,
      },
      new Date(),
    ).filter((t) => SAFE_ID.test(t.id));

    const shown: HomeTournament[] = [];
    for (const tournament of candidates) {
      if (shown.length >= TOURNAMENT_LIMIT) {
        break;
      }
      if (
        tournament.registered ||
        (await this.meetsRequirements(userId, tournament.id))
      ) {
        shown.push(tournament);
      }
    }
    return shown;
  }

  private profile(userId: string): Promise<HomeProfile | null> {
    return this.profiles.get(userId, async () => {
      const { autodartsUserId } = await this.sessions.ensure(userId);
      if (!SAFE_ID.test(autodartsUserId)) {
        return null;
      }
      return toHomeProfile(
        await this.autodarts.get(userId, `/us/v0/users/${autodartsUserId}`),
      );
    });
  }

  /** Autodarts' own check; when it cannot answer, the local filter decides. */
  private async meetsRequirements(
    userId: string,
    tournamentId: string,
  ): Promise<boolean> {
    try {
      return await this.requirements.get(
        `${userId}:${tournamentId}`,
        async () => {
          const answer = await this.autodarts.get(
            userId,
            `/ts/v0/tournaments/${tournamentId}/requirements`,
          );
          return answer !== false;
        },
      );
    } catch (error) {
      this.logger.warn(`Requirements check failed: ${String(error)}`);
      return true;
    }
  }

  private logFailures(
    part: string,
    results: PromiseSettledResult<unknown>[],
  ): void {
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`${part} part failed: ${String(result.reason)}`);
      }
    }
  }

  async boards(userId: string): Promise<DashboardBoard[]> {
    return toBoards(await this.autodarts.get(userId, '/bs/v0/boards'));
  }

  async boardAction(
    userId: string,
    boardId: string,
    action: BoardAction,
  ): Promise<void> {
    if (!SAFE_ID.test(boardId)) {
      throw new BadRequestException({
        code: 'invalid_board_id',
        message: 'Ungültige Board-ID.',
      });
    }
    const path = `/bs/v0/boards/${boardId}`;
    if (action === 'reset') {
      await this.autodarts.request(userId, 'POST', `${path}/reset`);
    } else {
      await this.autodarts.request(userId, 'PUT', `${path}/${action}`);
    }
  }

  /** Camera sources of a board: local MJPEG streams and the board's address over TLS. */
  async camera(userId: string, boardId: string): Promise<BoardCamera | null> {
    const path = `/bs/v0/boards/${this.checkedBoardId(boardId)}`;
    // Calibration and camera stats only answer while the board is online.
    const optional = (suffix: string) =>
      this.autodarts.get(userId, `${path}${suffix}`).catch(() => null);
    const [board, numCams, ellipses, camStats] = await Promise.all([
      this.autodarts.get(userId, path),
      optional('/num-cams'),
      optional('/config/calibration/ellipses'),
      optional('/cams/stats'),
    ]);
    return toBoardCamera(board, numCams, toCalibration(ellipses, camStats));
  }

  /** One fresh camera picture through the Autodarts cloud (the slow fallback). */
  async snapshot(
    userId: string,
    boardId: string,
    cam: number,
  ): Promise<string | null> {
    const path = `/bs/v0/boards/${this.checkedBoardId(boardId)}/img/live?cam=${cam}&warp=false`;
    return toSnapshotUrl(await this.autodarts.get(userId, path));
  }

  private checkedBoardId(boardId: string): string {
    if (!SAFE_ID.test(boardId)) {
      throw new BadRequestException({
        code: 'invalid_board_id',
        message: 'Ungültige Board-ID.',
      });
    }
    return boardId;
  }

  /** The account's running match, or `null` when it is not playing. */
  async liveMatch(userId: string): Promise<LiveMatch | null> {
    const matchId = toMatchId(
      await this.autodarts.get(userId, '/us/v0/match-id'),
    );
    if (!matchId || !SAFE_ID.test(matchId)) {
      return null;
    }
    return toLiveMatch(
      await this.autodarts.get(userId, `/gs/v0/matches/${matchId}/state`),
    );
  }

  /** X01 figures and recent matches; each part is `null` if Autodarts did not deliver it. */
  async stats(userId: string): Promise<DashboardStats> {
    const [x01, history] = await Promise.allSettled([
      this.autodarts.get(userId, '/us/v0/profile/stats/x01?limit=100'),
      this.recentMatches(userId),
    ]);
    for (const result of [x01, history]) {
      if (result.status === 'rejected') {
        this.logger.warn(`Stats part failed: ${String(result.reason)}`);
      }
    }
    return {
      x01: x01.status === 'fulfilled' ? toStatFigures(x01.value) : null,
      history: history.status === 'fulfilled' ? toHistory(history.value) : null,
    };
  }

  /**
   * The history is paged oldest first and ignores sort parameters,
   * so the newest matches are on the last two pages.
   */
  private async recentMatches(userId: string): Promise<unknown[]> {
    const path = (page: number) =>
      `/as/v0/matches?size=${HISTORY_SIZE}&page=${page}`;
    const first = await this.autodarts.get(userId, path(0));
    const last = lastPageIndex(first);
    if (last === 0) {
      return unwrapList(first);
    }
    const pages = await Promise.all(
      [last, last - 1].map((page) =>
        page === 0 ? first : this.autodarts.get(userId, path(page)),
      ),
    );
    return pages.flatMap(unwrapList);
  }
}
