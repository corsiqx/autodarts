import { toMatchView } from './play.mapper';
import { segmentByName } from './segments';

const me = 'me-1';

/** Trimmed copy of a real X01 state after one finished and one running visit. */
const state = {
  id: 'm1',
  variant: 'X01',
  type: 'Local',
  legs: 1,
  settings: {
    baseScore: 301,
    inMode: 'Straight',
    outMode: 'Double',
    maxRounds: 50,
  },
  players: [
    {
      id: 'p0',
      name: 'corsiqx',
      userId: me,
      user: { country: 'DE' },
      boardId: null,
      cpuPPR: null,
    },
    { id: 'p1', name: 'Bot 40', userId: null, cpuPPR: 40 },
  ],
  scores: [
    { legs: 0, sets: 0 },
    { legs: 0, sets: 0 },
  ],
  gameScores: [241, 264],
  stats: [
    {
      matchStats: { average: 60, dartsThrown: 3, checkoutPercent: 0.25 },
      legStats: { average: 60 },
    },
  ],
  turns: [
    {
      playerId: 'p0',
      round: 1,
      points: 60,
      busted: false,
      finishedAt: '2026-11-26T19:57:11Z',
      throws: [{ segment: { name: 'T20' } }],
    },
    {
      playerId: 'p1',
      round: 1,
      points: 37,
      busted: false,
      finishedAt: '2026-11-26T19:57:13Z',
      throws: [
        { segment: { name: 'S20' } },
        { segment: { name: 'S17' } },
        { segment: { name: 'Miss' } },
      ],
    },
    {
      playerId: 'p0',
      round: 2,
      points: 0,
      finishedAt: '0001-01-01T00:00:00Z',
      throws: [],
    },
  ],
  round: 2,
  player: 0,
  turnScore: 0,
  winner: -1,
  gameWinner: -1,
  finished: false,
};

describe('play mapper', () => {
  it('maps players, the running visit and earlier visits', () => {
    const view = toMatchView(state, me);
    expect(view).toMatchObject({
      id: 'm1',
      baseScore: 301,
      outMode: 'Double',
      legsToWin: 1,
      currentPlayer: 0,
      winner: null,
      gameWinner: null,
      currentTurn: { playerIndex: 0, round: 2, throws: [] },
    });
    expect(view?.players[0]).toMatchObject({
      isMe: true,
      isBot: false,
      score: 241,
      average: 60,
      country: 'de',
    });
    expect(view?.players[0].checkoutPercent).toBeCloseTo(25);
    expect(view?.players[1]).toMatchObject({
      isMe: false,
      isBot: true,
      botAverage: 40,
      score: 264,
    });
    expect(view?.recentTurns.map((t) => t.playerIndex)).toEqual([1, 0]);
    expect(view?.recentTurns[0].throws).toEqual(['S20', 'S17', 'Miss']);
  });

  it('returns null for empty answers', () => {
    expect(toMatchView(null, me)).toBeNull();
  });

  it('knows the segments the web app sends', () => {
    expect(segmentByName('T20')).toEqual({
      name: 'T20',
      number: 20,
      bed: 'Triple',
      multiplier: 3,
    });
    expect(segmentByName('Bull')).toEqual({
      name: 'Bull',
      number: 25,
      bed: 'Double',
      multiplier: 2,
    });
    expect(segmentByName('Miss')?.multiplier).toBe(0);
    expect(segmentByName('T25')).toBeNull();
  });
});
