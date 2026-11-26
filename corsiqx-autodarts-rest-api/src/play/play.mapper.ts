import { idOf, isObject, list, num, str } from '../dashboard/dashboard.mapper';

/** Everything the match screen needs from `GET /gs/v0/matches/{id}/state`. */

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
  /** Remaining points in X01. */
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
  /** Where each dart landed (radius 1 = outer double wire, +y up); `null` for typed-in darts. */
  coords: ({ x: number; y: number } | null)[];
}

export interface MatchView {
  id: string;
  variant: string | null;
  type: string | null;
  baseScore: number | null;
  inMode: string | null;
  outMode: string | null;
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
  /** The running visit, then earlier visits newest first (Autodarts only keeps the running round). */
  currentTurn: MatchViewTurn | null;
  recentTurns: MatchViewTurn[];
}

export function toTurn(
  raw: unknown,
  playerIds: (string | null)[],
): MatchViewTurn | null {
  if (!isObject(raw)) {
    return null;
  }
  const index = playerIds.indexOf(str(raw.playerId));
  const darts = list(raw.throws).filter(isObject);
  return {
    id: idOf(raw.id),
    playerIndex: index >= 0 ? index : null,
    round: num(raw.round),
    points: num(raw.points),
    busted: raw.busted === true,
    throws: darts.map((dart) =>
      isObject(dart.segment) ? (str(dart.segment.name) ?? '?') : '?',
    ),
    coords: darts.map((dart) => {
      const at = isObject(dart.coords) ? dart.coords : null;
      const x = at ? num(at.x) : null;
      const y = at ? num(at.y) : null;
      return x !== null && y !== null ? { x, y } : null;
    }),
  };
}

/** Player positions; Autodarts sends -1 for "nobody yet". */
const position = (value: unknown): number | null => {
  const n = num(value);
  return n !== null && n >= 0 ? n : null;
};

/** Autodarts uses `0001-01-01…` for "not finished yet". */
const isOpen = (value: unknown): boolean => {
  const text = str(value);
  return !text || text.startsWith('0001-');
};

export function toMatchView(
  payload: unknown,
  autodartsUserId: string,
): MatchView | null {
  if (!isObject(payload) || !str(payload.id)) {
    return null;
  }
  const settings = isObject(payload.settings) ? payload.settings : {};
  const scores = list(payload.scores);
  const gameScores = list(payload.gameScores);
  const stats = list(payload.stats);
  const rawPlayers = list(payload.players).filter(isObject);
  const playerIds = rawPlayers.map((p) => str(p.id));

  const players = rawPlayers.map((player, index): MatchViewPlayer => {
    const score = isObject(scores[index]) ? scores[index] : {};
    const user = isObject(player.user) ? player.user : {};
    const stat = isObject(stats[index]) ? stats[index] : {};
    const match = isObject(stat.matchStats) ? stat.matchStats : {};
    const leg = isObject(stat.legStats) ? stat.legStats : {};
    const ratio = num(match.checkoutPercent);
    const botAverage = num(player.cpuPPR);
    return {
      name: str(player.name) ?? str(user.name) ?? `Spieler ${index + 1}`,
      avatarUrl: str(player.avatarUrl) ?? str(user.avatarUrl),
      country: str(user.country)?.toLowerCase() ?? null,
      isBot: botAverage !== null,
      botAverage,
      isMe: idOf(player.userId) === autodartsUserId,
      boardId: str(player.boardId),
      legs: num(score.legs) ?? 0,
      sets: num(score.sets) ?? 0,
      score: num(gameScores[index]),
      average: num(match.average),
      legAverage: num(leg.average),
      dartsThrown: num(match.dartsThrown) ?? 0,
      checkoutPercent: ratio === null ? null : ratio <= 1 ? ratio * 100 : ratio,
    };
  });

  const turns = list(payload.turns);
  const last = turns.at(-1);
  const currentTurn =
    isObject(last) && isOpen(last.finishedAt) ? toTurn(last, playerIds) : null;
  const finishedTurns = currentTurn ? turns.slice(0, -1) : turns;
  const recentTurns = finishedTurns
    .slice(-12)
    .reverse()
    .map((turn) => toTurn(turn, playerIds))
    .filter((turn): turn is MatchViewTurn => turn !== null);

  return {
    id: String(payload.id),
    variant: str(payload.variant),
    type: str(payload.type),
    baseScore: num(settings.baseScore),
    inMode: str(settings.inMode),
    outMode: str(settings.outMode),
    legsToWin: num(payload.legs),
    setsToWin: num(payload.sets),
    set: num(payload.set),
    leg: num(payload.leg),
    round: num(payload.round),
    maxRounds: num(settings.maxRounds),
    currentPlayer: position(payload.player),
    turnScore: num(payload.turnScore),
    turnBusted: payload.turnBusted === true,
    gameFinished: payload.gameFinished === true,
    gameWinner: position(payload.gameWinner),
    finished: payload.finished === true,
    winner: position(payload.winner),
    players,
    currentTurn,
    recentTurns,
  };
}
