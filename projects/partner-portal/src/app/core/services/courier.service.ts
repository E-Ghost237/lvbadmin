import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import { UuidCursorPage } from '@lvb/models/common.model';
import { CourierAccount, CreateCourierRequest } from '@lvb/models/courier.model';

/**
 * Delivery couriers (livreurs) attached to the partner organisation —
 * `/v1/partner/couriers*` (permission `fleet.driver.manage`). Distinct from the
 * rental chauffeurs in `/v1/partner/drivers`. Cursor is the courier's user uuid.
 */
@Injectable({ providedIn: 'root' })
export class CourierService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(opts: { cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<CourierAccount>> {
    const params: Record<string, string> = {};
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<CourierAccount>>(`${this.baseUrl}/partner/couriers`, { params });
  }

  create(req: CreateCourierRequest): Observable<CourierAccount> {
    return this.http.post<CourierAccount>(`${this.baseUrl}/partner/couriers`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }
}
