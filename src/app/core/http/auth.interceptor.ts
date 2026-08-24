import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from './api.config';

/** Endpoints that must never trigger a refresh-and-retry on 401 (would either loop or make no sense). */
const NO_REFRESH_PATTERNS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/password/'];

/**
 * API-03: `Authorization: Bearer <jeton>` on every request to our own API.
 * A 401 on any other authenticated request triggers one silent
 * `refreshSession()` + retry (single-flight, see AuthService); if the
 * refresh itself fails, the session is cleared and the user is sent back
 * to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const baseUrl = inject(API_BASE_URL);
  if (!req.url.startsWith(baseUrl)) return next(req);

  const authorize = (r: typeof req) => {
    const token = auth.accessToken;
    return token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;
  };

  return next(authorize(req)).pipe(
    catchError((err: unknown) => {
      const isRefreshable = err instanceof HttpErrorResponse && err.status === 401
        && !NO_REFRESH_PATTERNS.some((p) => req.url.includes(p));
      if (!isRefreshable) return throwError(() => err);

      return auth.refreshSession().pipe(
        switchMap(() => next(authorize(req))),
        catchError(() => {
          router.navigate(['/login']);
          return throwError(() => err);
        }),
      );
    }),
  );
};
