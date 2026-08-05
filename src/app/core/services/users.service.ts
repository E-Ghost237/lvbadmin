import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ClientUser, ListQuery, PagedResult, StaffRoleCode, StaffUser, UserActionLogEntry } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { matchesSearch, mockFail, mockOk, paginate, uid } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';
import { ROLE_PERMISSIONS } from '../auth/rbac';

/** UC-ADM-02 (gestion utilisateurs), UC-ADM-04 (validation partenaire) and internal staff account admin. */
@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  listClients(query?: ListQuery & { statut?: string; type_client?: string }): Observable<PagedResult<ClientUser>> {
    let items = [...this.db.clients()].sort((a, b) => b.cree_le.localeCompare(a.cree_le));
    if (query?.statut && query.statut !== 'TOUS') items = items.filter((c) => c.statut === query.statut);
    if (query?.type_client && query.type_client !== 'TOUS') items = items.filter((c) => c.type_client === query.type_client);
    if (query?.search) items = items.filter((c) => matchesSearch([c.nom, c.prenom, c.telephone, c.email, c.raison_sociale], query.search));
    return mockOk(paginate(items, query));
  }

  getClient(id: string): Observable<ClientUser> {
    const client = this.db.clients().find((c) => c.id === id);
    return client ? mockOk(client) : mockFail('ERR-4001', 'Client introuvable.');
  }

  listStaff(query?: ListQuery & { role?: string }): Observable<PagedResult<StaffUser>> {
    let items = [...this.db.staff()].sort((a, b) => a.nom.localeCompare(b.nom));
    if (query?.role && query.role !== 'TOUS') items = items.filter((s) => s.role === query.role);
    if (query?.search) items = items.filter((s) => matchesSearch([s.nom, s.prenom, s.email], query.search));
    return mockOk(paginate(items, query));
  }

  getStaff(id: string): Observable<StaffUser> {
    const staff = this.db.staff().find((s) => s.id === id);
    return staff ? mockOk(staff) : mockFail('ERR-4001', 'Utilisateur interne introuvable.');
  }

  actionHistory(userId: string): Observable<UserActionLogEntry[]> {
    return mockOk(this.db.snapshot().userActionLog.filter((a) => a.utilisateur_id === userId));
  }

  private logAction(userId: string, action: UserActionLogEntry['action'], motif?: string): void {
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      s.userActionLog.unshift({ id: uid('act', Math.random), utilisateur_id: userId, action, motif, auteur: actor ? `${actor.prenom} ${actor.nom}` : 'Système', cree_le: new Date().toISOString() });
      return s;
    });
  }

  /** Suppression logique uniquement (UC-ADM-02) — motif obligatoire, jamais de suppression physique. */
  suspendClient(id: string, motif: string): Observable<ClientUser> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif de suspension est obligatoire.');
    this.db.mutate((s) => {
      const idx = s.clients.findIndex((c) => c.id === id);
      if (idx >= 0) s.clients[idx] = { ...s.clients[idx], statut: 'SUSPENDU' };
      return s;
    });
    this.logAction(id, 'SUSPENSION', motif);
    return this.getClient(id);
  }

  reactivateClient(id: string): Observable<ClientUser> {
    this.db.mutate((s) => {
      const idx = s.clients.findIndex((c) => c.id === id);
      if (idx >= 0) s.clients[idx] = { ...s.clients[idx], statut: 'ACTIF' };
      return s;
    });
    this.logAction(id, 'REACTIVATION');
    return this.getClient(id);
  }

  suspendStaff(id: string, motif: string): Observable<StaffUser> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif de suspension est obligatoire.');
    this.db.mutate((s) => {
      const idx = s.staff.findIndex((c) => c.id === id);
      if (idx >= 0) s.staff[idx] = { ...s.staff[idx], statut: 'SUSPENDU' };
      return s;
    });
    this.logAction(id, 'SUSPENSION', motif);
    return this.getStaff(id);
  }

  reactivateStaff(id: string): Observable<StaffUser> {
    this.db.mutate((s) => {
      const idx = s.staff.findIndex((c) => c.id === id);
      if (idx >= 0) s.staff[idx] = { ...s.staff[idx], statut: 'ACTIF' };
      return s;
    });
    this.logAction(id, 'REACTIVATION');
    return this.getStaff(id);
  }

  createStaff(payload: { nom: string; prenom: string; email: string; role: StaffRoleCode }): Observable<StaffUser> {
    const exists = this.db.staff().some((s) => s.email?.toLowerCase() === payload.email.toLowerCase());
    if (exists) return mockFail('ERR-4001', 'Un compte existe déjà avec cet email.');
    const user: StaffUser = {
      id: uid('stf', Math.random), uuid: uid('u', Math.random), kind: 'staff', langue: 'fr', statut: 'ACTIF',
      mfa_actif: true, cree_le: new Date().toISOString(), nom: payload.nom, prenom: payload.prenom, email: payload.email,
      role: payload.role, permissions: ROLE_PERMISSIONS[payload.role],
    };
    this.db.mutate((s) => { s.staff.unshift(user); return s; });
    this.logAction(user.id, 'CREATION');
    return mockOk(user);
  }

  updateStaffRole(id: string, role: StaffRoleCode): Observable<StaffUser> {
    this.db.mutate((s) => {
      const idx = s.staff.findIndex((c) => c.id === id);
      if (idx >= 0) s.staff[idx] = { ...s.staff[idx], role, permissions: ROLE_PERMISSIONS[role] };
      return s;
    });
    this.logAction(id, 'MODIFICATION', `Rôle changé pour ${role}`);
    return this.getStaff(id);
  }

  /** UC-ADM-04 — les fonctions partenaires restent inaccessibles tant que la validation n'est pas prononcée. */
  validatePartner(clientId: string, encoursAutorise: number): Observable<ClientUser> {
    this.db.mutate((s) => {
      const idx = s.clients.findIndex((c) => c.id === clientId);
      if (idx >= 0) s.clients[idx] = { ...s.clients[idx], partenaire_verifie: true, encours_autorise: encoursAutorise };
      return s;
    });
    this.logAction(clientId, 'MODIFICATION', `Compte partenaire validé — encours autorisé ${encoursAutorise} XAF`);
    return this.getClient(clientId);
  }

  rejectPartner(clientId: string, motif: string): Observable<ClientUser> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif de rejet est obligatoire.');
    this.logAction(clientId, 'MODIFICATION', `Compte partenaire rejeté : ${motif}`);
    return this.getClient(clientId);
  }
}
