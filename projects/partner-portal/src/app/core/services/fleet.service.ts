import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import { CursorPage } from '@lvb/models/common.model';
import { Driver, DriverStatus, RentalVehicleType, Vehicle, VehicleStatus } from '@lvb/models/rental.model';
import { SaveDriverRequest, SaveVehicleRequest } from '../models';

/**
 * Partner self-service side of the Rental/Fleet module
 * (LVB-CDC-MKT-RENT-2026-V1.0) — `/v1/partner/{vehicles,drivers,vehicle-types}`.
 * Gated by `fleet.vehicle.manage`/`fleet.driver.manage` (RESPONSABLE_PARTENAIRE
 * only) + `FEATURE_RENTAL_FLEET` (+ `FEATURE_PARTNER_DRIVER` for drivers).
 * `RentalService::list()`/`get()`/`save()` on the backend are the exact same
 * methods the admin Fleet screen calls (just partner-scoped by auth context
 * instead of an admin-supplied `partner_id`), so this reuses the admin
 * app's `Vehicle`/`Driver`/`RentalVehicleType` model shapes verbatim via
 * `@lvb/models/rental.model`. Document upload, photo media, maintenance
 * blocking, driver-vehicle authorizations, and the fleet calendar are not
 * covered yet — a later stage.
 */
@Injectable({ providedIn: 'root' })
export class FleetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listVehicles(opts: { status?: VehicleStatus; cursor?: number; limit?: number } = {}): Observable<CursorPage<Vehicle>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<Vehicle>>(`${this.baseUrl}/partner/vehicles`, { params });
  }

  createVehicle(req: SaveVehicleRequest): Observable<Vehicle> {
    return this.http.post<Vehicle>(`${this.baseUrl}/partner/vehicles`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  updateVehicle(uuid: string, req: SaveVehicleRequest): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.baseUrl}/partner/vehicles/${uuid}`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  listDrivers(opts: { status?: DriverStatus; cursor?: number; limit?: number } = {}): Observable<CursorPage<Driver>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<Driver>>(`${this.baseUrl}/partner/drivers`, { params });
  }

  createDriver(req: SaveDriverRequest): Observable<Driver> {
    return this.http.post<Driver>(`${this.baseUrl}/partner/drivers`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  updateDriver(uuid: string, req: SaveDriverRequest): Observable<Driver> {
    return this.http.patch<Driver>(`${this.baseUrl}/partner/drivers/${uuid}`, req, { context: withIdempotencyKey(newIdempotencyKey()) });
  }

  /** Read-only for a partner — creation is admin-only (`fleet.manage`). */
  listVehicleTypes(): Observable<{ items: RentalVehicleType[] }> {
    return this.http.get<{ items: RentalVehicleType[] }>(`${this.baseUrl}/partner/vehicle-types`);
  }
}
