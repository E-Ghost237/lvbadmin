import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { GeoPoint } from '../models';

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

/**
 * UC-ADM-06/07 — /v1/admin/grilles-tarifaires, /v1/admin/zones (Catalog
 * module). There is no list/get for pricing grids — only create + activate
 * — so a grid can only be activated in the same session it was created in
 * (its id is only known from the create response).
 */
@Injectable({ providedIn: 'root' })
export class PricingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  createGrille(req: CreateGrilleRequest): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.baseUrl}/admin/grilles-tarifaires`, req);
  }

  activateGrille(id: number, ville: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/grilles-tarifaires/${id}/activer`, { ville });
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
