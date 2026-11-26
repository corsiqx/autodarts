import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { UsersStore } from '../../core/users/users.store';
import { initials } from '../../shared/initials';
import { AddAccountDialog } from './add-account-dialog';

@Component({
  selector: 'app-login-page',
  imports: [AddAccountDialog],
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly router = inject(Router);
  private readonly addDialog = viewChild.required(AddAccountDialog);

  protected readonly skeletonRows = [0, 1, 2];
  protected readonly initials = initials;

  constructor() {
    // A successful login (by click or by creating an account) opens the dashboard.
    effect(() => {
      if (this.store.session()) {
        void this.router.navigate(['/dashboard']);
      }
    });
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected openAddDialog(): void {
    this.addDialog().open();
  }
}
