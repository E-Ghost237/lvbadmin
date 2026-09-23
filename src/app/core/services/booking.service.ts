import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { Booking, BookingAction, BookingStatus, CursorPage, DisputeOutcome } from '../models';

/**
 * Admin side of the Booking module (LVB-CDC-MKT-RENT-2026-V1.0,
 * RGRNT030BookingTransition) — `/v1/admin/marketplace/bookings`. Gated by
 * `booking.manage` + `FEATURE_RENTAL_BOOKING`. The list endpoint has no
 * `partner_id` filter server-side — an admin sees every booking across
 * every partner, filterable only by `status`.
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listBookings(opts: { status?: BookingStatus; cursor?: number; limit?: number } = {}): Observable<CursorPage<Booking>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<Booking>>(`${this.baseUrl}/admin/marketplace/bookings`, { params });
  }

  getBooking(uuid: string): Observable<Booking> {
    return this.http.get<Booking>(`${this.baseUrl}/admin/marketplace/bookings/${uuid}`);
  }

  private act(uuid: string, action: BookingAction, body: Record<string, unknown> = {}): Observable<Booking> {
    return this.http.post<Booking>(`${this.baseUrl}/admin/marketplace/bookings/${uuid}/${action}`, body, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  acceptBooking(uuid: string): Observable<Booking> {
    return this.act(uuid, 'accept');
  }

  rejectBooking(uuid: string, reason: string): Observable<Booking> {
    return this.act(uuid, 'reject', { reason });
  }

  cancelBooking(uuid: string, reason: string): Observable<Booking> {
    return this.act(uuid, 'cancel', { reason });
  }

  reportIncident(uuid: string, reason: string): Observable<Booking> {
    return this.act(uuid, 'incident', { reason });
  }

  assignDriver(uuid: string, driverUuid: string): Observable<Booking> {
    return this.act(uuid, 'assign-driver', { driver_uuid: driverUuid });
  }

  resolveDispute(uuid: string, outcome: DisputeOutcome, reason: string): Observable<Booking> {
    return this.act(uuid, 'resolve-dispute', { outcome, reason });
  }
}
