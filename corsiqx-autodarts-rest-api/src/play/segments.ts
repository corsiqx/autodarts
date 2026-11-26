/**
 * Dart segments exactly as the Autodarts web app sends them for manual entry
 * (`entry: "manual_keyboard"`), keyed by the short names our client uses.
 */
export interface Segment {
  name: string;
  number: number;
  bed: 'Single' | 'Double' | 'Triple' | 'Outside';
  multiplier: number;
}

const SEGMENTS = new Map<string, Segment>([
  ['Miss', { name: 'Miss', number: 0, bed: 'Outside', multiplier: 0 }],
  ['25', { name: '25', number: 25, bed: 'Single', multiplier: 1 }],
  ['Bull', { name: 'Bull', number: 25, bed: 'Double', multiplier: 2 }],
]);
for (let n = 1; n <= 20; n++) {
  SEGMENTS.set(`S${n}`, {
    name: `S${n}`,
    number: n,
    bed: 'Single',
    multiplier: 1,
  });
  SEGMENTS.set(`D${n}`, {
    name: `D${n}`,
    number: n,
    bed: 'Double',
    multiplier: 2,
  });
  SEGMENTS.set(`T${n}`, {
    name: `T${n}`,
    number: n,
    bed: 'Triple',
    multiplier: 3,
  });
}

export const SEGMENT_NAMES = [...SEGMENTS.keys()];

export function segmentByName(name: string): Segment | null {
  return SEGMENTS.get(name) ?? null;
}
