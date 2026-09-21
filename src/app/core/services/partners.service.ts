import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import {
  AdminUpdatePartnerRequest, CreatePartnerRequest, CursorPage, Partner, PartnerAuditEntry, PartnerCategory,
  PartnerChangeRequest, PartnerDocument, PartnerDocumentDownload, PartnerInvitation, PartnerMember, PartnerRole,
  PartnerStatus, UuidCursorPage,
} from '../models';

/**
 * Admin side of the Partner module (LVB-CDC-PART-2026-V1.0) — `/v1/admin/partners*`
 * and `/v1/admin/partner-categories`. The partner-facing `/v1/partner/*` routes
 * (self-service profile, documents, team, orders, dashboard, finance) belong to
 * the Flutter partner app, not this admin panel, and are out of scope here.
 *
 * Idempotency-Key is attached only where the backend route actually carries
 * the `idempotent` middleware (verified against `routes.php`) — notably
 * `validate` and the plain profile `update` do NOT require one, unlike
 * `store`/`status`/document review/change-request decisions/team writes.
 */
@Injectable({ providedIn: 'root' })
export class PartnersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(opts: { statut?: PartnerStatus; cursor?: number; limit?: number } = {}): Observable<CursorPage<Partner>> {
    const params: Record<string, string> = {};
    if (opts.statut) params['statut'] = opts.statut;
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<Partner>>(`${this.baseUrl}/admin/partners`, { params });
  }

  get(uuid: string): Observable<Partner> {
    return this.http.get<Partner>(`${this.baseUrl}/admin/partners/${uuid}`);
  }

  /** UC-ADM-PRT-01 step 1 — creates at EN_ATTENTE_VALIDATION; use `validate()` next. */
  create(req: CreatePartnerRequest): Observable<Partner> {
    return this.http.post<Partner>(`${this.baseUrl}/admin/partners`, req, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  /** Direct (non-sensitive) fields only — RG-PRT-005; sensitive fields go through change-requests. */
  update(uuid: string, req: AdminUpdatePartnerRequest): Observable<Partner> {
    return this.http.patch<Partner>(`${this.baseUrl}/admin/partners/${uuid}`, req);
  }

  /** UC-ADM-PRT-01 step 2 — the only path to VALIDE; `changeStatus()` rejects it (ERR-4038). */
  validate(uuid: string, encoursAutoriseXaf?: number): Observable<{ message: string }> {
    const body = encoursAutoriseXaf === undefined ? {} : { encours_autorise_xaf: encoursAutoriseXaf };
    return this.http.post<{ message: string }>(`${this.baseUrl}/admin/partners/${uuid}/validate`, body);
  }

  /** RG-PRT-003 transitions other than validation; `motif` is required by the backend. */
  changeStatus(uuid: string, statut: PartnerStatus, motif: string): Observable<Partner> {
    return this.http.post<Partner>(`${this.baseUrl}/admin/partners/${uuid}/status`, { statut, motif }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  audit(uuid: string, opts: { cursor?: number; limit?: number } = {}): Observable<CursorPage<PartnerAuditEntry>> {
    const params: Record<string, string> = {};
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<CursorPage<PartnerAuditEntry>>(`${this.baseUrl}/admin/partners/${uuid}/audit`, { params });
  }

  // --- Sensitive-field change requests (RG-PRT-005) -----------------------

  listChangeRequests(uuid: string): Observable<{ items: PartnerChangeRequest[] }> {
    return this.http.get<{ items: PartnerChangeRequest[] }>(`${this.baseUrl}/admin/partners/${uuid}/change-requests`);
  }

  decideChangeRequest(uuid: string, changeUuid: string, accepte: boolean, motif: string): Observable<{ statut: 'APPROUVEE' | 'REJETEE' }> {
    return this.http.post<{ statut: 'APPROUVEE' | 'REJETEE' }>(
      `${this.baseUrl}/admin/partners/${uuid}/change-requests/${changeUuid}/decision`,
      { accepte, motif },
      { context: withIdempotencyKey(newIdempotencyKey()) },
    );
  }

  // --- Documents ------------------------------------------------------

  listDocuments(uuid: string, opts: { cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<PartnerDocument>> {
    const params: Record<string, string> = {};
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<PartnerDocument>>(`${this.baseUrl}/admin/partners/${uuid}/documents`, { params });
  }

  downloadDocumentUrl(uuid: string, documentUuid: string): Observable<PartnerDocumentDownload> {
    return this.http.get<PartnerDocumentDownload>(`${this.baseUrl}/admin/partners/${uuid}/documents/${documentUuid}/download`);
  }

  /** `motif` is required by the backend when `accepte` is false. */
  reviewDocument(uuid: string, documentUuid: string, accepte: boolean, motif?: string): Observable<PartnerDocument> {
    return this.http.patch<PartnerDocument>(`${this.baseUrl}/admin/partners/${uuid}/documents/${documentUuid}`, { accepte, motif }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  // --- Team / members ---------------------------------------------------

  listMembers(uuid: string): Observable<{ items: PartnerMember[] }> {
    return this.http.get<{ items: PartnerMember[] }>(`${this.baseUrl}/admin/partners/${uuid}/users`);
  }

  /** Exactly one of `email`/`telephone` must be set — enforced server-side. */
  inviteMember(uuid: string, invite: { email?: string; telephone?: string; role: PartnerRole }): Observable<PartnerInvitation> {
    return this.http.post<PartnerInvitation>(`${this.baseUrl}/admin/partners/${uuid}/users/invitations`, invite, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  changeMemberRole(uuid: string, membershipUuid: string, role: PartnerRole): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/admin/partners/${uuid}/users/${membershipUuid}/role`, { role }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  revokeMember(uuid: string, membershipUuid: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/partners/${uuid}/users/${membershipUuid}`, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  // --- Categories (referenced by create/update forms) ---------------------

  listCategories(): Observable<{ items: PartnerCategory[] }> {
    return this.http.get<{ items: PartnerCategory[] }>(`${this.baseUrl}/admin/partner-categories`);
  }

  createCategory(nom: string, actif = true): Observable<PartnerCategory> {
    return this.http.post<PartnerCategory>(`${this.baseUrl}/admin/partner-categories`, { nom, actif }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  updateCategory(uuid: string, nom: string, actif: boolean): Observable<PartnerCategory> {
    return this.http.patch<PartnerCategory>(`${this.baseUrl}/admin/partner-categories/${uuid}`, { nom, actif });
  }
}
