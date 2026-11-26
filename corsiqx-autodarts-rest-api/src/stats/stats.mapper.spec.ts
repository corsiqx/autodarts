import { toMatchDetail, toMatchHistory, toStatsOverview } from './stats.mapper';

describe('stats mapper', () => {
  it('reads the X01 overview including the previous window', () => {
    const overview = toStatsOverview('x01', {
      numLegs: 100,
      numLegsWon: 43,
      numLegsLast: 92,
      totalLegs: 192,
      legsWon: 83,
      soloGame: 28,
      average: { average: 32, checkoutPercent: 0.061, plus60: 162 },
      averageLast: { average: 31.3 },
      best: { average: 56.6 },
    });
    expect(overview).toMatchObject({
      totalLegs: 192,
      legsWon: 83,
      soloGames: 28,
      legs: 100,
      legsWonInWindow: 43,
      previousLegs: 92,
      current: { average: 32, checkoutPercent: 0.061, plus60: 162 },
      previous: { average: 31.3 },
    });
  });

  it('maps the history page and type counts', () => {
    const history = toMatchHistory({
      page: 0,
      total_pages: 9,
      total: 87,
      counts: {
        localMatchesPlayed: 58,
        onlineMatchesPlayed: 18,
        matchmakingMatchesPlayed: 0,
        tournamentMatchesPlayed: 11,
      },
      items: [
        {
          id: 'm1',
          variant: 'X01',
          type: 'Local',
          finishedAt: '2026-11-25T20:07:43Z',
          winner: 0,
          scores: [
            { legs: 1, sets: 0 },
            { legs: 0, sets: 0 },
          ],
          players: [
            { name: 'siggi79', user: { country: 'DE' } },
            { name: 'Bot', cpuPPR: 40 },
          ],
        },
      ],
    });
    expect(history.counts).toEqual({
      local: 58,
      online: 18,
      matchmaking: 0,
      tournament: 11,
    });
    expect(history.items[0].players).toMatchObject([
      { name: 'siggi79', legs: 1, winner: true, country: 'de' },
      { name: 'Bot', isBot: true, botAverage: 40, winner: false },
    ]);
  });

  it('builds visits, stats and heat points of a match', () => {
    const detail = toMatchDetail({
      id: 'm1',
      variant: 'X01',
      winner: 0,
      duration: '4m42s',
      targetLegs: 1,
      settings: { baseScore: 501, inMode: 'Straight', outMode: 'Double' },
      scores: [{ legs: 1 }, { legs: 0 }],
      players: [
        { id: 'p0', name: 'a' },
        { id: 'p1', name: 'b' },
      ],
      matchStats: [
        {
          playerId: 'p0',
          dartsThrown: 36,
          average: 41.75,
          checkoutsHit: 1,
          checkouts: 2,
          checkoutPercent: 0.5,
          checkoutPoints: 23,
        },
        { playerId: 'p1', dartsThrown: 33, average: 41.7, checkoutPoints: 0 },
      ],
      games: [
        {
          set: 0,
          leg: 0,
          winner: 0,
          turns: [
            {
              playerId: 'p0',
              round: 1,
              points: 60,
              score: 441,
              throws: [
                { segment: { name: 'S20' }, coords: { x: 0.04, y: 0.87 } },
              ],
            },
            {
              playerId: 'p1',
              round: 1,
              points: 81,
              score: 420,
              throws: [{ segment: { name: 'T20' } }],
            },
          ],
        },
      ],
    });
    expect(detail?.players[0].stats).toMatchObject({
      average: 41.75,
      checkoutPercent: 50,
      highestFinish: 23,
    });
    expect(detail?.players[1].stats?.highestFinish).toBeNull();
    expect(detail?.legs[0]).toMatchObject({ set: 1, leg: 1, winner: 0 });
    expect(detail?.legs[0].visits[1][0]).toEqual({
      round: 1,
      points: 81,
      remaining: 420,
      busted: false,
      throws: ['T20'],
    });
    expect(detail?.heat).toEqual([[{ x: 0.04, y: 0.87 }], []]);
  });
});
