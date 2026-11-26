import { idOf, isObject, Json, list, num, str } from './dashboard.mapper';

/**
 * Profile, friends and tournaments for the start page.
 * The shapes come from live responses of us/v0/users/{id}, as/v0/friends/ and ts/v0/tournaments
 * (unofficial API), so every field is read defensively.
 */

export interface HomeProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  country: string | null;
  plus: boolean;
  average: number | null;
  first9Average: number | null;
  /** Percent, 0–100. */
  winRate: number | null;
  /** Percent, 0–100. */
  checkoutRate: number | null;
  legsPlayed: number | null;
  total180s: number | null;
  tournamentsPlayed: number | null;
  tournamentWins: number | null;
  season: {
    level: number;
    xpInLevel: number;
    xpForNextLevel: number;
    dailyStreak: number;
  } | null;
}

export type FriendStatus = 'playing' | 'online' | 'offline';

export interface HomeFriend {
  id: string;
  name: string;
  avatarUrl: string | null;
  country: string | null;
  average: number | null;
  plus: boolean;
  status: FriendStatus;
  /** German label of what the friend is doing, e.g. "Spielt ein Match". */
  activity: string | null;
}

export interface HomeTournament {
  id: string;
  name: string;
  startsAt: string;
  registrationOpensAt: string | null;
  players: number;
  maxPlayers: number;
  minAverage: number | null;
  maxAverage: number | null;
  plus: boolean;
  registered: boolean;
  baseScore: number | null;
  legs: number | null;
  sets: number | null;
  inMode: string | null;
  outMode: string | null;
  bullOff: boolean;
  type: string | null;
}

/** Eligibility inputs that the tournament filter needs about the player. */
export interface PlayerFacts {
  autodartsUserId: string;
  average: number | null;
  plus: boolean;
  legsPlayed: number | null;
}

/** `0.061` and `6.1` both mean 6.1 %. */
const percent = (value: number | null): number | null =>
  value === null ? null : value <= 1 ? value * 100 : value;

export function toHomeProfile(user: unknown): HomeProfile | null {
  if (!isObject(user)) {
    return null;
  }
  const season = isObject(user.season) ? user.season : null;
  return {
    id: idOf(user.id),
    name: str(user.name) ?? str(user.username) ?? 'Spieler',
    avatarUrl: str(user.avatarUrl),
    country: str(user.country)?.toLowerCase() ?? null,
    plus: str(user.membership) === 'plus',
    average: num(user.average),
    first9Average: num(user.first9Average),
    winRate: percent(num(user.winRate)),
    checkoutRate: percent(num(user.checkoutRate)),
    legsPlayed: num(user.legsPlayed),
    total180s: num(user.total180s),
    tournamentsPlayed: num(user.tournamentsPlayed),
    tournamentWins: num(user.tournamentWins),
    season: season
      ? {
          level: num(season.level) ?? 1,
          xpInLevel: num(season.xpInLevel) ?? 0,
          xpForNextLevel: num(season.xpForNextLevel) ?? 0,
          dailyStreak: num(season.dailyStreak) ?? 0,
        }
      : null,
  };
}

export function toOnlineCount(payload: unknown): number | null {
  return isObject(payload) ? num(payload.online) : null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  'playing-match': 'Spielt ein Match',
  'playing-tournament': 'Im Turnier',
  'playing-tournament-match': 'Spielt im Turnier',
  'in-lobby': 'In einer Lobby',
};

const STATUS_ORDER: Record<FriendStatus, number> = {
  playing: 0,
  online: 1,
  offline: 2,
};

