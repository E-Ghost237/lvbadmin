import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import { UuidCursorPage } from '@lvb/models/common.model';
import { MarketplaceCategory, MarketplaceOffer, MarketplaceOfferStatus } from '@lvb/models/marketplace.model';
import { SaveOfferRequest } from '../models';

/**
 * Partner self-service side of the Marketplace module
 * (LVB-CDC-MKT-RENT-2026-V1.0) — `/v1/partner/offers*`. Gated by
 * `marketplace.offer.{read,create,update}` (RESPONSABLE_PARTENAIRE only) +
 * `FEATURE_MARKETPLACE_PUBLIC`. `MarketplaceService::offers()`/`ownOffer()`/
 * `saveOffer()` are the exact same methods the admin moderation screen
 * calls, so the `MarketplaceOffer` read shape is reused verbatim from
 * `@lvb/models/marketplace.model`. A partner can reach `EN_REVUE`
 * (submit)/`ARCHIVEE` from `BROUILLON`, `BROUILLON`/`ARCHIVEE` from
 * `EN_REVUE` or `REJETEE`, and `SUSPENDUE`/`EN_REVUE`/`ARCHIVEE` from
 * `PUBLIEE` — never `PUBLIEE`/`REJETEE` themselves (admin-only targets).
 */
@Injectable({ providedIn: 'root' })
export class OfferService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Public, unauthenticated, feature-flag gated — the source for the offer form's category picker. */
  listCategories(): Observable<{ items: MarketplaceCategory[] }> {
    return this.http.get<{ items: MarketplaceCategory[] }>(`${this.baseUrl}/marketplace/categories`);
  }

  list(opts: { status?: MarketplaceOfferStatus; cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<MarketplaceOffer>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<MarketplaceOffer>>(`${this.baseUrl}/partner/offers`, { params });
  }

  get(uuid: string): Observable<MarketplaceOffer> {
    return this.http.get<MarketplaceOffer>(`${this.baseUrl}/partner/offers/${uuid}`);
  }

  create(req: SaveOfferRequest): Observable<MarketplaceOffer> {
    return this.http.post<MarketplaceOffer>(`${this.baseUrl}/partner/offers`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  update(uuid: string, req: SaveOfferRequest): Observable<MarketplaceOffer> {
    return this.http.patch<MarketplaceOffer>(`${this.baseUrl}/partner/offers/${uuid}`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  transition(uuid: string, status: MarketplaceOfferStatus): Observable<MarketplaceOffer> {
    return this.http.post<MarketplaceOffer>(`${this.baseUrl}/partner/offers/${uuid}/status`, { status }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
