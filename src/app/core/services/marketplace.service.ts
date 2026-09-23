import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { MarketplaceCategory, MarketplaceOffer, MarketplaceOfferStatus, UuidCursorPage } from '../models';

/**
 * Admin side of the Marketplace module (LVB-CDC-MKT-RENT-2026-V1.0) —
 * `/v1/admin/marketplace/categories` + `/v1/admin/marketplace/offers`.
 * The public `/v1/marketplace/*` and partner-facing `/v1/partner/offers`
 * routes belong to the Flutter client app and the future Partner Web
 * dashboard respectively, not this admin panel.
 */
@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listCategories(): Observable<{ items: MarketplaceCategory[] }> {
    return this.http.get<{ items: MarketplaceCategory[] }>(`${this.baseUrl}/admin/marketplace/categories`);
  }

  createCategory(name: string, slug: string, active: boolean): Observable<MarketplaceCategory> {
    return this.http.post<MarketplaceCategory>(`${this.baseUrl}/admin/marketplace/categories`, { name, slug, active }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  updateCategory(uuid: string, name: string, slug: string, active: boolean): Observable<MarketplaceCategory> {
    return this.http.patch<MarketplaceCategory>(`${this.baseUrl}/admin/marketplace/categories/${uuid}`, { name, slug, active }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  listOffers(opts: { status?: MarketplaceOfferStatus; cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<MarketplaceOffer>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<MarketplaceOffer>>(`${this.baseUrl}/admin/marketplace/offers`, { params });
  }

  transitionOffer(uuid: string, status: MarketplaceOfferStatus): Observable<MarketplaceOffer> {
    return this.http.post<MarketplaceOffer>(`${this.baseUrl}/admin/marketplace/offers/${uuid}/status`, { status }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
