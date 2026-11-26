/** Shapes returned by `/api/users/:id/autodarts/*`. */

export interface DashboardBoard {
  id: string;
  name: string;
  type: string | null;
  connected: boolean;
  status: string | null;
  event: string | null;
  matchId: string | null;
  version: string | null;
}

export type BoardAction = 'start' | 'stop' | 'reset';

export interface LiveMatchPlayer {
  name: string;
  avatarUrl: string | null;
  legs: number;
  sets: number;
  score: number | null;
}

export interface LiveMatch {
  id: string;
  variant: string | null;
  finished: boolean;
  round: number | null;
  set: number | null;
  leg: number | null;
  target: { legs: number | null; sets: number | null };
  currentPlayer: number | null;
  winner: number | null;
  turnScore: number | null;
  players: LiveMatchPlayer[];
  lastTurn: {
    playerIndex: number | null;
    score: number | null;
    busted: boolean;
    throws: string[];
  } | null;
}

export interface StatFigure {
  key: string;
  label: string;
  value: number;
  unit: 'number' | 'percent';
  /** Context line, e.g. "Bestes Leg 56,6". */
  detail: string | null;
}

export interface MatchHistoryEntry {
  id: string;
  variant: string | null;
  type: string | null;
  date: string | null;
  players: string[];
  winner: string | null;
}

export interface DashboardStats {
  /** `null` when Autodarts did not deliver this part. */
  x01: StatFigure[] | null;
  history: MatchHistoryEntry[] | null;
}

/** Load state of one dashboard panel. */
export interface Resource<T> {
  data: T | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
}
