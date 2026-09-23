import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@lvb/http/api.config';
import { PartnerOrderDetail, PartnerOrderFilters, PartnerOrderListResponse } from '../models';

/**
 * Partner-as-client side of the Ordering module —
 * `/v1/partner/orders*`. This is the partner org's OWN deliveries booked
 * through LVB, a different concept from Marketplace `Booking` (where the
 * partner is the service provider) — see `PartnerOrder` docblock.
 */
@Injectable({ providedIn: 'root' })
export class PartnerOrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: PartnerOrderFilters = {}): Observable<PartnerOrderListResponse> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value) params[key] = value;
    }
    return this.http.get<PartnerOrderListResponse>(`${this.baseUrl}/partner/orders`, { params });
  }

  get(uuid: string): Observable<PartnerOrderDetail> {
    return this.http.get<PartnerOrderDetail>(`${this.baseUrl}/partner/orders/${uuid}`);
  }

  /** Raw PDF bytes, not JSON — `recu_disponible` on the detail gates whether this will succeed. */
  downloadReceipt(uuid: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/partner/orders/${uuid}/receipt`, { responseType: 'blob' });
  }
}
