import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const regionNames = new Intl.DisplayNames(['de'], { type: 'region' });

/** Country flag from the self-hosted flag-icons set; unknown codes show nothing. */
@Component({
  selector: 'app-flag',
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (code(); as code) {
      <span
        class="fi fi-{{ code }} rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.25)]"
        role="img"
        [attr.aria-label]="label()"
        [attr.title]="label()"
      ></span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Flag {
  readonly country = input<string | null>(null);

  protected readonly code = computed(() => {
    const value = this.country()?.toLowerCase() ?? '';
    return /^[a-z]{2}$/.test(value) ? value : null;
  });

  protected readonly label = computed(() => {
    const code = this.code();
    if (!code) return '';
    try {
      return regionNames.of(code.toUpperCase()) ?? code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
  });
}
