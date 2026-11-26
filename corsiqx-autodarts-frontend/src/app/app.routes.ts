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
  {
    path: 'play',
    title: 'Jetzt spielen | corsiqx autodarts',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/play/play-setup.page').then((m) => m.PlaySetupPage),
  },
  {
    path: 'match/:matchId',
    title: 'Match | corsiqx autodarts',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/play/match.page').then((m) => m.MatchPage),
  },
  {
    path: 'stats',
    title: 'Statistiken | corsiqx autodarts',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/stats/stats.page').then((m) => m.StatsPage),
  },
  {
    path: 'stats/match/:matchId',
    title: 'Match-Statistik | corsiqx autodarts',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/stats/match-stats.page').then((m) => m.MatchStatsPage),
  },
  { path: '**', redirectTo: '' },
];
