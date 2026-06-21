import { Routes } from '@angular/router';

import { adminGuard, authGuard, checkerGuard, guestGuard, makerGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'new' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'new',
    canActivate: [makerGuard],
    loadComponent: () =>
      import('./features/new/new.component').then((m) => m.NewReportComponent),
  },
  {
    path: 'review',
    canActivate: [checkerGuard],
    loadComponent: () =>
      import('./features/review/review.component').then((m) => m.ReviewQueueComponent),
  },
  {
    path: 'draft/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/draft/draft.component').then((m) => m.DraftComponent),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'new' },
];
