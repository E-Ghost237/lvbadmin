import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import {
  AuthorizeDriverRequest, BlockRequest, FleetCalendar, FleetResource, OperatingHours, RentalDocument, RentalDocumentKind,
  RentalDocumentLink, SaveOperatingHoursRequest, SimulateRequest, SimulationResult, UnavailabilityCreated,
} from '../models';

/**
 * Rental fleet operations for the partner — `/v1/partner/*` (Rental module).
 * Vehicle routes need `fleet.vehicle.manage`, driver routes `fleet.driver.manage`
 * (+ FEATURE_PARTNER_DRIVER), the calendar `booking.read`, simulation `pricing.manage`.
 * Every mutation sends an Idempotency-Key.
 */
@Injectable({ providedIn: 'root' })
export class FleetOpsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly idem = () => ({ context: withIdempotencyKey(newIdempotencyKey()) });

  // --- Calendar & unavailability ------------------------------------------
  calendar(q: { starts_at: string; ends_at: string; vehicle_uuid?: string; driver_uuid?: string }): Observable<FleetCalendar> {
    const params: Record<string, string> = { starts_at: q.starts_at, ends_at: q.ends_at };
    if (q.vehicle_uuid) params['vehicle_uuid'] = q.vehicle_uuid;
    if (q.driver_uuid) params['driver_uuid'] = q.driver_uuid;
    return this.http.get<FleetCalendar>(`${this.baseUrl}/partner/calendar`, { params });
  }

  block(req: BlockRequest): Observable<UnavailabilityCreated> {
    return this.http.post<UnavailabilityCreated>(`${this.baseUrl}/partner/unavailability`, req, this.idem());
  }

  unblock(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/partner/unavailability/${uuid}`, this.idem());
  }

  recordMaintenance(vehicleUuid: string, req: { starts_at: string; ends_at: string; reason: string }): Observable<UnavailabilityCreated> {
    return this.http.post<UnavailabilityCreated>(`${this.baseUrl}/partner/vehicles/${vehicleUuid}/maintenance`, req, this.idem());
  }

  // --- Documents & photos ---------------------------------------------------
  listDocuments(resource: FleetResource, uuid: string): Observable<{ items: RentalDocument[] }> {
    return this.http.get<{ items: RentalDocument[] }>(`${this.baseUrl}/partner/${resource}/${uuid}/documents`);
  }

  uploadDocument(resource: FleetResource, uuid: string, kind: RentalDocumentKind, file: File): Observable<RentalDocument> {
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    return this.http.post<RentalDocument>(`${this.baseUrl}/partner/${resource}/${uuid}/documents`, body, this.idem());
  }

  uploadVehiclePhoto(uuid: string, file: File): Observable<RentalDocument> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<RentalDocument>(`${this.baseUrl}/partner/vehicles/${uuid}/media`, body, this.idem());
  }

  documentLink(resource: FleetResource, uuid: string, documentUuid: string): Observable<RentalDocumentLink> {
    return this.http.get<RentalDocumentLink>(`${this.baseUrl}/partner/${resource}/${uuid}/documents/${documentUuid}/download`);
  }

  // --- Operating hours --------------------------------------------------------
  getHours(resource: FleetResource, uuid: string): Observable<OperatingHours> {
    return this.http.get<OperatingHours>(`${this.baseUrl}/partner/${resource}/${uuid}/operating-hours`);
  }

  saveHours(resource: FleetResource, uuid: string, req: SaveOperatingHoursRequest): Observable<OperatingHours> {
    return this.http.put<OperatingHours>(`${this.baseUrl}/partner/${resource}/${uuid}/operating-hours`, req, this.idem());
  }

  // --- Driver ↔ vehicle authorisations ------------------------------------------
  authorizeDriver(driverUuid: string, req: AuthorizeDriverRequest): Observable<{ uuid: string; active: boolean }> {
    return this.http.post<{ uuid: string; active: boolean }>(`${this.baseUrl}/partner/drivers/${driverUuid}/authorizations`, req, this.idem());
  }

  revokeAuthorization(driverUuid: string, authorizationUuid: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/partner/drivers/${driverUuid}/authorizations`, {
      body: { authorization_uuid: authorizationUuid }, ...this.idem(),
    });
  }

  /** Vehicle/driver detail. A driver includes the vehicles they are currently authorised on (with `authorization_uuid`). */
  getResource(resource: FleetResource, uuid: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.baseUrl}/partner/${resource}/${uuid}`);
  }

  // --- Rate-plan simulation --------------------------------------------------------
  simulate(ratePlanUuid: string, req: SimulateRequest): Observable<SimulationResult> {
    return this.http.post<SimulationResult>(`${this.baseUrl}/partner/rate-plans/${ratePlanUuid}/simulate`, req);
  }
}
