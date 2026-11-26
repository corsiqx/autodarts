import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateUserField } from '../../core/users/user.model';
import { UsersStore } from '../../core/users/users.store';

@Component({
  selector: 'app-add-account-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './add-account-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddAccountDialog {
  protected readonly store = inject(UsersStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(64)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected readonly generalError = computed(() => {
    const error = this.store.createError();
    return error && !error.field ? error.message : null;
  });

  open(): void {
    this.reset();
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && !this.store.creating()) {
      this.close();
    }
  }

  protected onCancel(event: Event): void {
    if (this.store.creating()) {
      event.preventDefault();
    }
  }

  protected onInput(field: CreateUserField): void {
    if (this.store.createError()?.field === field || this.generalError()) {
      this.store.clearCreateError();
    }
  }

  protected fieldError(field: CreateUserField): string | null {
    const serverError = this.store.createError();
    if (serverError?.field === field) {
      return serverError.message;
    }

    const control = this.form.controls[field];
    if (!control.errors || !(control.touched || this.submitted())) {
      return null;
    }
    if (control.hasError('required')) {
      return {
        name: 'Gib einen Namen ein.',
        email: 'Gib die E-Mail deines Autodarts-Kontos ein.',
        password: 'Gib dein Autodarts-Passwort ein.',
      }[field];
    }
    if (control.hasError('email')) {
      return 'Diese E-Mail-Adresse ist ungültig.';
    }
    if (control.hasError('minlength')) {
      return 'Der Name braucht mindestens 2 Zeichen.';
    }
    if (control.hasError('maxlength')) {
      return 'Diese Eingabe ist zu lang.';
    }
    return null;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.store.creating()) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    const { name, email, password } = this.form.getRawValue();
    const created = await this.store.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    if (created) {
      this.close();
    } else if (this.store.createError()?.field) {
      this.focusField(this.store.createError()!.field!);
    }
  }

  private reset(): void {
    this.form.reset();
    this.submitted.set(false);
    this.showPassword.set(false);
    this.store.clearCreateError();
  }

  private focusFirstInvalid(): void {
    const first = (['name', 'email', 'password'] as const).find(
      (field) => this.form.controls[field].invalid,
    );
    if (first) {
      this.focusField(first);
    }
  }

  private focusField(field: CreateUserField): void {
    this.dialog().nativeElement.querySelector<HTMLInputElement>(`#account-${field}`)?.focus();
  }
}
