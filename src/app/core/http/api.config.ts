import { InjectionToken } from '@angular/core';
import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Base URL for the real backend. `make up` in lvbapi exposes the API on
 * `http://localhost:8001/v1` (direct nginx, always up) per its README.
 * Swap via `provide: API_BASE_URL, useValue: '...'` in app.config.ts for
 * other environments — no call-site changes required.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8001/v1',
});

/** API-04 — attach an idempotency key to a write request via HttpContext. */
export const IDEMPOTENCY_KEY = new HttpContextToken<string | undefined>(() => undefined);

export function withIdempotencyKey(key: string): HttpContext {
  return new HttpContext().set(IDEMPOTENCY_KEY, key);
}

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
