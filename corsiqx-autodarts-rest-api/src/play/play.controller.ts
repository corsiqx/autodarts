import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { CreateGameDto } from './dto/create-game.dto';
import type { MatchView } from './play.mapper';
import { PlayService } from './play.service';
import type { MatchAction } from './play.service';
import { SEGMENT_NAMES } from './segments';

class ThrowDto {
  @IsIn(SEGMENT_NAMES)
  segment!: string;

  /** Board position of a tap on the drawn board (radius 1 = outer double wire). */
  @IsOptional()
  @IsNumber()
  @Min(-1.5)
  @Max(1.5)
  x?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1.5)
  @Max(1.5)
  y?: number;
}

class TurnDto {
  @IsInt()
  @Min(0)
  @Max(180)
  score!: number;
}

const ACTIONS = {
  undo: 'undo',
  'next-player': 'next-player',
  'next-leg': 'next-leg',
} as const;

/** Play X01 on the Autodarts game server with a stored account. */
@Controller('users/:userId/autodarts/play')
export class PlayController {
  constructor(private readonly play: PlayService) {}

  @Post()
  create(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() game: CreateGameDto,
  ): Promise<{ matchId: string }> {
    return this.play.create(userId, game);
  }

  @Get(':matchId')
  async state(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('matchId') matchId: string,
  ): Promise<MatchView> {
    const view = await this.play.state(userId, matchId);
    if (!view) {
      throw new NotFoundException({
        code: 'match_not_found',
        message: 'Das Match gibt es nicht mehr.',
      });
    }
    return view;
  }

  @Post(':matchId/throws')
  @HttpCode(204)
  throwDart(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('matchId') matchId: string,
    @Body() body: ThrowDto,
  ): Promise<void> {
    const coords =
      body.x !== undefined && body.y !== undefined
        ? { x: body.x, y: body.y }
        : undefined;
    return this.play.throwDart(userId, matchId, body.segment, coords);
  }

  @Post(':matchId/turns')
  @HttpCode(204)
  scoreTurn(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('matchId') matchId: string,
    @Body() body: TurnDto,
  ): Promise<void> {
    return this.play.scoreTurn(userId, matchId, body.score);
  }

  @Post(':matchId/rematch')
  rematch(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('matchId') matchId: string,
  ): Promise<{ matchId: string }> {
    return this.play.rematch(userId, matchId);
  }

  @Post(':matchId/:action')
  @HttpCode(204)
  action(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('matchId') matchId: string,
    @Param('action', new ParseEnumPipe(ACTIONS)) action: MatchAction,
  ): Promise<void> {
    return this.play.action(userId, matchId, action);
  }

  @Delete(':matchId')
  @HttpCode(204)
  abort(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('matchId') matchId: string,
  ): Promise<void> {
    return this.play.abort(userId, matchId);
  }
}
