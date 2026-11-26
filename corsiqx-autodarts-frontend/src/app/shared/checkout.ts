/**
 * Checkout route for a remaining X01 score with at most `darts` darts:
 * fewest darts first, then the usual preferences (big trebles to set up, favourite doubles to finish).
 */

type Mode = 'Straight' | 'Double' | 'Master';

interface Dart {
  name: string;
  value: number;
  double: boolean;
  triple: boolean;
}

const dart = (name: string, value: number, double = false, triple = false): Dart => ({
  name,
  value,
  double,
  triple,
});

const TREBLES = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) =>
  dart(`T${n}`, n * 3, false, true),
);
const SINGLES = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) =>
  dart(`${n}`, n),
);
const FAVOURITE_DOUBLES = [20, 16, 18, 12, 10, 8, 4, 2, 14, 6, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];
const DOUBLES = [
  ...FAVOURITE_DOUBLES.map((n) => dart(`D${n}`, n * 2, true)),
  dart('Bull', 50, true),
];
const OUTER_BULL = dart('25', 25);

/** Doubles players like to finish on. */
const GOOD_FINISHES = new Set(['D20', 'D16', 'D18', 'D12', 'D10', 'D8', 'D14', 'D6', 'D4', 'Bull']);

/** Darts that may set up a finish, in order of preference. */
const SETUP = [...TREBLES, OUTER_BULL, ...SINGLES, ...DOUBLES];

function finishers(mode: Mode): Dart[] {
  if (mode === 'Double') return DOUBLES;
  if (mode === 'Master') return [...DOUBLES, ...TREBLES];
  return [...DOUBLES, ...TREBLES, OUTER_BULL, ...SINGLES];
}

export function checkoutRoute(remaining: number, mode: Mode = 'Double', darts = 3): string[] | null {
  if (remaining <= 0 || darts <= 0) return null;
  const finish = finishers(mode);
  for (let count = 1; count <= darts; count++) {
    const route = search(remaining, count, finish);
    if (route) return route.map((d) => d.name);
  }
  return null;
}

/**
 * Three darts: biggest scoring dart first (T20, T19, …), then the best two-dart finish.
 * Two darts: favourite finishing double first, then the setup dart. One dart: the finish.
 */
function search(remaining: number, count: number, finish: Dart[]): Dart[] | null {
  if (count >= 3) {
    for (const first of SETUP) {
      const rest = remaining - first.value;
      if (rest < 1) continue;
      const tail = search(rest, count - 1, finish);
      if (tail) return [first, ...tail];
    }
    return null;
  }
  if (count === 2 && remaining <= 60) {
    // Small finishes: a single onto a favourite double (41 → 9 D16, 59 → 19 D20).
    for (const last of finish.filter((d) => GOOD_FINISHES.has(d.name))) {
      const first = [...SINGLES, OUTER_BULL].find((d) => d.value === remaining - last.value);
      if (first) return [first, last];
    }
  }
  if (count === 2) {
    // Biggest setup dart that leaves a good double (81 → T19 D12, 61 → T15 D8).
    for (const first of SETUP) {
      const last = finish.find((d) => GOOD_FINISHES.has(d.name) && d.value === remaining - first.value);
      if (last) return [first, last];
    }
  }
  for (const last of finish) {
    const rest = remaining - last.value;
    if (rest === 0 && count === 1) return [last];
    if (rest < 1 || count === 1) continue;
    const setup = setupDarts(rest, count - 1);
    if (setup) return [...setup, last];
  }
  return null;
}

function setupDarts(total: number, count: number): Dart[] | null {
  if (count === 1) {
    const only = SETUP.find((d) => d.value === total);
    return only ? [only] : null;
  }
  for (const first of SETUP) {
    const rest = total - first.value;
    if (rest < 1) continue;
    const tail = setupDarts(rest, count - 1);
    if (tail) return [first, ...tail];
  }
  return null;
}
