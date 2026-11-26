/**
 * Average badges as on play.autodarts.com: a slanted tag, dark tinted background, coloured number.
 * Steps of ten: below 40 grey, then green, cyan, violet, gold, orange, and rose from 90 up.
 * The class strings are written out in full so Tailwind finds them.
 */
const TIERS: { from: number; classes: string }[] = [
  { from: 90, classes: 'bg-[#4a1d2b] text-[#f2607e]' },
  { from: 80, classes: 'bg-[#45281f] text-[#f28a4e]' },
  { from: 70, classes: 'bg-[#433b1f] text-[#e8c64b]' },
  { from: 60, classes: 'bg-[#2a2350] text-[#9d7ff5]' },
  { from: 50, classes: 'bg-[#123547] text-[#30b6e3]' },
  { from: 40, classes: 'bg-[#12352a] text-[#3fcf8e]' },
  { from: 0, classes: 'bg-[#2a2f3b] text-[#a3aab7]' },
];

/** Colours plus the slanted shape (`avg-badge` in styles.css). */
export function averageTierClasses(average: number): string {
  const tier = TIERS.find((t) => average >= t.from) ?? TIERS[TIERS.length - 1];
  return `avg-badge ${tier.classes}`;
}

/** Autodarts bot levels: level 1 throws an average of 20, every level adds 10, up to level 11. */
export const BOT_LEVELS = Array.from({ length: 11 }, (_, i) => ({ level: i + 1, average: 20 + i * 10 }));

export function botLevel(average: number): number {
  return Math.min(11, Math.max(1, Math.round((average - 20) / 10) + 1));
}
