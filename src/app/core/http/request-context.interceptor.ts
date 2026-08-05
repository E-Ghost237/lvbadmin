import { HttpInterceptorFn } from '@angular/common/http';
import { IDEMPOTENCY_KEY } from './api.config';

/**
 * API-08: every request carries a client-generated `X-Request-Id` for
 * end-to-end diagnosis. API-04: unsafe writes optionally carry an
 * `Idempotency-Key` supplied by the caller via `withIdempotencyKey()`.
 */
export const requestContextInterceptor: HttpInterceptorFn = (req, next) => {
  const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const headers: Record<string, string> = { 'X-Request-Id': requestId };
  const idempotencyKey = req.context.get(IDEMPOTENCY_KEY);
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  return next(req.clone({ setHeaders: headers }));
};
