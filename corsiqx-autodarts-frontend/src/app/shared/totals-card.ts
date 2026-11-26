import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface TotalFigure {
  value: number | null;
  label: string;
}

const whole = new Intl.NumberFormat('de-DE');

/** A row of headline numbers, styled like the profile strip (label above, number below). */
@Component({
  selector: 'app-totals-card',
  host: { class: 'block' },
  template: `
    <dl class="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface/70 px-5 py-5 sm:grid-cols-3 sm:px-6">
      @for (figure of figures(); track figure.label) {
        <div class="flex flex-col border-l border-line-strong pl-4 first:border-l-0 first:pl-0 max-sm:first:border-l max-sm:first:pl-4">
          <dd class="order-2 font-display text-3xl leading-tight font-bold tabular-nums">
            {{ figure.value === null ? '–' : format(figure.value) }}
          </dd>
          <dt class="order-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{{ figure.label }}</dt>
        </div>
      }
    </dl>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TotalsCard {
  readonly figures = input.required<TotalFigure[]>();

  protected format(value: number): string {
    return whole.format(value);
  }
}
