import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { StatVariant } from '../core/stats/stats.model';

export const STAT_VARIANTS: { key: StatVariant; label: string }[] = [
  { key: 'x01', label: 'X01' },
  { key: 'cricket', label: 'Cricket' },
  { key: 'countup', label: 'Count Up' },
  { key: 'random-checkout', label: 'Random Checkout' },
  { key: 'killer', label: 'Killer' },
  { key: 'bobs27', label: "Bob's 27" },
];

export const variantLabel = (key: StatVariant) => STAT_VARIANTS.find((v) => v.key === key)?.label ?? key;

/** Segmented switch for the game variant of the statistics. */
@Component({
  selector: 'app-variant-switch',
  host: { class: 'block' },
  template: `
    <div class="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-board/60 p-1" role="tablist" aria-label="Spielvariante">
      @for (v of variants; track v.key) {
        <button
          type="button"
          role="tab"
          class="h-9 cursor-pointer rounded-md px-3.5 text-sm font-semibold transition-colors duration-150"
          [class]="value() === v.key ? 'bg-linear-to-r from-accent to-sky text-board' : 'bg-surface-2 text-muted hover:text-bone'"
          [attr.aria-selected]="value() === v.key"
          (click)="value.set(v.key)"
        >
          {{ v.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantSwitch {
  readonly value = model<StatVariant>('x01');
  protected readonly variants = STAT_VARIANTS;
}
