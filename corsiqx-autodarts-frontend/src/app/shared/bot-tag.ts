import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { averageTierClasses, botLevel } from './average-tier';

/** "🤖 BOT-LEVEL 3 | 40" name tag of a bot, with the average in its level colour. */
@Component({
  selector: 'app-bot-tag',
  host: { class: 'inline-flex items-center' },
  template: `
    <span
      class="relative z-10 grid shrink-0 place-items-center rounded-full bg-[#232836] text-bone ring-2 ring-board"
      [class]="size() === 'sm' ? 'size-7 text-sm' : 'size-9 text-base'"
      aria-hidden="true"
    >
      <i class="ph-fill ph-robot"></i>
    </span>
    <span
      class="bot-tag -ml-2.5 flex items-center bg-board pl-4 pr-3 font-display font-bold uppercase tracking-wide text-bone"
      [class]="size() === 'sm' ? 'h-6 text-xs' : 'h-7 text-sm'"
    >
      Bot-Level {{ level() }}
    </span>
    <span class="-ml-1" [class]="badge() + (size() === 'sm' ? ' h-6 text-sm' : ' h-7 text-base')">
      {{ average() }}<span class="sr-only"> Average</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotTag {
  readonly average = input.required<number>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly level = computed(() => botLevel(this.average()));
  protected readonly badge = computed(() => averageTierClasses(this.average()));
}
