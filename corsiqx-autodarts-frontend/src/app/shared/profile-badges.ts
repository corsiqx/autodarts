import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type BadgeKind = 'earlySupporter' | 'plus' | 'other';

interface Badge {
  key: string;
  kind: BadgeKind;
  label: string;
}

const LABELS: Record<string, string> = {
  earlySupporter: 'Early Supporter',
};

/** "earlyBird" → "Early Bird" for achievements we have no label for yet. */
const humanize = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** Membership and achievement icons next to a name, each with a tooltip. */
@Component({
  selector: 'app-profile-badges',
  host: { class: 'inline-flex items-center gap-1' },
  template: `
    @for (badge of badges(); track badge.key) {
      <span class="group relative inline-grid place-items-center" tabindex="0" role="img" [attr.aria-label]="badge.label">
        @switch (badge.kind) {
          @case ('plus') {
            <svg viewBox="0 0 24 24" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true">
              <defs>
                <linearGradient id="bolt-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#ffc94a" />
                  <stop offset="1" stop-color="#ff7a1a" />
                </linearGradient>
              </defs>
              <path
                d="M13.6 1.5 4.2 13.4c-.35.44-.04 1.1.53 1.1h5.7l-1.9 7.4c-.15.6.62.96 1 .48l9.3-11.9c.35-.44.04-1.1-.53-1.1h-5.6l2-7.3c.16-.6-.6-.97-1.1-.5Z"
                fill="url(#bolt-fill)"
                stroke="#ffb02e"
                stroke-width="0.6"
                stroke-linejoin="round"
              />
            </svg>
          }
          @case ('earlySupporter') {
            <svg viewBox="0 0 24 24" [style.width.px]="size()" [style.height.px]="size()" fill="none" stroke="#3b8cff" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="7.2" stroke-width="2.4" />
              <circle cx="12" cy="12" r="2.6" stroke-width="2.2" />
              <path d="M4.6 4.6 7.2 7.2M19.4 4.6 16.8 7.2M4.6 19.4 7.2 16.8M19.4 19.4 16.8 16.8" stroke-width="2.4" />
            </svg>
          }
          @default {
            <svg viewBox="0 0 24 24" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true">
              <circle cx="12" cy="10" r="6.5" fill="#56c2ff" />
              <path d="m8.5 15.5-2 6 5.5-2.2 5.5 2.2-2-6" fill="#3d7bff" />
              <path d="m12 6.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3L8.7 9l2.3-.3Z" fill="#07101f" />
            </svg>
          }
        }
        <span
          class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#11182b] px-2.5 py-1 text-xs font-semibold text-bone opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
          >{{ badge.label }}</span
        >
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileBadges {
  readonly plus = input(false);
  readonly achievements = input<string[]>([]);
  readonly size = input(22);

  protected readonly badges = computed<Badge[]>(() => {
    const list: Badge[] = [];
    if (this.plus()) list.push({ key: 'plus', kind: 'plus', label: 'Autodarts Plus' });
    for (const key of this.achievements()) {
      list.push({
        key,
        kind: key === 'earlySupporter' ? 'earlySupporter' : 'other',
        label: LABELS[key] ?? humanize(key),
      });
    }
    return list;
  });
}