export function toFriends(payload: unknown): HomeFriend[] {
  return list(payload)
    .filter(isObject)
    .filter((entry) => (str(entry.requestStatus) ?? 'Accepted') === 'Accepted')
    .map((entry): HomeFriend | null => {
      const user = isObject(entry.user) ? entry.user : null;
      if (!user) {
        return null;
      }
      const activity =
        str(entry.activity) ??
        (isObject(entry.activity) ? str(entry.activity.type) : null);
      // Incognito friends appear offline, as on play.autodarts.com.
      const online = str(entry.status) === 'Online';
      const status: FriendStatus =
        online && activity ? 'playing' : online ? 'online' : 'offline';
      return {
        id: idOf(user.id),
        name: str(user.name) ?? 'Unbekannt',
        avatarUrl: str(user.avatarUrl),
        country: str(user.country)?.toLowerCase() ?? null,
        average: num(user.average),
        plus: str(user.membership) === 'plus',
        status,
        activity:
          status === 'playing' && activity
            ? (ACTIVITY_LABELS[activity] ?? 'Spielt')
            : null,
      };
    })
    .filter((friend): friend is HomeFriend => friend !== null)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.name.localeCompare(b.name, 'de'),
    );
}

/** `0` means "no limit" in tournament settings. */
const limit = (value: unknown): number | null => {
  const n = num(value);
  return n && n > 0 ? n : null;
};

function toTournament(raw: Json, me: string): HomeTournament | null {
  const settings = isObject(raw.settings) ? raw.settings : {};
  const defaults = isObject(settings.defaultSettings)
    ? settings.defaultSettings
    : {};
  const game = isObject(defaults.settings) ? defaults.settings : {};
  const x01 = isObject(game.settings) ? game.settings : {};
  const startsAt = str(raw.startedAt);
  const id = idOf(raw.id);
  if (!id || !startsAt) {
    return null;
  }
  const players = list(raw.players).filter(isObject);
  return {
    id,
    name: str(raw.name) ?? 'Turnier',
    startsAt,
    registrationOpensAt: str(raw.registrationStartedAt),
    players: players.length,
    maxPlayers: num(settings.maxPlayers) ?? 0,
    minAverage: limit(settings.minAvg),
    maxAverage: limit(settings.maxAvg),
    plus: raw.isPlus === true,
    registered: players.some((p) => idOf(p.userId) === me),
    baseScore: num(x01.baseScore),
    legs: num(game.legs),
    sets: limit(game.sets),
    inMode: str(x01.inMode),
    outMode: str(x01.outMode),
    bullOff: (str(game.bullOffMode) ?? 'Off') !== 'Off',
    type: str(raw.type),
  };
}

/**
 * Upcoming online tournaments the player may enter, soonest first, own registrations first.
 * Mirrors the rules visible in the tournament settings; Autodarts' requirements call stays authoritative.
 */
export function toPlayableTournaments(
  payload: unknown,
  player: PlayerFacts,
  now: Date,
): HomeTournament[] {
  const raws = list(payload).filter(isObject);
  return raws
    .filter((raw) => raw.hasStarted !== true && !str(raw.finishedAt))
    .filter((raw) => (str(raw.mode) ?? 'online') === 'online')
    .map((raw) => ({ raw, t: toTournament(raw, player.autodartsUserId) }))
    .filter((x): x is { raw: Json; t: HomeTournament } => x.t !== null)
    .filter(({ raw, t }) => {
      if (t.registered) {
        return true;
      }
      if (new Date(t.startsAt).getTime() <= now.getTime()) {
        return false;
      }
      if (t.maxPlayers && t.players >= t.maxPlayers) {
        return false;
      }
      if (t.plus && !player.plus) {
        return false;
      }
      const avg = player.average;
      if (t.minAverage !== null && (avg === null || avg < t.minAverage)) {
        return false;
      }
      if (t.maxAverage !== null && (avg === null || avg > t.maxAverage)) {
        return false;
      }
      const settings = isObject(raw.settings) ? raw.settings : {};
      const minLegs = limit(settings.minLegs);
      return minLegs === null || (player.legsPlayed ?? 0) >= minLegs;
    })
    .map(({ t }) => t)
    .sort(
      (a, b) =>
        Number(b.registered) - Number(a.registered) ||
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
}
