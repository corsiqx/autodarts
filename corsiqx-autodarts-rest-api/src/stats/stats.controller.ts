import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  MatchDetail,
  MatchHistory,
  STAT_VARIANTS,
  StatsOverview,
} from './stats.mapper';
import type { StatVariant } from './stats.mapper';
import { StatsService } from './stats.service';
import type { MatchTypeFilter } from './stats.service';

const MATCH_TYPES = {
  Local: 'Local',
  Online: 'Online',
  'Match Making': 'Match Making',
  Tournament: 'Tournament',
} as const;

/** Statistics and match history of a stored account. */
@Controller('users/:userId/autodarts/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview/:variant')
  overview(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('variant', new ParseEnumPipe(STAT_VARIANTS)) variant: StatVariant,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ): Promise<StatsOverview> {
    return this.stats.overview(
      userId,
      variant,
      Math.min(Math.max(limit, 1), 1000),
    );
  }

  @Get('matches')
  history(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('type', new ParseEnumPipe(MATCH_TYPES, { optional: true }))
    type?: MatchTypeFilter,
  ): Promise<MatchHistory> {
    return this.stats.history(userId, Math.max(page, 0), type);
  }

  @Get('matches/:matchId')
  async match(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('matchId') matchId: string,
  ): Promise<MatchDetail> {
    const detail = await this.stats.match(userId, matchId);
    if (!detail) {
      throw new NotFoundException({
        code: 'match_not_found',
        message: 'Für dieses Match gibt es (noch) keine Statistik.',
      });
    }
    return detail;
  }
}
