import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ArbitrationDossier, Claim, ClaimMessage, StaffRoleCode } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { matchesSearch, mockFail, mockOk, uid } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';

/** Delegated gesture-commercial ceilings per role (UC-TEL-05: "jamais un geste supérieur à son plafond"). */
export const GESTURE_CEILINGS: Record<StaffRoleCode, number> = {
  TELECONSEILLER: 1000,
  SUPERVISEUR: 5000,
  FINANCE: 5000,
  ADMINISTRATEUR: Number.POSITIVE_INFINITY,
};

/** UC-ADM-10 (arbitrage) + UC-TEL-05 (réclamation niveau 1) share the same `reclamations` model. */
@Injectable({ providedIn: 'root' })
export class ClaimsService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  list(filters?: { statut?: string; gravite?: string; categorie?: string; search?: string }): Observable<Claim[]> {
    let items = [...this.db.claims()].sort((a, b) => a.echeance_sla.localeCompare(b.echeance_sla));
    if (filters?.statut && filters.statut !== 'TOUS') items = items.filter((c) => c.statut === filters.statut);
    if (filters?.gravite && filters.gravite !== 'TOUS') items = items.filter((c) => c.gravite === filters.gravite);
    if (filters?.categorie && filters.categorie !== 'TOUS') items = items.filter((c) => c.categorie === filters.categorie);
    if (filters?.search) items = items.filter((c) => matchesSearch([c.numero, c.commande_numero, c.ouverte_par_nom], filters.search));
    return mockOk(items);
  }

  get(id: string): Observable<Claim> {
    const claim = this.db.claims().find((c) => c.id === id);
    return claim ? mockOk(claim) : mockFail('ERR-4001', 'Réclamation introuvable.');
  }

  messages(claimId: string): Observable<ClaimMessage[]> {
    return mockOk(this.db.claimMessages().filter((m) => m.claim_id === claimId).sort((a, b) => a.cree_le.localeCompare(b.cree_le)));
  }

  addMessage(claimId: string, message: string): Observable<ClaimMessage> {
    if (!message.trim()) return mockFail('ERR-4001', 'Le message ne peut pas être vide.');
    const actor = this.auth.currentUser();
    const entry: ClaimMessage = { id: uid('msg', Math.random), claim_id: claimId, auteur: actor ? `${actor.prenom} ${actor.nom}` : 'Agent', auteur_role: actor?.role ?? '', message, cree_le: new Date().toISOString() };
    this.db.mutate((s) => {
      s.claimMessages.push(entry);
      const idx = s.claims.findIndex((c) => c.id === claimId);
      if (idx >= 0 && s.claims[idx].statut === 'OUVERTE') s.claims[idx] = { ...s.claims[idx], statut: 'EN_COURS', assignee_a: entry.auteur };
      return s;
    });
    return mockOk(entry);
  }

  /** "Le dossier d'arbitrage est constitué automatiquement, sans recherche manuelle" (UC-ADM-10). */
  arbitrationDossier(claimId: string): Observable<ArbitrationDossier> {
    const claim = this.db.claims().find((c) => c.id === claimId);
    if (!claim) return mockFail('ERR-4001', 'Réclamation introuvable.');
    const order = this.db.orders().find((o) => o.id === claim.commande_id);
    const driver = order?.livreur_id ? this.db.drivers().find((d) => d.id === order.livreur_id) : undefined;
    const driverClaims = driver ? this.db.claims().filter((c) => {
      const o = this.db.orders().find((ord) => ord.id === c.commande_id);
      return o?.livreur_id === driver.id;
    }).length : 0;

    const timeline = [
      { label: 'Réclamation ouverte', horodatage: claim.cree_le },
      ...(order?.historique.map((h) => ({ label: `Commande → ${h.nouveau_statut}`, horodatage: h.cree_le })) ?? []),
      ...(claim.resolue_le ? [{ label: 'Réclamation résolue', horodatage: claim.resolue_le }] : []),
    ].sort((a, b) => a.horodatage.localeCompare(b.horodatage));

    const dossier: ArbitrationDossier = {
      claim,
      order_snapshot: order ? { numero: order.numero, statut: order.statut, prix_total: order.prix_total, livree_le: order.livree_le, echeance_promise: order.echeance_promise } : { numero: claim.commande_numero, statut: 'INCONNU', prix_total: 0, echeance_promise: '' },
      driver_history: driver ? { livreur_nom: `${driver.prenom} ${driver.nom}`, note_moyenne: driver.note_moyenne, incidents_recents: 0, reclamations_recentes: driverClaims } : null,
      timeline,
    };
    return mockOk(dossier);
  }

  gestureCeilingFor(role: StaffRoleCode): number {
    return GESTURE_CEILINGS[role];
  }

  resolve(claimId: string, resolution: string, gesteCommercial: number, sanctionDriverId?: string): Observable<Claim> {
    if (!resolution.trim()) return mockFail('ERR-4001', 'Une note de résolution est obligatoire.');
    const actor = this.auth.currentUser();
    const ceiling = actor ? GESTURE_CEILINGS[actor.role] : 0;
    if (gesteCommercial > ceiling) {
      return mockFail('ERR-4032', `Ce geste commercial dépasse votre plafond délégué (${ceiling === Infinity ? 'illimité' : ceiling + ' XAF'}). Escaladez le dossier.`);
    }

    this.db.mutate((s) => {
      const idx = s.claims.findIndex((c) => c.id === claimId);
      if (idx >= 0) {
        s.claims[idx] = { ...s.claims[idx], statut: 'RESOLUE', resolue_le: new Date().toISOString(), resolution, geste_commercial: gesteCommercial, sanction_livreur_id: sanctionDriverId };
      }
      return s;
    });
    if (actor) this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Geste commercial', ressource: 'reclamation', ressource_id: claimId, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: { geste_commercial: gesteCommercial, resolution } });
    return this.get(claimId);
  }

  escalate(claimId: string, motif: string): Observable<Claim> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif d’escalade est obligatoire.');
    this.db.mutate((s) => {
      const idx = s.claims.findIndex((c) => c.id === claimId);
      if (idx >= 0) s.claims[idx] = { ...s.claims[idx], statut: 'ESCALADEE' };
      return s;
    });
    this.addMessage(claimId, `Dossier escaladé : ${motif}`);
    return this.get(claimId);
  }

  close(claimId: string): Observable<Claim> {
    this.db.mutate((s) => {
      const idx = s.claims.findIndex((c) => c.id === claimId);
      if (idx >= 0) s.claims[idx] = { ...s.claims[idx], statut: 'FERMEE' };
      return s;
    });
    return this.get(claimId);
  }
}
