import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';

export type ParametreType = 'string' | 'integer' | 'decimal' | 'boolean' | 'json';

export interface Parametre {
  cle: string;
  valeur: string;
}

/**
 * UC-ADM-13 — /v1/admin/parametres/{cle} (Catalog module). Purely a
 * generic key-value store server-side; no list-all endpoint and no
 * fixed key registry exist anywhere in the backend, so this is a
 * genuine get/set-by-key tool rather than a curated settings page.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get(cle: string): Observable<Parametre> {
    return this.http.get<Parametre>(`${this.baseUrl}/admin/parametres/${encodeURIComponent(cle)}`);
  }

  set(cle: string, valeur: string, type: ParametreType, description?: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/admin/parametres/${encodeURIComponent(cle)}`, { valeur, type, description: description ?? null });
  }
}
