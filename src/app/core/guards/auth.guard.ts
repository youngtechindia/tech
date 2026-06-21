import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Redirect to /login when unauthenticated. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.parseUrl('/login');
};

/** Bounce already-authenticated users away from /login → /new. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.parseUrl('/new');
};

/** Admin-only routes (e.g. data ingest). Non-admins get bounced to /new. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.parseUrl('/login');
  if (!auth.isAdmin()) return router.parseUrl('/new');
  return true;
};

/** Maker-only routes (New Report). Bounces to /review for checkers. */
export const makerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.parseUrl('/login');
  if (auth.isMaker()) return true;
  if (auth.isAdmin()) return true;
  return router.parseUrl(auth.isChecker() ? '/review' : '/login');
};

/** Checker-only routes (Review Queue). Bounces to /new for non-checkers. */
export const checkerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.parseUrl('/login');
  if (auth.isChecker()) return true;
  if (auth.isAdmin()) return true;
  return router.parseUrl('/new');
};
