import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

/**
 * Adds the simulated-AD identity headers to every backend call.
 *   X-User — current username (used by app.api.user)
 *   X-Role — advisory only (BE re-derives from username)
 *
 * Anonymous endpoints (none right now) would short-circuit on the missing
 * header server-side.
 */
export const userHeaderInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const session = auth.session();
  if (!session) return next(req);
  const cloned = req.clone({
    setHeaders: {
      'X-User': session.username,
      'X-Role': session.role,
    },
  });
  return next(cloned);
};
