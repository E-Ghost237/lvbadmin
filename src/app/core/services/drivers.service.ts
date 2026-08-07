import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { AdminUserDetail, AdminUserSummary, CursorPage } from '../models';

export type KycDocumentType =
  | 'CNI_RECTO' | 'CNI_VERSO' | 'PERMIS_CONDUIRE' | 'CARTE_GRISE' | 'PHOTO_VEHICULE' | 'PHOTO_PROFIL' | 'ATTESTATION_ASSURANCE';
export type KycDocumentStatus = 'EN_ATTENTE' | 'VALIDE' | 'REJETE';

export interface KycDossierSummary {
  uuid: string;
  nom: string;
  prenom: string | null;
  statut_compte: string;
  matricule: string | null;
}

export interface KycDossier extends KycDossierSummary {
  documents: { type: KycDocumentType; statut: KycDocumentStatus; motif_rejet: string | null; decide_le: string | null }[];
}

export interface DriverQuality {
  user_uuid: string;
  account_status: string;
  score: number;
  components: { rating: number; acceptance: number; on_time: number; incidents: number };
  weights: { rating: number; acceptance: number; on_time: number; incidents: number };
  thresholds: { warning_below: number; temporary_suspension_below: number; deactivation_review_below: number };
  recommendation: string | null;
}

export type SanctionType = 'AVERTISSEMENT' | 'SUSPENSION_TEMPORAIRE' | 'DESACTIVATION';

/**
 * UC-ADM-05/11 — no general "list all drivers with quality/COD" endpoint
 * exists; the list is the generic admin/users search scoped to
 * profil=LIVREUR (thin fields only), quality/sanctions are per-driver
 * lookups. There is also no "list sanctions for a driver" endpoint — a
 * proposed sanction's id only exists in the response of `proposeSanction`,
 * so confirm/cancel only work in the same session it was proposed.
 */
@Injectable({ providedIn: 'root' })
export class DriversService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(opts: { q?: string; statut?: string; cursor?: number; limit?: number }): Observable<CursorPage<AdminUserSummary>> {
    const params: Record<string, string> = { profil: 'LIVREUR' };
    if (opts.q) params['q'] = opts.q;
    if (opts.statut) params['statut'] = opts.statut;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<AdminUserSummary>>(`${this.baseUrl}/admin/users`, { params });
  }

  get(uuid: string): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`${this.baseUrl}/admin/users/${uuid}`);
  }

  suspend(uuid: string, motif: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/users/${uuid}/suspend`, { motif });
  }

  reactivate(uuid: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/users/${uuid}/reactivate`, {});
  }

  quality(uuid: string): Observable<DriverQuality> {
    return this.http.get<DriverQuality>(`${this.baseUrl}/admin/drivers/${uuid}/quality`);
  }

  proposeSanction(uuid: string, type: SanctionType, motif: string): Observable<{ sanction_id: string; statut: string; delai_contradiction_jours: number }> {
    return this.http.post<{ sanction_id: string; statut: string; delai_contradiction_jours: number }>(
      `${this.baseUrl}/admin/drivers/${uuid}/sanctions`, { type, motif },
    );
  }

  confirmSanction(sanctionUuid: string, motifDecision: string, confirmationHumaine: boolean, dureeJours?: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/drivers/sanctions/${sanctionUuid}/confirm`, {
      motif_decision: motifDecision, confirmation_humaine: confirmationHumaine, duree_jours: dureeJours ?? null,
    });
  }

  cancelSanction(sanctionUuid: string, motif: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/drivers/sanctions/${sanctionUuid}/cancel`, { motif });
  }

  // --- KYC ------------------------------------------------------------
  kycQueue(statutDocument?: KycDocumentStatus, cursor?: number): Observable<CursorPage<KycDossierSummary>> {
    const params: Record<string, string> = {};
    if (statutDocument) params['statut_document'] = statutDocument;
    if (cursor) params['cursor'] = String(cursor);
    return this.http.get<CursorPage<KycDossierSummary>>(`${this.baseUrl}/admin/kyc`, { params });
  }

  kycDossier(uuid: string): Observable<KycDossier> {
    return this.http.get<KycDossier>(`${this.baseUrl}/admin/kyc/${uuid}`);
  }

  reviewKycDocument(uuid: string, type: KycDocumentType, accepte: boolean, motif?: string): Observable<{ message: string; all_validated: boolean; any_rejected: boolean }> {
    return this.http.post<{ message: string; all_validated: boolean; any_rejected: boolean }>(
      `${this.baseUrl}/admin/kyc/${uuid}/documents/${type}`, { accepte, motif: motif ?? null },
      { context: withIdempotencyKey(newIdempotencyKey()) },
    );
  }
}
