import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';

export interface ArbitrationComplaint {
  id: number;
  uuid: string;
  category: string;
  status: string;
  description: string;
  client_id: number;
  opened_at: string;
}

export interface ArbitrationOrder {
  id: number;
  uuid: string;
  client_id: number;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  price_xaf: number;
  payment_method: string;
  created_at: string | null;
  delivered_at: string | null;
  promised_at: string;
}

export interface ArbitrationHistoryEntry {
  from: string | null;
  to: string;
  actor_user_id: number | null;
  at: string;
  reason: string | null;
}

export interface ArbitrationAttachment {
  name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  temporary_url: string;
}

export interface ArbitrationCall {
  call_id: string;
  mode: string;
  provider_reference: string | null;
  initiated_at: string;
}

export interface ArbitrationSanction {
  uuid: string;
  type: string;
  status: string;
  score: number | null;
  reason: string;
  proposed_at: string;
  contradiction: string | null;
  decision_reason: string | null;
  confirmed_at: string | null;
}

export interface ArbitrationDossier {
  complaint: ArbitrationComplaint;
  order: ArbitrationOrder;
  order_history: ArbitrationHistoryEntry[];
  assignment: Record<string, unknown> | null;
  pod: Record<string, unknown> | null;
  incidents: unknown[];
  trajectory: { positions: unknown[]; truncated: boolean };
  exchanges: {
    complaint_statement: string | null;
    attachments: ArbitrationAttachment[];
    masked_calls: ArbitrationCall[];
  };
  driver: {
    profile: Record<string, unknown>;
    quality: Record<string, unknown> | null;
    sanctions: ArbitrationSanction[];
  } | null;
  arbitration: Record<string, unknown> | null;
  assembled_at: string;
}

export type ArbitrationDecision = 'CLIENT_RESPONSABLE' | 'LIVREUR_RESPONSABLE' | 'PARTAGEE' | 'AUCUNE_FAUTE';

/**
 * UC-ADM-10 — /v1/admin/disputes/{uuid} (Support module). No list endpoint
 * exists — a dossier can only be opened by its complaint UUID, known from
 * wherever it was created/escalated (e.g. the téléconseiller console).
 */
@Injectable({ providedIn: 'root' })
export class ClaimsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  dossier(complaintUuid: string): Observable<ArbitrationDossier> {
    return this.http.get<ArbitrationDossier>(`${this.baseUrl}/admin/disputes/${complaintUuid}`);
  }

  decide(complaintUuid: string, decision: ArbitrationDecision, motifDecision: string, gesteCommercialXaf = 0, sanctionUuid?: string | null): Observable<{ arbitrage_id: string; statut: string }> {
    return this.http.post<{ arbitrage_id: string; statut: string }>(`${this.baseUrl}/admin/disputes/${complaintUuid}/decision`, {
      decision, motif_decision: motifDecision, geste_commercial_xaf: gesteCommercialXaf, sanction_uuid: sanctionUuid ?? null,
    }, { context: withIdempotencyKey(newIdempotencyKey()) });
  }
}
