import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PricingGrid, PricingSimulationInput, PricingSimulationResult } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk, uid } from '../mock/mock-utils';
import { computeQuote } from '../utils/pricing-engine';
import { AuthService } from '../auth/auth.service';

/** UC-ADM-06 — grilles versionnées et datées ; aucune modification d'une grille active. */
@Injectable({ providedIn: 'root' })
export class PricingService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  listGrids(ville?: string): Observable<PricingGrid[]> {
    let items = [...this.db.pricingGrids()].sort((a, b) => b.cree_le.localeCompare(a.cree_le));
    if (ville) items = items.filter((g) => g.ville === ville);
    return mockOk(items);
  }

  getGrid(id: string): Observable<PricingGrid> {
    const grid = this.db.pricingGrids().find((g) => g.id === id);
    return grid ? mockOk(grid) : mockFail('ERR-4001', 'Grille introuvable.');
  }

  simulate(grid: PricingGrid, input: PricingSimulationInput): Observable<PricingSimulationResult> {
    return mockOk(computeQuote(grid, input), 350);
  }

  createDraft(payload: Omit<PricingGrid, 'id' | 'statut' | 'cree_le'>): Observable<PricingGrid> {
    const versionExists = this.db.pricingGrids().some((g) => g.version_label.toLowerCase() === payload.version_label.toLowerCase());
    if (versionExists) return mockFail('ERR-4001', 'Ce libellé de version existe déjà.');
    const grid: PricingGrid = { ...payload, id: uid('grid', Math.random), statut: 'BROUILLON', cree_le: new Date().toISOString() };
    this.db.mutate((s) => { s.pricingGrids.unshift(grid); return s; });
    return mockOk(grid);
  }

  updateDraft(id: string, payload: Partial<PricingGrid>): Observable<PricingGrid> {
    const grid = this.db.pricingGrids().find((g) => g.id === id);
    if (!grid) return mockFail('ERR-4001', 'Grille introuvable.');
    if (grid.statut === 'ACTIVE') return mockFail('ERR-4220', 'Une grille active ne peut pas être modifiée — créez une nouvelle version.');
    this.db.mutate((s) => {
      const idx = s.pricingGrids.findIndex((g) => g.id === id);
      s.pricingGrids[idx] = { ...s.pricingGrids[idx], ...payload, modifie_le: new Date().toISOString() };
      return s;
    });
    return this.getGrid(id);
  }

  /** Activating archives the previously active grid for the same city — history is preserved (RG-012 non-régression). */
  activate(id: string): Observable<PricingGrid> {
    const grid = this.db.pricingGrids().find((g) => g.id === id);
    if (!grid) return mockFail('ERR-4001', 'Grille introuvable.');
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      s.pricingGrids = s.pricingGrids.map((g) => {
        if (g.id === id) return { ...g, statut: 'ACTIVE', active_le: new Date().toISOString() };
        if (g.ville === grid.ville && g.statut === 'ACTIVE') return { ...g, statut: 'ARCHIVEE', archivee_le: new Date().toISOString() };
        return g;
      });
      return s;
    });
    if (actor) {
      this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Modification de tarif', ressource: 'grille_tarifaire', ressource_id: id, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: { statut: 'ACTIVE', version: grid.version_label } });
    }
    return this.getGrid(id);
  }
}
