import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PermissionCode, Role, StaffRoleCode } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';
import { ALL_PERMISSIONS } from '../auth/rbac';

/** UC-ADM-03 — rôles paramétrables, permissions granulaires, moindre privilège. */
@Injectable({ providedIn: 'root' })
export class RolesService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  readonly allPermissions: PermissionCode[] = ALL_PERMISSIONS;

  list(): Observable<Role[]> {
    return mockOk(this.db.roles());
  }

  /** ADMINISTRATEUR always keeps every permission — least-privilege editing applies to the other roles. */
  updatePermissions(code: StaffRoleCode, permissions: PermissionCode[]): Observable<Role> {
    if (code === 'ADMINISTRATEUR') return mockFail('ERR-4032', 'Le rôle Administrateur ne peut pas être restreint.');
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.roles.findIndex((r) => r.code === code);
      if (idx >= 0) s.roles[idx] = { ...s.roles[idx], permissions };
      s.staff = s.staff.map((u) => (u.role === code ? { ...u, permissions } : u));
      return s;
    });
    if (actor) {
      this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Modification de rôle', ressource: 'role', ressource_id: code, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: { permissions } });
    }
    const role = this.db.roles().find((r) => r.code === code)!;
    return mockOk(role);
  }
}
