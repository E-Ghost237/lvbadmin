import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { RbacCatalog } from '../models';

/** UC-ADM-03 — /v1/admin/rbac (Identity module, Spatie permission backed). */
@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  catalog(): Observable<RbacCatalog> {
    return this.http.get<RbacCatalog>(`${this.baseUrl}/admin/rbac`);
  }

  createRole(name: string, permissions: string[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/admin/rbac/roles`, { name, permissions }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  updateRole(role: string, permissions: string[]): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/admin/rbac/roles/${role}`, { permissions });
  }

  deleteRole(role: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/rbac/roles/${role}`);
  }

  assignUserRoles(uuid: string, roles: string[]): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/admin/rbac/users/${uuid}/roles`, { roles });
  }
}
