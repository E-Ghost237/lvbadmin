import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { CursorPage, Driver, DriverStatus, Vehicle, VehicleStatus, RentalVehicleType } from '../models';

/**
 * Admin side of the Rental/Fleet module (LVB-CDC-MKT-RENT-2026-V1.0) —
 * `/v1/admin/marketplace/vehicles`, `.../drivers`, `.../vehicle-types`.
 *
 * Every vehicle/driver call requires `partner_id` — the marketplace
 * module's own internal integer id, NOT the partner `uuid` the rest of
 * this admin panel's Partner module uses everywhere else. There is
 * currently no admin-reachable endpoint that resolves one from the other
 * (the only lookup that returns it, `GET /v1/marketplace/providers/{uuid}`,
 * is a public, feature-flagged, ACTIF-partners-only endpoint — unreliable
 * as a general resolver, so this service doesn't lean on it). In practice
 * an admin currently discovers a partner_id from an Offer or Booking row
 * elsewhere in this section; a proper fix belongs on the backend.
 */
@Injectable({ providedIn: 'root' })
export class RentalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listVehicles(partnerId: number, opts: { status?: VehicleStatus; cursor?: number; limit?: number } = {}): Observable<CursorPage<Vehicle>> {
    const params: Record<string, string> = { partner_id: String(partnerId) };
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<Vehicle>>(`${this.baseUrl}/admin/marketplace/vehicles`, { params });
  }

  updateVehicleStatus(partnerId: number, uuid: string, status: VehicleStatus): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.baseUrl}/admin/marketplace/vehicles/${uuid}`, { partner_id: partnerId, status }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  listDrivers(partnerId: number, opts: { status?: DriverStatus; cursor?: number; limit?: number } = {}): Observable<CursorPage<Driver>> {
    const params: Record<string, string> = { partner_id: String(partnerId) };
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<Driver>>(`${this.baseUrl}/admin/marketplace/drivers`, { params });
  }

  updateDriverStatus(partnerId: number, uuid: string, status: DriverStatus): Observable<Driver> {
    return this.http.patch<Driver>(`${this.baseUrl}/admin/marketplace/drivers/${uuid}`, { partner_id: partnerId, status }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  listVehicleTypes(): Observable<{ items: RentalVehicleType[] }> {
    return this.http.get<{ items: RentalVehicleType[] }>(`${this.baseUrl}/admin/marketplace/vehicle-types`);
  }

  saveVehicleType(code: string, label: string, active: boolean): Observable<RentalVehicleType> {
    return this.http.post<RentalVehicleType>(`${this.baseUrl}/admin/marketplace/vehicle-types`, { code, label, active }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
