import { HttpInterceptorFn } from '@angular/common/http';
import { IDEMPOTENCY_KEY, newIdempotencyKey } from './api.config';

/**
 * API-08: every request carries a client-generated `X-Request-Id` for
 * end-to-end diagnosis. API-04: unsafe writes optionally carry an
 * `Idempotency-Key` supplied by the caller via `withIdempotencyKey()`.
 */
export const requestContextInterceptor: HttpInterceptorFn = (req, next) => {
  const headers: Record<string, string> = { 'X-Request-Id': newIdempotencyKey() };
  const idempotencyKey = req.context.get(IDEMPOTENCY_KEY);
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  return next(req.clone({ setHeaders: headers }));
};
