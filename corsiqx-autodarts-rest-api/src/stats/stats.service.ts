import { BadRequestException, Injectable } from '@nestjs/common';
import { AutodartsApiClient } from '../autodarts/autodarts-api.client';
import {
  MatchDetail,
  MatchHistory,
  StatVariant,
  StatsOverview,
  toMatchDetail,
  toMatchHistory,
  toStatsOverview,
} from './stats.mapper';

export type MatchTypeFilter =
  'Local' | 'Online' | 'Match Making' | 'Tournament';

const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;
const HISTORY_PAGE_SIZE = 10;

@Injectable()
export class StatsService {
  constructor(private readonly autodarts: AutodartsApiClient) {}

  async overview(
    userId: string,
    variant: StatVariant,
    limit: number,
  ): Promise<StatsOverview> {
    return toStatsOverview(
      variant,
      await this.autodarts.get(
        userId,
        `/us/v0/profile/stats/${variant}?limit=${limit}`,
      ),
    );
  }

  /** Newest first, like play.autodarts.com's match history. */
  async history(
    userId: string,
    page: number,
    type?: MatchTypeFilter,
  ): Promise<MatchHistory> {
    const params = new URLSearchParams({
      size: String(HISTORY_PAGE_SIZE),
      page: String(page),
      sort: '-finished_at',
    });
    if (type) params.set('types', type);
    return toMatchHistory(
      await this.autodarts.get(userId, `/as/v0/matches/filter?${params}`),
    );
  }

  async match(userId: string, matchId: string): Promise<MatchDetail | null> {
    if (!SAFE_ID.test(matchId)) {
      throw new BadRequestException({
        code: 'invalid_match_id',
        message: 'Ungültige Match-ID.',
      });
    }
    return toMatchDetail(
      await this.autodarts.get(userId, `/as/v0/matches/${matchId}/stats`),
    );
  }
}
