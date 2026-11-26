import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { DashboardBoard, LiveMatch } from './dashboard.mapper';
import type { BoardAction, DashboardStats } from './dashboard.service';
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
}
