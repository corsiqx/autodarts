import { Routes } from '@angular/router';
import { sessionGuard } from './core/users/session.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Anmelden | corsiqx autodarts',
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'dashboard',
    title: 'Dashboard | corsiqx autodarts',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  { path: '**', redirectTo: '' },
];
