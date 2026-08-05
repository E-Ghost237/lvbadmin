import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { WithdrawalRequest, WithdrawalStatus } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk, uid } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';

/** UC-ADM-09 — "Un retrait n'est jamais versé si l'encours COD du livreur est supérieur à son solde disponible." */
@Injectable({ providedIn: 'root' })
export class WithdrawalsService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  list(statut?: WithdrawalStatus | 'TOUS'): Observable<WithdrawalRequest[]> {
    let items = [...this.db.withdrawals()].sort((a, b) => b.cree_le.localeCompare(a.cree_le));
    if (statut && statut !== 'TOUS') items = items.filter((w) => w.statut === statut);
    return mockOk(items);
  }

  get(id: string): Observable<WithdrawalRequest> {
    const w = this.db.withdrawals().find((x) => x.id === id);
    return w ? mockOk(w) : mockFail('ERR-4001', 'Demande introuvable.');
  }

  approve(id: string): Observable<WithdrawalRequest> {
    const request = this.db.withdrawals().find((w) => w.id === id);
    if (!request) return mockFail('ERR-4001', 'Demande introuvable.');
    if (request.statut !== 'EN_ATTENTE') return mockOk(request); // idempotent replay of an already-processed action
    if (request.encours_cod_au_moment > request.solde_disponible_au_moment) return mockFail('ERR-4222');

    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.withdrawals.findIndex((w) => w.id === id);
      s.withdrawals[idx] = { ...s.withdrawals[idx], statut: 'VALIDE', modifie_le: new Date().toISOString() };
      return s;
    });
    if (actor) this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Validation de retrait', ressource: 'retrait', ressource_id: id, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: { statut: 'VALIDE' } });
    return this.get(id);
  }

  /** Simulates the Disbursement confirmation (MOMO-05) — idempotent double-versement protection. */
  markPaid(id: string): Observable<WithdrawalRequest> {
    const request = this.db.withdrawals().find((w) => w.id === id);
    if (!request) return mockFail('ERR-4001', 'Demande introuvable.');
    if (request.statut === 'VERSE') return mockOk(request);
    if (request.statut !== 'VALIDE') return mockFail('ERR-4220', 'Le retrait doit d’abord être validé.');

    this.db.mutate((s) => {
      const idx = s.withdrawals.findIndex((w) => w.id === id);
      s.withdrawals[idx] = { ...s.withdrawals[idx], statut: 'VERSE', modifie_le: new Date().toISOString() };
      const driverMovements = s.walletMovements.filter((m) => m.wallet_id === request.livreur_id);
      const running = driverMovements.length ? driverMovements[driverMovements.length - 1].solde_apres : 0;
      s.walletMovements.push({
        id: uid('mv', Math.random), wallet_id: request.livreur_id, sens: 'DEBIT', montant: request.montant,
        motif: 'RETRAIT', solde_apres: running - request.montant, reference: uid('ref', Math.random), cree_le: new Date().toISOString(),
      });
      return s;
    });
    return this.get(id);
  }

  reject(id: string, motif: string): Observable<WithdrawalRequest> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif de rejet est obligatoire.');
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.withdrawals.findIndex((w) => w.id === id);
      if (idx >= 0) s.withdrawals[idx] = { ...s.withdrawals[idx], statut: 'REJETE', motif_rejet: motif, modifie_le: new Date().toISOString() };
      return s;
    });
    if (actor) this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Retrait rejeté', ressource: 'retrait', ressource_id: id, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: { statut: 'REJETE', motif } });
    return this.get(id);
  }
}
