import { CamCalibration } from '../../shared/homography';

/** Shapes of `/api/users/:id/autodarts/play/*`. */

export type InOutMode = 'Straight' | 'Double' | 'Master';

export type Opponent = { kind: 'bot'; average: number } | { kind: 'guest'; name: string };

export interface CreateGamePayload {
  baseScore: number;
  inMode: InOutMode;
  outMode: InOutMode;
  bullMode: '25/50' | '50/50';
  legs: number;
  sets?: number;
  bullOff: boolean;
  /** `null`: scores are typed in by hand. */
  boardId: string | null;
  opponents: Opponent[];
}

export interface MatchViewPlayer {
  name: string;
  avatarUrl: string | null;
  country: string | null;
  isBot: boolean;
  botAverage: number | null;
  isMe: boolean;
  boardId: string | null;
  legs: number;
  sets: number;
  score: number | null;
  average: number | null;
  legAverage: number | null;
  dartsThrown: number;
  checkoutPercent: number | null;
}

export interface MatchViewTurn {
  id: string;
  playerIndex: number | null;
  round: number | null;
  points: number | null;
  busted: boolean;
  throws: string[];
  /** Board position per dart (radius 1 = outer double wire, +y up); `null` when typed in. */
  coords: ({ x: number; y: number } | null)[];
}

export interface MatchView {
  id: string;
  variant: string | null;
  type: string | null;
  baseScore: number | null;
  inMode: InOutMode | null;
  outMode: InOutMode | null;
  legsToWin: number | null;
  setsToWin: number | null;
  set: number | null;
  leg: number | null;
  round: number | null;
  maxRounds: number | null;
  currentPlayer: number | null;
  turnScore: number | null;
  turnBusted: boolean;
  gameFinished: boolean;
  gameWinner: number | null;
  finished: boolean;
  winner: number | null;
  players: MatchViewPlayer[];
  currentTurn: MatchViewTurn | null;
  recentTurns: MatchViewTurn[];
}

/** Where a board's cameras can be watched. */
export interface BoardCamera {
  boardId: string;
  name: string;
  connected: boolean;
  cams: number;
  localUrl: string | null;
  directUrl: string | null;
  /** Calibration per camera index, for straightening the picture. */
  calibration: {
    width: number;
    height: number;
    cams: Record<string, CamCalibration>;
  } | null;
}

export type MatchAction = 'undo' | 'next-player' | 'next-leg';
