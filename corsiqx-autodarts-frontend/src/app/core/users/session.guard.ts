import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UsersStore } from './users.store';

/** Only lets an Autodarts-logged-in account through; otherwise back to account selection. */
export const sessionGuard: CanActivateFn = () => {
  const store = inject(UsersStore);
  return store.session() ? true : inject(Router).createUrlTree(['/']);
};
