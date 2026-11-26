/** Shapes of `/api/users/:id/autodarts/stats/*`. */

export type StatVariant = 'x01' | 'cricket' | 'countup' | 'random-checkout' | 'killer' | 'bobs27';
export type MatchType = 'Local' | 'Online' | 'Match Making' | 'Tournament';

export type StatBlock = Record<string, number>;

export interface StatsOverview {
  variant: StatVariant;
  totalLegs: number | null;
  legsWon: number | null;
  soloGames: number | null;
  legs: number | null;
  legsWonInWindow: number | null;
  previousLegs: number | null;
  current: StatBlock;
  previous: StatBlock;
  best: StatBlock;
}

export interface HistoryPlayer {
  name: string;
  avatarUrl: string | null;
  country: string | null;
  isBot: boolean;
  botAverage: number | null;
  legs: number;
  sets: number;
  winner: boolean;
}

export interface HistoryMatch {
  id: string;
  variant: string | null;
  type: string | null;
  finishedAt: string | null;
  players: HistoryPlayer[];
  hasSets: boolean;
}

export interface MatchHistory {
  items: HistoryMatch[];
  page: number;
  totalPages: number;
  total: number;
  counts: { local: number; online: number; matchmaking: number; tournament: number };
}

export interface MatchPlayerStats {
  dartsThrown: number;
  average: number | null;
  first9Average: number | null;
  averageUntil170: number | null;
  checkoutsHit: number;
  checkouts: number;
  checkoutPercent: number | null;
  highestFinish: number | null;
  plus60: number;
  plus100: number;
  plus140: number;
  plus170: number;
  total180: number;
}

export interface MatchVisit {
  round: number;
  points: number;
  remaining: number | null;
  busted: boolean;
  throws: string[];
}

export interface MatchLeg {
  set: number;
  leg: number;
  winner: number | null;
  visits: MatchVisit[][];
}

export interface MatchDetail {
  id: string;
  variant: string | null;
  type: string | null;
  finishedAt: string | null;
  duration: string | null;
  baseScore: number | null;
  inMode: string | null;
  outMode: string | null;
  targetLegs: number | null;
  targetSets: number | null;
  players: (HistoryPlayer & { stats: MatchPlayerStats | null })[];
  legs: MatchLeg[];
  heat: { x: number; y: number }[][];
}
