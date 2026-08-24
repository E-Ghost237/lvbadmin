import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { GeoPoint, UuidCursorPage } from '../models';

export interface CreateGrilleRequest {
  nom: string;
  ville: string;
  frais_prise_en_charge: number;
  tarif_km: number;
  tarif_minute: number;
  prix_minimum: number;
  arrondi: number;
  plafond_remise?: number | null;
}

export type PricingGridStatus = 'BROUILLON' | 'ACTIVE' | 'ARCHIVEE';

export interface PricingGridSummary {
  uuid: string;
  name: string;
  city: string;
  status: PricingGridStatus;
  base_fee_xaf: number;
  price_per_km_xaf: number;
  price_per_minute_xaf: number;
  minimum_price_xaf: number;
  rounding_xaf: number;
  active_from: string | null;
  archived_at: string | null;
}

export type ZoneType = 'COUVERTURE' | 'INTERDITE' | 'MAJORATION' | 'DIFFICILE';

export interface Zone {
  id: number;
  nom: string;
  ville: string;
  type: ZoneType;
}

export interface CreateZoneRequest {
  nom: string;
  ville: string;
  type: ZoneType;
  points: GeoPoint[];
  supplement_fixe?: number | null;
  prix_minimum?: number | null;
}

/** UC-ADM-06/07 — /v1/admin/pricing-grids, /v1/admin/zones (Catalog module). */
@Injectable({ providedIn: 'root' })
export class PricingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPricingGrids(opts: { city?: string; status?: PricingGridStatus; cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<PricingGridSummary>> {
    const params: Record<string, string> = {};
    if (opts.city) params['city'] = opts.city;
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<PricingGridSummary>>(`${this.baseUrl}/admin/pricing-grids`, { params });
  }

  createGrille(req: CreateGrilleRequest): Observable<{ uuid: string; status: PricingGridStatus }> {
    return this.http.post<{ uuid: string; status: PricingGridStatus }>(`${this.baseUrl}/admin/pricing-grids`, req, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  activateGrille(uuid: string, city: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/pricing-grids/${uuid}/activate`, { city }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  listZones(ville?: string): Observable<Zone[]> {
    const params: Record<string, string> = ville ? { ville } : {};
    return this.http.get<{ data: Zone[] }>(`${this.baseUrl}/admin/zones`, { params }).pipe(map((r) => r.data));
  }

  createZone(req: CreateZoneRequest): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.baseUrl}/admin/zones`, req);
  }

  deleteZone(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/zones/${id}`);
  }
}
