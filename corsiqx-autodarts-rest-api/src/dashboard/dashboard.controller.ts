import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { DashboardBoard, LiveMatch } from './dashboard.mapper';
import type {
  BoardAction,
  DashboardStats,
  HomeOverview,
} from './dashboard.service';
import type { BoardCamera, HomeFriend, HomeTournament } from './home.mapper';
import { DashboardService } from './dashboard.service';

const BOARD_ACTIONS = { start: 'start', stop: 'stop', reset: 'reset' } as const;

/** Autodarts data of a stored account, fetched with its Autodarts login. */
@Controller('users/:userId/autodarts')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('boards')
  boards(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<DashboardBoard[]> {
    return this.dashboard.boards(userId);
  }

  @Post('boards/:boardId/:action')
  @HttpCode(204)
  boardAction(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('boardId') boardId: string,
    @Param('action', new ParseEnumPipe(BOARD_ACTIONS)) action: BoardAction,
  ): Promise<void> {
    return this.dashboard.boardAction(userId, boardId, action);
  }

  @Get('boards/:boardId/camera')
  async camera(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('boardId') boardId: string,
  ): Promise<BoardCamera> {
    const camera = await this.dashboard.camera(userId, boardId);
    if (!camera) {
      throw new NotFoundException({
        code: 'board_not_found',
        message: 'Board nicht gefunden.',
      });
    }
    return camera;
  }

  @Get('boards/:boardId/camera/:cam/snapshot')
  async snapshot(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('boardId') boardId: string,
    @Param('cam', new ParseIntPipe()) cam: number,
  ): Promise<{ url: string | null }> {
    const index = Math.max(0, Math.min(cam, 5));
    return { url: await this.dashboard.snapshot(userId, boardId, index) };
  }

  @Get('match')
  match(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<LiveMatch | null> {
    return this.dashboard.liveMatch(userId);
  }

  @Get('stats')
  stats(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<DashboardStats> {
    return this.dashboard.stats(userId);
  }

  @Get('home')
  home(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<HomeOverview> {
    return this.dashboard.home(userId);
  }

  @Get('friends')
  friends(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<HomeFriend[]> {
    return this.dashboard.friends(userId);
  }

  @Get('tournaments')
  tournaments(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<HomeTournament[]> {
    return this.dashboard.tournaments(userId);
  }
}
