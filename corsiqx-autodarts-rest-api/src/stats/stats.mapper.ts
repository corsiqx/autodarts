import {
  idOf,
  isObject,
  Json,
  list,
  num,
  str,
} from '../dashboard/dashboard.mapper';

/**
 * Statistics page: per-variant overview (`us/v0/profile/stats/{variant}`), match history
 * (`as/v0/matches/filter`) and single matches (`as/v0/matches/{id}/stats`).
 * Shapes taken from live answers; every field is read defensively.
 */

export const STAT_VARIANTS = {
  x01: 'x01',
  cricket: 'cricket',
  countup: 'countup',
  'random-checkout': 'random-checkout',
  killer: 'killer',
  bobs27: 'bobs27',
} as const;
export type StatVariant = keyof typeof STAT_VARIANTS;

/** Numbers of one stats block (`average`, `averageLast`, `best`); ratios stay as Autodarts sends them. */
export type StatBlock = Record<string, number>;

export interface StatsOverview {
  variant: StatVariant;
  totalLegs: number | null;
  legsWon: number | null;
  soloGames: number | null;
  /** Legs in the selected window (e.g. the last 100) and the window before it. */
  legs: number | null;
  legsWonInWindow: number | null;
  previousLegs: number | null;
  current: StatBlock;
  previous: StatBlock;
  best: StatBlock;
}

const numbers = (value: unknown): StatBlock => {
  const out: StatBlock = {};
  if (isObject(value)) {
    for (const [key, v] of Object.entries(value)) {
      const n = num(v);
      if (n !== null) out[key] = n;
    }
  }
  return out;
};

export function toStatsOverview(
  variant: StatVariant,
  payload: unknown,
): StatsOverview {
  const p = isObject(payload) ? payload : {};
  return {
    variant,
    totalLegs: num(p.totalLegs),
    legsWon: num(p.legsWon),
    soloGames: num(p.soloGame),
    legs: num(p.numLegs),
    legsWonInWindow: num(p.numLegsWon),
    previousLegs: num(p.numLegsLast),
    current: numbers(p.average),
    previous: numbers(p.averageLast),
    best: numbers(p.best),
  };
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
  counts: {
    local: number;
    online: number;
    matchmaking: number;
    tournament: number;
  };
}

function toPlayers(match: Json): HistoryPlayer[] {
  const scores = list(match.scores);
  const winner = num(match.winner);
  return list(match.players)
    .filter(isObject)
    .map((player, index) => {
      const user = isObject(player.user) ? player.user : {};
      const score = isObject(scores[index]) ? scores[index] : {};
      const bot = num(player.cpuPPR);
      return {
        name: str(player.name) ?? str(user.name) ?? `Spieler ${index + 1}`,
        avatarUrl: str(player.avatarUrl) ?? str(user.avatarUrl),
        country: str(user.country)?.toLowerCase() ?? null,
        isBot: bot !== null,
        botAverage: bot,
        legs: num(score.legs) ?? 0,
        sets: num(score.sets) ?? 0,
        winner: winner === index,
      };
    });
}

export function toMatchHistory(payload: unknown): MatchHistory {
  const p = isObject(payload) ? payload : {};
  const counts = isObject(p.counts) ? p.counts : {};
  const items = list(p.items)
    .filter(isObject)
    .map((match): HistoryMatch => {
      const players = toPlayers(match);
      return {
        id: idOf(match.id),
        variant: str(match.variant),
        type: str(match.type),
        finishedAt: str(match.finishedAt),
        players,
        hasSets:
          players.some((pl) => pl.sets > 0) || (num(match.targetSets) ?? 0) > 0,
      };
    })
    .filter((m) => m.id);
  return {
    items,
    page: num(p.page) ?? 0,
    totalPages: num(p.total_pages) ?? 1,
    total: num(p.total) ?? items.length,
    counts: {
      local: num(counts.localMatchesPlayed) ?? 0,
      online: num(counts.onlineMatchesPlayed) ?? 0,
      matchmaking: num(counts.matchmakingMatchesPlayed) ?? 0,
      tournament: num(counts.tournamentMatchesPlayed) ?? 0,
    },
  };
}

