import { ChangeDetectionStrategy, Component, OnInit, inject, viewChild } from '@angular/core';
import { UsersStore } from '../../core/users/users.store';
import { AddAccountDialog } from './add-account-dialog';

@Component({
  selector: 'app-login-page',
  imports: [AddAccountDialog],
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly addDialog = viewChild.required(AddAccountDialog);

  protected readonly skeletonRows = [0, 1, 2];

  ngOnInit(): void {
    void this.store.load();
  }

  protected openAddDialog(): void {
    this.addDialog().open();
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters =
      parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '').slice(0, 2);
    return letters.toUpperCase();
  }
}
