import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';

export type ExportResource = 'commandes' | 'paiements' | 'livreurs';
export type ExportFormat = 'csv' | 'xlsx';
export type ExportStatus = 'EN_ATTENTE' | 'EN_COURS' | 'PRET' | 'ECHEC' | 'EXPIRE';

export interface AdminExportStatus {
  uuid: string;
  requested_by?: number;
  resource: ExportResource;
  format: ExportFormat;
  filters: Record<string, unknown>;
  status: ExportStatus;
  file_name: string | null;
  rows: number | null;
  bytes: number | null;
  sha256: string | null;
  error_code: string | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string;
  download_url: string | null;
}

/** UC-ADM-12 — /v1/admin/exports (Analytics module). Async CSV/XLSX export jobs. */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  requestExport(ressource: ExportResource, format: ExportFormat, filtres?: { from?: string; to?: string; statuses?: string[] }): Observable<{ export_id: string; statut: string; expire_le: string; status_url: string }> {
    return this.http.post<{ export_id: string; statut: string; expire_le: string; status_url: string }>(`${this.baseUrl}/admin/exports`, { ressource, format, filtres }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  exportStatus(uuid: string): Observable<AdminExportStatus> {
    return this.http.get<AdminExportStatus>(`${this.baseUrl}/admin/exports/${uuid}`);
  }
}