export interface MatchPlayerStats {
  dartsThrown: number;
  average: number | null;
  first9Average: number | null;
  averageUntil170: number | null;
  checkoutsHit: number;
  checkouts: number;
  /** Percent, 0–100. */
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
  /** Remaining score after the visit. */
  remaining: number | null;
  busted: boolean;
  throws: string[];
}

export interface MatchLeg {
  set: number;
  leg: number;
  winner: number | null;
  /** Visits per player index. */
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
  /** Board positions of every dart per player (radius 1 = outer double wire, +y up). */
  heat: { x: number; y: number }[][];
}

const percent = (value: number | null) =>
  value === null ? null : value <= 1 ? value * 100 : value;

function toPlayerStats(raw: unknown): MatchPlayerStats | null {
  if (!isObject(raw)) return null;
  const checkoutPoints = num(raw.checkoutPoints);
  return {
    dartsThrown: num(raw.dartsThrown) ?? 0,
    average: num(raw.average),
    first9Average: num(raw.first9Average),
    averageUntil170: num(raw.averageUntil170),
    checkoutsHit: num(raw.checkoutsHit) ?? 0,
    checkouts: num(raw.checkouts) ?? 0,
    checkoutPercent: percent(num(raw.checkoutPercent)),
    highestFinish: checkoutPoints && checkoutPoints > 0 ? checkoutPoints : null,
    plus60: num(raw.plus60) ?? 0,
    plus100: num(raw.plus100) ?? 0,
    plus140: num(raw.plus140) ?? 0,
    plus170: num(raw.plus170) ?? 0,
    total180: num(raw.total180) ?? 0,
  };
}

export function toMatchDetail(payload: unknown): MatchDetail | null {
  if (!isObject(payload) || !str(payload.id)) return null;
  const settings = isObject(payload.settings) ? payload.settings : {};
  const rawPlayers = list(payload.players).filter(isObject);
  const playerIds = rawPlayers.map((p) => str(p.id));
  const statsByPlayer = new Map(
    list(payload.matchStats)
      .filter(isObject)
      .map((s) => [str(s.playerId), s] as const),
  );
  const players = toPlayers(payload).map((player, index) => ({
    ...player,
    stats: toPlayerStats(statsByPlayer.get(playerIds[index] ?? null)),
  }));

  const heat: { x: number; y: number }[][] = players.map(() => []);
  const legs = list(payload.games)
    .filter(isObject)
    .map((game): MatchLeg => {
      const visits: MatchVisit[][] = players.map(() => []);
      for (const turn of list(game.turns).filter(isObject)) {
        const index = playerIds.indexOf(str(turn.playerId));
        if (index < 0) continue;
        const darts = list(turn.throws).filter(isObject);
        for (const dart of darts) {
          const at = isObject(dart.coords) ? dart.coords : null;
          const x = at ? num(at.x) : null;
          const y = at ? num(at.y) : null;
          if (x !== null && y !== null) heat[index].push({ x, y });
        }
        visits[index].push({
          round: num(turn.round) ?? visits[index].length + 1,
          points: num(turn.points) ?? 0,
          remaining: num(turn.score),
          busted: turn.busted === true,
          throws: darts.map((d) =>
            isObject(d.segment) ? (str(d.segment.name) ?? '?') : '?',
          ),
        });
      }
      const winner = num(game.winner);
      return {
        set: (num(game.set) ?? 0) + 1,
        leg: (num(game.leg) ?? 0) + 1,
        winner: winner !== null && winner >= 0 ? winner : null,
        visits,
      };
    });

  return {
    id: String(payload.id),
    variant: str(payload.variant),
    type: str(payload.type),
    finishedAt: str(payload.finishedAt),
    duration: str(payload.duration),
    baseScore: num(settings.baseScore),
    inMode: str(settings.inMode),
    outMode: str(settings.outMode),
    targetLegs: num(payload.targetLegs),
    targetSets: num(payload.targetSets),
    players,
    legs,
    heat,
  };
}
