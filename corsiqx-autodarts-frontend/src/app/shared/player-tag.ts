import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Avatar } from './avatar';
import { BotTag } from './bot-tag';
import { Flag } from './flag';

/** "(avatar) NAME 🇩🇪" tag with a slanted end, as play.autodarts.com shows players; bots get the bot tag. */
@Component({
  selector: 'app-player-tag',
  imports: [Avatar, Flag, BotTag],
  host: { class: 'inline-flex min-w-0 items-center' },
  template: `
    @if (isBot() && botAverage() !== null) {
      <app-bot-tag [average]="botAverage()!" size="sm" />
    } @else {
      <app-avatar class="relative z-10 size-7 shrink-0 rounded-full ring-2 ring-board" [name]="name()" [url]="avatarUrl()" />
      <span
        class="bot-tag -ml-2.5 flex h-6 min-w-0 items-center gap-1.5 bg-board pl-4 pr-3 font-display text-sm font-bold uppercase tracking-wide"
        [class]="muted() ? 'text-bone/60' : 'text-bone'"
      >
        <span class="truncate">{{ name() }}</span>
        <app-flag class="text-[0.6rem]" [country]="country()" />
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerTag {
  readonly name = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly country = input<string | null>(null);
  readonly isBot = input(false);
  readonly botAverage = input<number | null>(null);
  /** Losers are shown a little dimmer. */
  readonly muted = input(false);
}
