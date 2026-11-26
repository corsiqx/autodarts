import { toFriends, toHomeProfile, toPlayableTournaments } from './home.mapper';

const me = 'me-1';
const now = new Date('2026-11-26T19:00:00Z');
const player = {
  autodartsUserId: me,
  average: 32,
  plus: false,
  legsPlayed: 192,
};

function tournament(
  overrides: Record<string, unknown> = {},
  settings: Record<string, unknown> = {},
) {
  return {
    id: 't-' + Math.random().toString(36).slice(2, 8),
    name: 'Rapid Ricky',
    startedAt: '2026-11-26T19:15:00Z',
    registrationStartedAt: '2026-11-26T19:05:00Z',
    hasStarted: false,
    finishedAt: null,
    mode: 'online',
    isPlus: false,
    type: 'single-ko',
    players: [],
    settings: {
      maxPlayers: 32,
      minAvg: 0,
      maxAvg: 0,
      minLegs: 0,
      defaultSettings: {
        settings: {
          legs: 1,
          bullOffMode: 'Normal',
          settings: { baseScore: 501, inMode: 'Straight', outMode: 'Double' },
        },
      },
      ...settings,
    },
    ...overrides,
  };
}

describe('home mapper', () => {
  it('maps the profile and turns ratios into percent', () => {
    const profile = toHomeProfile({
      id: 'u1',
      name: 'corsiqx',
      country: 'DE',
      membership: 'free',
      average: 32,
      winRate: 37,
      checkoutRate: 0.061,
      season: { level: 1, xpInLevel: 10, xpForNextLevel: 50, dailyStreak: 2 },
    });
    expect(profile).toMatchObject({
      name: 'corsiqx',
      country: 'de',
      plus: false,
      winRate: 37,
      season: { level: 1, xpInLevel: 10, xpForNextLevel: 50, dailyStreak: 2 },
    });
    expect(profile?.checkoutRate).toBeCloseTo(6.1);
  });

  it('groups friends by playing, online, offline and hides open requests', () => {
    const friends = toFriends([
      {
        requestStatus: 'Accepted',
        status: 'Offline',
        activity: null,
        user: { id: '1', name: 'zed' },
      },
      {
        requestStatus: 'Accepted',
        status: 'Online',
        activity: null,
        user: { id: '2', name: 'bob' },
      },
      {
        requestStatus: 'Accepted',
        status: 'Online',
        activity: 'playing-match',
        user: { id: '3', name: 'amy' },
      },
      {
        requestStatus: 'Pending',
        status: 'Online',
        activity: null,
        user: { id: '4', name: 'new' },
      },
      {
        requestStatus: 'Accepted',
        status: 'Incognito',
        activity: null,
        user: { id: '5', name: 'ann' },
      },
    ]);
    expect(friends.map((f) => [f.name, f.status])).toEqual([
      ['amy', 'playing'],
      ['bob', 'online'],
      ['ann', 'offline'],
      ['zed', 'offline'],
    ]);
    expect(friends[0].activity).toBe('Spielt ein Match');
  });

  it('keeps only tournaments the player can enter', () => {
    const ok = tournament({ id: 'ok', startedAt: '2026-11-26T19:20:00Z' });
    const list = [
      ok,
      tournament({ id: 'started', hasStarted: true }),
      tournament({ id: 'past', startedAt: '2026-11-26T18:00:00Z' }),
      tournament({ id: 'plus', isPlus: true }),
      tournament(
        {
          id: 'full',
          players: Array.from({ length: 2 }, (_, i) => ({ userId: 'x' + i })),
        },
        { maxPlayers: 2 },
      ),
      tournament({ id: 'tooweak' }, { minAvg: 40, maxAvg: 60 }),
      tournament({ id: 'toostrong' }, { maxAvg: 30 }),
      tournament({ id: 'legs' }, { minLegs: 500 }),
      tournament({ id: 'offline', mode: 'offline' }),
      tournament({ id: 'bracket' }, { minAvg: 30, maxAvg: 40 }),
      tournament({
        id: 'mine',
        startedAt: '2026-11-26T19:40:00Z',
        players: [{ userId: me }],
      }),
    ];
    const result = toPlayableTournaments(list, player, now);
    expect(result.map((t) => t.id)).toEqual(['mine', 'bracket', 'ok']);
    expect(result[0].registered).toBe(true);
    expect(result[1]).toMatchObject({
      minAverage: 30,
      maxAverage: 40,
      baseScore: 501,
      legs: 1,
      outMode: 'Double',
      bullOff: true,
    });
  });
});
