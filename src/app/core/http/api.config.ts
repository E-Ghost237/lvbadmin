import { InjectionToken } from '@angular/core';
import { HttpContext, HttpContextToken } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Base URL for the real backend, sourced from `environments/environment.ts`.
 * Swap via `provide: API_BASE_URL, useValue: '...'` in app.config.ts for
 * a one-off override — no call-site changes required.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

/** API-04 — attach an idempotency key to a write request via HttpContext. */
export const IDEMPOTENCY_KEY = new HttpContextToken<string | undefined>(() => undefined);

export function withIdempotencyKey(key: string): HttpContext {
  return new HttpContext().set(IDEMPOTENCY_KEY, key);
}

/**
 * A random UUID, used both for `Idempotency-Key` (the backend validates
 * this one as a real UUID, ERR-4001 otherwise) and for `X-Request-Id` (the
 * backend accepts any string there, but there's no reason to keep two
 * separate "make up a random ID" implementations at different quality
 * levels — see `requestContextInterceptor`).
 *
 * Every fallback path here must still produce RFC 4122 v4 shape.
 * `crypto.randomUUID()` requires a secure context (HTTPS or localhost) —
 * this admin panel is deployed over plain HTTP, so that branch is never
 * actually reachable there and previously fell through to a non-UUID
 * `idem-<timestamp>-<random>` string that the backend rejected outright.
 * `crypto.getRandomValues()` has no such restriction, so it's the real
 * fallback; only a bare `Math.random()` string is used if `crypto` itself
 * doesn't exist at all (non-browser/SSR execution).
 */
export function newIdempotencyKey(): string {
  // `any` deliberately: DOM's `Crypto` and Node's global crypto typings
  // disagree on this surface, and the point here is to probe at runtime
  // for whichever methods actually exist rather than trust either type.
  const webCrypto: any = typeof crypto !== 'undefined' ? crypto : undefined;

  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  if (typeof webCrypto?.getRandomValues === 'function') {
    const bytes: Uint8Array = webCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
