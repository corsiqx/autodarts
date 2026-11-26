/**
 * Turns Autodarts payloads into small, stable shapes for the dashboard.
 * Boards and match state follow the documented models (Winmau-Autodarts-API.md 14.2, 14.4);
 * stats and history are undocumented, so their fields are read defensively.
 */

type Json = Record<string, unknown>;

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
  /** Context line, e.g. "Bestes Leg 56,6" or "43 von 704 Versuchen". */
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

const isObject = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Ids arrive as string or number. */
const idOf = (value: unknown): string =>
  typeof value === 'number' ? String(value) : (str(value) ?? '');

/** Finds the array in list answers like `[...]`, `{items}`, `{content}`, `{data}`. */
export function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isObject(payload)) {
    for (const key of ['items', 'content', 'data', 'matches', 'results']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
}

export function toBoards(payload: unknown): DashboardBoard[] {
  return unwrapList(payload)
    .filter(isObject)
    .map((board) => {
      const state = isObject(board.state) ? board.state : {};
      return {
        id: idOf(board.id),
        name: str(board.name) ?? 'Unbenanntes Board',
        type: str(board.type),
        connected: state.connected === true,
        status: str(state.status),
        event: str(state.event),
        matchId: str(board.matchId),
        version: str(board.version),
      };
    })
    .filter((board) => board.id);
}

/** `us/v0/match-id` answers with an id as text, JSON string or object. */
export function toMatchId(payload: unknown): string | null {
  if (typeof payload === 'string') return str(payload.replace(/"/g, ''));
  if (isObject(payload)) return str(payload.id) ?? str(payload.matchId);
  return null;
}

export function toLiveMatch(payload: unknown): LiveMatch | null {
  if (!isObject(payload) || !str(payload.id)) {
    return null;
  }
  const scores = list(payload.scores);
  const gameScores = list(payload.gameScores);
  const players = list(payload.players)
    .filter(isObject)
    .map((player, index) => {
      const score = isObject(scores[index]) ? scores[index] : {};
      const user = isObject(player.user) ? player.user : {};
      return {
        name: str(player.name) ?? str(user.name) ?? `Spieler ${index + 1}`,
        avatarUrl: str(player.avatarUrl) ?? str(user.avatarUrl),
        legs: num(score.legs) ?? 0,
        sets: num(score.sets) ?? 0,
        score: num(gameScores[index]),
      };
    });

  const turns = list(payload.turns).filter(isObject);
  const last = turns.at(-1);
  const playerIds = list(payload.players)
    .filter(isObject)
    .map((player) => str(player.id));
  const lastTurn = last
    ? {
        playerIndex: (() => {
          const index = playerIds.indexOf(str(last.playerId));
          return index >= 0 ? index : null;
        })(),
        score: num(last.points) ?? num(last.score),
        busted: last.busted === true,
        throws: list(last.throws)
          .filter(isObject)
          .map((dart) =>
            isObject(dart.segment) ? (str(dart.segment.name) ?? '?') : '?',
          ),
      }
    : null;

  return {
    id: String(payload.id),
    variant: str(payload.variant),
    finished: payload.finished === true,
    round: num(payload.round),
    set: num(payload.set),
    leg: num(payload.leg),
    target: { legs: num(payload.legs), sets: num(payload.sets) },
    currentPlayer: num(payload.player),
    winner: num(payload.winner),
    turnScore: num(payload.turnScore),
    players,
    lastTurn,
  };
}

const STAT_LABELS: Record<string, string> = {
  average: 'Average',
  avg: 'Average',
  threeDartAverage: 'Average',
  first9Average: 'First-9 Average',
  first9Avg: 'First-9 Average',
  checkoutRate: 'Checkout-Quote',
  checkoutPercent: 'Checkout-Quote',
  checkoutPercentage: 'Checkout-Quote',
  checkoutRatio: 'Checkout-Quote',
  highestCheckout: 'Höchstes Finish',
  highestScore: 'Höchste Aufnahme',
  total180: '180er',
  count180: '180er',
  plus180: '180er',
  matchesPlayed: 'Matches',
  matches: 'Matches',
  matchesWon: 'Siege',
  legsPlayed: 'Legs',
  legsWon: 'Gewonnene Legs',
  dartsThrown: 'Darts geworfen',
  darts: 'Darts geworfen',
};

const humanize = (key: string): string =>
  key
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());

const decimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/**
 * `us/v0/profile/stats/x01` as seen live on 26.11.2026: leg counters at the top,
 * `average` over the requested legs, `best` single-leg values.
 */
function autodartsX01Figures(source: Json, average: Json): StatFigure[] {
  const best = isObject(source.best) ? source.best : {};
  const figure = (
    key: string,
    label: string,
    value: number | null,
    detail: string | null = null,
    unit: StatFigure['unit'] = 'number',
  ): StatFigure | null =>
    value === null ? null : { key, label, value, unit, detail };
  const bestDetail = (value: number | null) =>
    value ? `Bestes Leg ${decimal.format(value)}` : null;

  const checkoutRatio = num(average.checkoutPercent);
  const checkouts = num(average.checkouts);
  const checkoutsHit = num(average.checkoutsHit);
  const legs = num(source.numLegs);

  return [
    figure(
      'average',
      'Average',
      num(average.average),
      bestDetail(num(best.average)),
    ),
    figure(
      'first9Average',
      'First-9 Average',
      num(average.first9Average),
      bestDetail(num(best.first9Average)),
    ),
    figure(
      'checkoutPercent',
      'Checkout-Quote',
      checkoutRatio === null ? null : checkoutRatio * 100,
      checkoutsHit !== null && checkouts
        ? `${checkoutsHit} von ${checkouts} Versuchen`
        : null,
      'percent',
    ),
    figure(
      'highestCheckout',
      'Höchstes Finish',
      num(best.checkoutPoints) || null,
    ),
    figure(
      'legsWon',
      'Gewonnene Legs',
      num(source.numLegsWon),
      legs ? `von ${legs} Legs` : null,
    ),
    figure('plus100', '100+', num(average.plus100)),
    figure('plus140', '140+', num(average.plus140)),
    figure('total180', '180er', num(average.total180)),
  ].filter((entry): entry is StatFigure => entry !== null);
}

/** Collects numeric figures from the stats answer; known ones first, at most eight. */
export function toStatFigures(payload: unknown): StatFigure[] {
  const source = Array.isArray(payload)
    ? payload.find(isObject)
    : isObject(payload)
      ? payload
      : undefined;
  if (!source) return [];
  if (isObject(source.average) && num(source.average.average) !== null) {
    return autodartsX01Figures(source, source.average);
  }

  const figures = new Map<string, StatFigure>();
  const collect = (object: Json, prefix = '') => {
    for (const [key, value] of Object.entries(object)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (num(value) !== null) {
        const label = STAT_LABELS[key] ?? humanize(key);
        if (![...figures.values()].some((figure) => figure.label === label)) {
          figures.set(fullKey, {
            key: fullKey,
            label,
            value: value as number,
            unit: 'number',
            detail: null,
          });
        }
      } else if (isObject(value) && !prefix) {
        collect(value, key);
      }
    }
  };
  collect(source);

  return [...figures.values()]
    .sort(
      (a, b) =>
        Number(!(a.key.split('.').pop()! in STAT_LABELS)) -
        Number(!(b.key.split('.').pop()! in STAT_LABELS)),
    )
    .slice(0, 8);
}

export function toHistory(payload: unknown): MatchHistoryEntry[] {
  return unwrapList(payload)
    .filter(isObject)
    .map((match) => {
      const players = list(match.players)
        .filter(isObject)
        .map((player) => {
          const user = isObject(player.user) ? player.user : {};
          return str(player.name) ?? str(user.name) ?? '?';
        });
      const winnerIndex = num(match.winner);
      return {
        id: idOf(match.id),
        variant: str(match.variant),
        type: str(match.type),
        date: str(match.finishedAt) ?? str(match.createdAt) ?? str(match.date),
        players,
        winner:
          winnerIndex !== null
            ? (players[winnerIndex] ?? null)
            : str(match.winner),
      };
    })
    .filter((match) => match.id)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 10);
}

/** Index of the last page of a paged answer (`max_page` or `total_pages`), else 0. */
export function lastPageIndex(payload: unknown): number {
  if (!isObject(payload)) return 0;
  const maxPage = num(payload.max_page);
  if (maxPage !== null) return Math.max(0, maxPage);
  const totalPages = num(payload.total_pages);
  return totalPages ? Math.max(0, totalPages - 1) : 0;
}
