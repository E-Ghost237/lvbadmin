import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from './api.config';

/**
 * API-03: `Authorization: Bearer <jeton>` on every request to our own API.
 * Not exercised yet (mock services never call HttpClient) but wired so the
 * eventual `Http*Service` layer needs zero boilerplate for auth headers.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const baseUrl = inject(API_BASE_URL);
  if (!req.url.startsWith(baseUrl)) return next(req);

  const token = auth.accessToken;
  const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        //auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
