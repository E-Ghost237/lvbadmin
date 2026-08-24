import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { UuidCursorPage } from '../models';

export type ParametreType = 'string' | 'integer' | 'decimal' | 'boolean' | 'json';

export interface Parametre {
  cle: string;
  valeur: string;
}

export interface SettingSummary {
  key: string;
  value: string;
  type: ParametreType;
  description: string | null;
  updated_at: string | null;
}

/**
 * UC-ADM-13 — /v1/admin/settings (Catalog module). All three calls go
 * through the `/admin/settings` "contract" prefix (permission
 * `settings.manage`) rather than the older `/admin/parametres` prefix
 * (permission `catalog.manage`, same underlying controller) — mixing the
 * two would gate list/get/set on two different permissions for what is one
 * feature.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(cursor?: string): Observable<UuidCursorPage<SettingSummary>> {
    const params: Record<string, string> = cursor ? { cursor } : {};
    return this.http.get<UuidCursorPage<SettingSummary>>(`${this.baseUrl}/admin/settings`, { params });
  }

  get(cle: string): Observable<Parametre> {
    return this.http.get<Parametre>(`${this.baseUrl}/admin/settings/${encodeURIComponent(cle)}`);
  }

  set(cle: string, valeur: string, type: ParametreType, description?: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/admin/settings/${encodeURIComponent(cle)}`, { valeur, type, description: description ?? null });
  }
}
