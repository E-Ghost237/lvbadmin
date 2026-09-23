import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import { CursorPage } from '@lvb/models/common.model';
import { Booking, BookingStatus } from '@lvb/models/booking.model';

type PartnerBookingAction = 'accept' | 'reject' | 'assign-driver' | 'en-route' | 'start' | 'complete' | 'cancel' | 'incident';

/**
 * Partner self-service side of the Booking module
 * (LVB-CDC-MKT-RENT-2026-V1.0) — `/v1/partner/bookings*`. Gated by
 * `booking.{read,accept,assign_driver,execute}` + `FEATURE_RENTAL_BOOKING`.
 * Unlike every other partner-facing module, `booking.accept`/
 * `assign_driver`/`execute` are granted to BOTH `RESPONSABLE_PARTENAIRE`
 * AND `OPERATEUR_PARTENAIRE` (`PartnerRole::allows()`) — operational staff
 * can run the day-to-day booking lifecycle even though they can't touch
 * fleet, offers, wallet or the org profile.
 *
 * `BookingService::bookingData()` on the backend builds the exact same
 * resource for admin, partner and client alike, so this reuses the admin
 * app's `Booking`/`BookingStatus`/`BookingHistoryEntry` shapes verbatim via
 * `@lvb/models/booking.model`. `resolve-dispute` is admin-only and not
 * exposed here; `en-route`/`start`/`complete` are partner-only and were
 * never available on the admin side.
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(opts: { status?: BookingStatus; cursor?: number; limit?: number } = {}): Observable<CursorPage<Booking>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<Booking>>(`${this.baseUrl}/partner/bookings`, { params });
  }

  get(uuid: string): Observable<Booking> {
    return this.http.get<Booking>(`${this.baseUrl}/partner/bookings/${uuid}`);
  }

  private act(uuid: string, action: PartnerBookingAction, body: Record<string, unknown> = {}): Observable<Booking> {
    return this.http.post<Booking>(`${this.baseUrl}/partner/bookings/${uuid}/${action}`, body, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  accept(uuid: string): Observable<Booking> {
    return this.act(uuid, 'accept');
  }

  reject(uuid: string, reason: string): Observable<Booking> {
    return this.act(uuid, 'reject', { reason });
  }

  assignDriver(uuid: string, driverUuid: string): Observable<Booking> {
    return this.act(uuid, 'assign-driver', { driver_uuid: driverUuid });
  }

  enRoute(uuid: string): Observable<Booking> {
    return this.act(uuid, 'en-route');
  }

  start(uuid: string): Observable<Booking> {
    return this.act(uuid, 'start');
  }

  complete(uuid: string): Observable<Booking> {
    return this.act(uuid, 'complete');
  }

  cancel(uuid: string, reason: string): Observable<Booking> {
    return this.act(uuid, 'cancel', { reason });
  }

  reportIncident(uuid: string, reason: string): Observable<Booking> {
    return this.act(uuid, 'incident', { reason });
  }
}
