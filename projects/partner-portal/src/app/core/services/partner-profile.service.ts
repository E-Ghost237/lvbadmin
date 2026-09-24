import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import { UuidCursorPage } from '@lvb/models/common.model';
import {
  Partner, PartnerChangeRequest, PartnerDocument, PartnerDocumentDownload, PartnerInvitation, PartnerMember,
} from '@lvb/models/partner.model';
import { PartnerDocumentType, PartnerRole } from '@lvb/models/enums';
import { InvitePartnerUserRequest, RequestPartnerProfileChangeRequest, UpdatePartnerProfileRequest } from '../models';

/**
 * Partner self-service side of the Partner module (LVB-CDC-PART-2026-V1.0)
 * — `/v1/partner/{profile,documents,users}*`. `show()`/`documents.page()`/
 * `users.list()` on the backend are the exact same code paths the admin
 * partner-detail screen reads (`ManagePartnerProfile::show()`,
 * `GetPartnerDocumentsUseCase::handle()`/`forAdmin()`,
 * `ManagePartnerUsersUseCase::list()`/`listAsAdmin()`) — confirmed by
 * reading the backend directly, so this service reuses the admin app's
 * `Partner`/`PartnerDocument`/`PartnerMember`/`PartnerInvitation`/
 * `PartnerChangeRequest` model shapes verbatim via the `@lvb/models` alias
 * rather than redefining them.
 */
@Injectable({ providedIn: 'root' })
export class PartnerProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getProfile(): Observable<Partner> {
    return this.http.get<Partner>(`${this.baseUrl}/partner/profile`);
  }

  /** Direct (non-sensitive) fields — RGPRT005ProfileChanges::DIRECT, applied immediately. */
  updateProfile(patch: UpdatePartnerProfileRequest): Observable<Partner> {
    return this.http.patch<Partner>(`${this.baseUrl}/partner/profile`, patch);
  }

  /** Sensitive fields — RGPRT005ProfileChanges::SENSITIVE, queued for admin approval. */
  requestProfileChange(patch: RequestPartnerProfileChangeRequest): Observable<{ uuid: string; statut: 'EN_ATTENTE' }> {
    return this.http.post<{ uuid: string; statut: 'EN_ATTENTE' }>(`${this.baseUrl}/partner/profile/change-requests`, patch, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  listChangeRequests(): Observable<{ items: PartnerChangeRequest[] }> {
    return this.http.get<{ items: PartnerChangeRequest[] }>(`${this.baseUrl}/partner/profile/change-requests`);
  }

  listDocuments(opts: { cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<PartnerDocument>> {
    const params: Record<string, string> = {};
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<PartnerDocument>>(`${this.baseUrl}/partner/documents`, { params });
  }

  /** Multipart field name is `fichier`, not `file` — matches the backend's `UploadPartnerDocumentRequest`. */
  uploadDocument(type: PartnerDocumentType, file: File, expiresOn?: string): Observable<PartnerDocument> {
    const body = new FormData();
    body.append('type_document', type);
    body.append('fichier', file);
    if (expiresOn) body.append('expire_le', expiresOn);
    return this.http.post<PartnerDocument>(`${this.baseUrl}/partner/documents`, body, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  downloadDocument(uuid: string): Observable<PartnerDocumentDownload> {
    return this.http.get<PartnerDocumentDownload>(`${this.baseUrl}/partner/documents/${uuid}/download`);
  }

  listMembers(): Observable<{ items: PartnerMember[] }> {
    return this.http.get<{ items: PartnerMember[] }>(`${this.baseUrl}/partner/users`);
  }

  /** Exactly one of `email`/`telephone` — enforced server-side. */
  inviteMember(invite: InvitePartnerUserRequest): Observable<PartnerInvitation> {
    return this.http.post<PartnerInvitation>(`${this.baseUrl}/partner/users/invitations`, invite, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  /**
   * Invitee side: the signed-in *client* account (verified contact matching the
   * invitation) presents the 64-hex token sent by email/SMS to join the partner.
   */
  acceptInvitation(token: string): Observable<{ uuid: string; partenaire_uuid: string; role: PartnerRole }> {
    return this.http.post<{ uuid: string; partenaire_uuid: string; role: PartnerRole }>(
      `${this.baseUrl}/partner/users/invitations/accept`, { token: token.trim().toLowerCase(), accepte: true },
      { context: withIdempotencyKey(newIdempotencyKey()) },
    );
  }

  changeMemberRole(uuid: string, role: PartnerRole): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/partner/users/${uuid}/role`, { role }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  revokeMember(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/partner/users/${uuid}`, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
