import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DriverWallet, ReconciliationDomain, ReconciliationPeriod } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';

/** UC-ADM-08 (réconciliation) + wallets/encours overview feeding the Finance dashboard (§14.4). */
@Injectable({ providedIn: 'root' })
export class FinanceService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  reconciliationPeriods(domain?: ReconciliationDomain): Observable<ReconciliationPeriod[]> {
    let items = [...this.db.reconciliationPeriods()].sort((a, b) => b.periode_fin.localeCompare(a.periode_fin));
    if (domain) items = items.filter((p) => p.domaine === domain);
    return mockOk(items);
  }

  reconciliationPeriod(id: string): Observable<ReconciliationPeriod> {
    const period = this.db.reconciliationPeriods().find((p) => p.id === id);
    return period ? mockOk(period) : mockFail('ERR-4001', 'Période introuvable.');
  }

  qualifyGap(periodId: string, gapId: string, action: 'REMBOURSEMENT' | 'REGULARISATION' | 'ENQUETE'): Observable<ReconciliationPeriod> {
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const pIdx = s.reconciliationPeriods.findIndex((p) => p.id === periodId);
      if (pIdx < 0) return s;
      s.reconciliationPeriods[pIdx] = {
        ...s.reconciliationPeriods[pIdx],
        ecarts: s.reconciliationPeriods[pIdx].ecarts.map((g) => (g.id === gapId
          ? { ...g, qualifie: true, action, qualifie_par: actor ? `${actor.prenom} ${actor.nom}` : undefined, qualifie_le: new Date().toISOString() }
          : g)),
      };
      return s;
    });
    return this.reconciliationPeriod(periodId);
  }

  /** "Une période clôturée NE DOIT PAS pouvoir être modifiée" — closing requires every gap qualified first. */
  closePeriod(id: string): Observable<ReconciliationPeriod> {
    const period = this.db.reconciliationPeriods().find((p) => p.id === id);
    if (!period) return mockFail('ERR-4001', 'Période introuvable.');
    if (period.statut === 'CLOTUREE') return mockFail('ERR-4220', 'Cette période est déjà clôturée.');
    const pending = period.ecarts.filter((g) => !g.qualifie);
    if (pending.length) return mockFail('ERR-4001', `${pending.length} écart(s) doivent être qualifiés avant la clôture.`);

    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.reconciliationPeriods.findIndex((p) => p.id === id);
      s.reconciliationPeriods[idx] = { ...s.reconciliationPeriods[idx], statut: 'CLOTUREE', cloturee_le: new Date().toISOString(), cloturee_par: actor ? `${actor.prenom} ${actor.nom}` : undefined };
      return s;
    });
    return this.reconciliationPeriod(id);
  }

  wallets(): Observable<DriverWallet[]> {
    const movements = this.db.walletMovements();
    const wallets = this.db.drivers().filter((d) => d.statut !== 'DOSSIER_SOUMIS').map<DriverWallet>((d) => {
      const forDriver = movements.filter((m) => m.wallet_id === d.id).sort((a, b) => a.cree_le.localeCompare(b.cree_le));
      return {
        livreur_id: d.id, livreur_nom: `${d.prenom} ${d.nom}`,
        solde_disponible: forDriver.length ? forDriver[forDriver.length - 1].solde_apres : 0,
        encours_cod: d.encours_cod, plafond_cod: d.plafond_cod, mouvements: forDriver,
      };
    });
    return mockOk(wallets);
  }

  walletDetail(driverId: string): Observable<DriverWallet> {
    const driver = this.db.drivers().find((d) => d.id === driverId);
    if (!driver) return mockFail('ERR-4001', 'Livreur introuvable.');
    const forDriver = this.db.walletMovements().filter((m) => m.wallet_id === driverId).sort((a, b) => a.cree_le.localeCompare(b.cree_le));
    return mockOk({
      livreur_id: driverId, livreur_nom: `${driver.prenom} ${driver.nom}`,
      solde_disponible: forDriver.length ? forDriver[forDriver.length - 1].solde_apres : 0,
      encours_cod: driver.encours_cod, plafond_cod: driver.plafond_cod, mouvements: forDriver,
    });
  }

  /** RG-028 — le solde DOIT être recalculable à tout instant à partir du grand livre (KPI-052). */
  walletCoherenceCheck(): Observable<{ ok: boolean; incoherences: string[] }> {
    const movements = this.db.walletMovements();
    const grouped = new Map<string, typeof movements>();
    for (const m of movements) grouped.set(m.wallet_id, [...(grouped.get(m.wallet_id) ?? []), m]);

    const incoherences: string[] = [];
    for (const [walletId, list] of grouped) {
      const sorted = [...list].sort((a, b) => a.cree_le.localeCompare(b.cree_le));
      let running = 0;
      for (const m of sorted) {
        running += m.sens === 'CREDIT' ? m.montant : -m.montant;
        if (running !== m.solde_apres) {
          incoherences.push(walletId);
          break;
        }
      }
    }
    return mockOk({ ok: incoherences.length === 0, incoherences });
  }
}
