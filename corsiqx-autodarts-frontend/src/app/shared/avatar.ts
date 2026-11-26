import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { initials } from './initials';

/** Autodarts avatar with an initials tile while it loads or when it is missing or broken. */
@Component({
  selector: 'app-avatar',
  host: { class: 'relative inline-grid shrink-0 place-items-center overflow-hidden' },
  template: `
    <span
      class="col-start-1 row-start-1 grid size-full place-items-center bg-linear-to-br from-accent to-sky font-display font-bold text-board"
      aria-hidden="true"
      >{{ initials(name()) }}</span
    >
    @if (url() && !failed()) {
      <img
        [src]="url()"
        alt=""
        class="col-start-1 row-start-1 size-full object-cover"
        loading="lazy"
        referrerpolicy="no-referrer"
        (error)="failed.set(true)"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly url = input<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly initials = initials;
}
