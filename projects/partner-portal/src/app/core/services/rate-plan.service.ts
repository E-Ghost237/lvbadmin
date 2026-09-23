import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import { CursorPage } from '@lvb/models/common.model';
import { RatePlan, SaveRatePlanRequest } from '../models';

/**
 * `/v1/partner/rate-plans*` (Rental module) — gated by `pricing.manage`
 * (RESPONSABLE_PARTENAIRE only) + `FEATURE_RENTAL_FLEET`. A rate plan must
 * exist (and its category/vehicle must be active) before a Marketplace
 * offer referencing it can be published — see OfferService.
 */
@Injectable({ providedIn: 'root' })
export class RatePlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(opts: { cursor?: number; limit?: number } = {}): Observable<CursorPage<RatePlan>> {
    const params: Record<string, string> = {};
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<RatePlan>>(`${this.baseUrl}/partner/rate-plans`, { params });
  }

  get(uuid: string): Observable<RatePlan> {
    return this.http.get<RatePlan>(`${this.baseUrl}/partner/rate-plans/${uuid}`);
  }

  create(req: SaveRatePlanRequest): Observable<RatePlan> {
    return this.http.post<RatePlan>(`${this.baseUrl}/partner/rate-plans`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  update(uuid: string, req: SaveRatePlanRequest): Observable<RatePlan> {
    return this.http.patch<RatePlan>(`${this.baseUrl}/partner/rate-plans/${uuid}`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  /** Equivalent to `update(uuid, { active: true })` — not mutually exclusive with other plans. */
  activate(uuid: string): Observable<RatePlan> {
    return this.http.post<RatePlan>(`${this.baseUrl}/partner/rate-plans/${uuid}/activate`, {}, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
