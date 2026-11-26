/**
 * Colour of an average badge, in steps of ten from cold to hot:
 * grey, green, blue, violet, pink, orange, red, gold, and a bright gold for 90+.
 * The class strings are written out in full so Tailwind finds them.
 */
const TIERS: { from: number; classes: string }[] = [
  { from: 90, classes: 'bg-linear-to-r from-amber-200 via-yellow-50 to-amber-300 text-board shadow-[0_0_14px_rgb(253_230_138/0.6)]' },
  { from: 80, classes: 'bg-linear-to-r from-amber-400 to-yellow-300 text-board' },
  { from: 70, classes: 'bg-linear-to-r from-red-600 to-rose-400 text-white' },
  { from: 60, classes: 'bg-linear-to-r from-orange-500 to-amber-400 text-board' },
  { from: 50, classes: 'bg-linear-to-r from-pink-600 to-fuchsia-400 text-white' },
  { from: 40, classes: 'bg-linear-to-r from-violet-600 to-purple-400 text-white' },
  { from: 30, classes: 'bg-linear-to-r from-accent to-sky text-board' },
  { from: 20, classes: 'bg-linear-to-r from-emerald-600 to-green-400 text-board' },
  { from: 0, classes: 'bg-linear-to-r from-slate-600 to-slate-400 text-white' },
];

export function averageTierClasses(average: number): string {
  return (TIERS.find((tier) => average >= tier.from) ?? TIERS[TIERS.length - 1]).classes;
}
