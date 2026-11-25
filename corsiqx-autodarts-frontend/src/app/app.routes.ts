import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Anmelden | corsiqx autodarts',
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  { path: '**', redirectTo: '' },
];
