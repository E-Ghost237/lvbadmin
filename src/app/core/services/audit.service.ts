import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { CursorPage } from '../models';

export interface AuditLogEntry {
  id: number;
  cree_le: string;
  action: string;
  ressource_type: string;
  ressource_id: string;
  acteur_utilisateur_id: number | null;
  acteur_type: string;
  ip: string | null;
  valeur_avant: Record<string, unknown> | null;
  valeur_apres: Record<string, unknown> | null;
  metadonnees: Record<string, unknown> | null;
}

export interface AuditSearchFilters {
  action?: string;
  ressource_type?: string;
  ressource_id?: string;
  du?: string;
  au?: string;
  cursor?: number;
}

/** UC-ADM-14 — /v1/admin/audit (Analytics module). Append-only, immutable. */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  search(filters: AuditSearchFilters): Observable<CursorPage<AuditLogEntry>> {
    const params: Record<string, string> = {};
    if (filters.action) params['action'] = filters.action;
    if (filters.ressource_type) params['ressource_type'] = filters.ressource_type;
    if (filters.ressource_id) params['ressource_id'] = filters.ressource_id;
    if (filters.du) params['du'] = filters.du;
    if (filters.au) params['au'] = filters.au;
    if (filters.cursor) params['cursor'] = String(filters.cursor);
    return this.http.get<CursorPage<AuditLogEntry>>(`${this.baseUrl}/admin/audit`, { params });
  }

  exportCsv(filters: AuditSearchFilters): Observable<Blob> {
    const params: Record<string, string> = {};
    if (filters.action) params['action'] = filters.action;
    if (filters.ressource_type) params['ressource_type'] = filters.ressource_type;
    if (filters.ressource_id) params['ressource_id'] = filters.ressource_id;
    if (filters.du) params['du'] = filters.du;
    if (filters.au) params['au'] = filters.au;
    return this.http.get(`${this.baseUrl}/admin/audit/export`, { params, responseType: 'blob' });
  }
}
