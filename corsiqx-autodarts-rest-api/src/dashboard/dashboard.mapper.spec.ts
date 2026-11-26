import {
  lastPageIndex,
  toBoards,
  toHistory,
  toLiveMatch,
  toMatchId,
  toStatFigures,
} from './dashboard.mapper';

describe('dashboard mapper', () => {
  it('maps boards from the documented board model', () => {
    const boards = toBoards([
      {
        id: 'b-1',
        name: 'Keller',
        type: 'vantage',
        version: '2.1.0',
        matchId: 'm-9',
        state: { connected: true, status: 'Throw', event: 'Started' },
      },
      { name: 'ohne id' },
    ]);
    expect(boards).toEqual([
      {
        id: 'b-1',
        name: 'Keller',
        type: 'vantage',
        connected: true,
        status: 'Throw',
        event: 'Started',
        matchId: 'm-9',
        version: '2.1.0',
      },
    ]);
  });

  it('reads the match id from text, JSON string or object', () => {
    expect(toMatchId('abc-1')).toBe('abc-1');
    expect(toMatchId('"abc-1"')).toBe('abc-1');
    expect(toMatchId({ id: 'abc-1' })).toBe('abc-1');
    expect(toMatchId(null)).toBeNull();
  });

  it('maps the match state with remaining scores and the last turn', () => {
    const match = toLiveMatch({
      id: 'm-9',
      variant: 'X01',
      finished: false,
      round: 4,
      set: 1,
      leg: 2,
      legs: 3,
      player: 1,
      turnScore: 60,
      players: [
        { id: 'p1', name: 'Lea' },
        { id: 'p2', name: 'Jonas', avatarUrl: 'https://img/j.png' },
      ],
      scores: [
        { legs: 1, sets: 0 },
        { legs: 0, sets: 0 },
      ],
      gameScores: [141, 301],
      turns: [
        {
          playerId: 'p2',
          points: 60,
          busted: false,
          throws: [
            { segment: { name: 'T20' } },
            { segment: { name: 'S20' } },
            { segment: { name: 'S20' } },
          ],
        },
      ],
    });

    expect(match).toMatchObject({
      id: 'm-9',
      currentPlayer: 1,
      target: { legs: 3, sets: null },
      players: [
        { name: 'Lea', legs: 1, score: 141, avatarUrl: null },
        { name: 'Jonas', legs: 0, score: 301, avatarUrl: 'https://img/j.png' },
      ],
      lastTurn: {
        playerIndex: 1,
        score: 60,
        busted: false,
        throws: ['T20', 'S20', 'S20'],
      },
    });
  });

  it('returns null for an empty match state', () => {
    expect(toLiveMatch(null)).toBeNull();
    expect(toLiveMatch({})).toBeNull();
  });

  it('collects known stat figures first and labels them', () => {
    const figures = toStatFigures({
      someOtherCount: 5,
      average: 52.7,
      checkoutRate: 31.4,
      nested: { first9Average: 58.1 },
      name: 'ignored',
    });
    expect(figures.map((figure) => figure.label)).toEqual([
      'Average',
      'Checkout-Quote',
      'First-9 Average',
      'Some Other Count',
    ]);
  });

  it('maps the Autodarts X01 stats shape with percent and details', () => {
    const figures = toStatFigures({
      numLegs: 100,
      numLegsWon: 43,
      average: {
        average: 32,
        first9Average: 39.83,
        checkouts: 704,
        checkoutsHit: 43,
        checkoutPercent: 0.0611,
        plus100: 19,
        plus140: 4,
        total180: 1,
      },
      best: { average: 56.625, first9Average: 79.3, checkoutPoints: 62 },
    });
    expect(figures.map((f) => [f.label, f.value, f.unit, f.detail])).toEqual([
      ['Average', 32, 'number', 'Bestes Leg 56,6'],
      ['First-9 Average', 39.83, 'number', 'Bestes Leg 79,3'],
      ['Checkout-Quote', 6.11, 'percent', '43 von 704 Versuchen'],
      ['Höchstes Finish', 62, 'number', null],
      ['Gewonnene Legs', 43, 'number', 'von 100 Legs'],
      ['100+', 19, 'number', null],
      ['140+', 4, 'number', null],
      ['180er', 1, 'number', null],
    ]);
  });

  it('reads the last page index of a paged answer', () => {
    expect(lastPageIndex({ max_page: 7, total_pages: 8 })).toBe(7);
    expect(lastPageIndex({ total_pages: 3 })).toBe(2);
    expect(lastPageIndex([])).toBe(0);
  });

  it('maps match history from a paged answer', () => {
    const history = toHistory({
      items: [
        {
          id: 'h1',
          variant: 'X01',
          type: 'Online',
          finishedAt: '2026-11-20T19:00:00Z',
          players: [{ name: 'Lea' }, { user: { name: 'Mirko' } }],
          winner: 1,
        },
      ],
    });
    expect(history).toEqual([
      {
        id: 'h1',
        variant: 'X01',
        type: 'Online',
        date: '2026-11-20T19:00:00Z',
        players: ['Lea', 'Mirko'],
        winner: 'Mirko',
      },
    ]);
  });
});
