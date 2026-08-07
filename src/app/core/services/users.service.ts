import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { AdminUserDetail, AdminUserSummary, CursorPage, UserProfile } from '../models';

/** UC-ADM-02/04 — /v1/admin/users, /v1/admin/partners (Identity module). */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(opts: { profil: UserProfile; q?: string; statut?: string; cursor?: number; limit?: number }): Observable<CursorPage<AdminUserSummary>> {
    const params: Record<string, string> = { profil: opts.profil };
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

  delete(uuid: string, motif: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/users/${uuid}`, { body: { motif } });
  }

  validatePartner(uuid: string, encoursAutoriseXaf: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/admin/partners/${uuid}/validate`, { encours_autorise_xaf: encoursAutoriseXaf }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
