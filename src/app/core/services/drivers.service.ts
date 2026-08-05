import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Driver, DriverDocumentExpiry, DriverKycDossier, DriverSanction, KycPieceStatus, KycPieceType,
  ListQuery, PagedResult, SanctionType,
} from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { matchesSearch, mockFail, mockOk, paginate, uid } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';

/** §5.7 UC-ADM-05 (KYC), UC-ADM-11 (qualité/sanctions) and driver directory reads for every other module. */
@Injectable({ providedIn: 'root' })
export class DriversService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  list(query?: ListQuery & { statut?: string; ville?: string }): Observable<PagedResult<Driver>> {
    let items = [...this.db.drivers()].sort((a, b) => a.nom.localeCompare(b.nom));
    if (query?.statut && query.statut !== 'TOUS') items = items.filter((d) => d.statut === query.statut);
    if (query?.ville) items = items.filter((d) => d.zone_predilection === (query.ville === 'Douala' ? 'zone_dla_couv' : 'zone_yde_couv'));
    if (query?.search) items = items.filter((d) => matchesSearch([d.nom, d.prenom, d.telephone, d.matricule, d.vehicule?.immatriculation], query.search));
    return mockOk(paginate(items, query));
  }

  get(id: string): Observable<Driver> {
    const driver = this.db.drivers().find((d) => d.id === id);
    return driver ? mockOk(driver) : mockFail('ERR-4001', 'Livreur introuvable.');
  }

  kycQueue(): Observable<DriverKycDossier[]> {
    return mockOk(this.db.kycDossiers().filter((k) => k.statut === 'DOSSIER_SOUMIS'));
  }

  kycDossier(id: string): Observable<DriverKycDossier> {
    const dossier = this.db.kycDossiers().find((k) => k.id === id);
    return dossier ? mockOk(dossier) : mockFail('ERR-4001', 'Dossier introuvable.');
  }

  /** UC-ADM-05 — validation ou rejet motivé pièce par pièce. */
  decidePiece(dossierId: string, pieceType: KycPieceType, decision: KycPieceStatus, motif?: string): Observable<DriverKycDossier> {
    if (decision === 'REJETEE' && !motif?.trim()) return mockFail('ERR-4001', 'Un motif de rejet est obligatoire.');
    this.db.mutate((s) => {
      const idx = s.kycDossiers.findIndex((k) => k.id === dossierId);
      if (idx < 0) return s;
      s.kycDossiers[idx] = {
        ...s.kycDossiers[idx],
        pieces: s.kycDossiers[idx].pieces.map((p) => (p.type === pieceType ? { ...p, statut: decision, motif_rejet: decision === 'REJETEE' ? motif : undefined } : p)),
      };
      return s;
    });
    return this.kycDossier(dossierId);
  }

  /** Requires every piece VALIDEE — mirrors the KYC "chaque pièce" workflow of UC-AUT-03/UC-ADM-05. */
  approveDossier(dossierId: string): Observable<Driver> {
    const dossier = this.db.kycDossiers().find((k) => k.id === dossierId);
    if (!dossier) return mockFail('ERR-4001', 'Dossier introuvable.');
    const allValidated = dossier.pieces.every((p) => p.statut === 'VALIDEE');
    if (!allValidated) return mockFail('ERR-4001', 'Toutes les pièces doivent être validées avant l’activation du dossier.');

    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const dIdx = s.kycDossiers.findIndex((k) => k.id === dossierId);
      s.kycDossiers[dIdx] = { ...s.kycDossiers[dIdx], statut: 'ACTIF', decide_le: new Date().toISOString(), decide_par: actor ? `${actor.prenom} ${actor.nom}` : undefined };
      const drvIdx = s.drivers.findIndex((d) => d.id === dossier.livreur_id);
      if (drvIdx >= 0) s.drivers[drvIdx] = { ...s.drivers[drvIdx], statut: 'ACTIF' };
      return s;
    });
    if (actor) {
      this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Validation de dossier livreur', ressource: 'dossier_livreur', ressource_id: dossierId, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: { statut: 'ACTIF' } });
    }
    return this.get(dossier.livreur_id);
  }

  rejectDossier(dossierId: string, motifGlobal: string): Observable<DriverKycDossier> {
    if (!motifGlobal.trim()) return mockFail('ERR-4001', 'Un motif de rejet est obligatoire.');
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.kycDossiers.findIndex((k) => k.id === dossierId);
      if (idx >= 0) {
        s.kycDossiers[idx] = { ...s.kycDossiers[idx], statut: 'REJETE', motif_rejet_global: motifGlobal, decide_le: new Date().toISOString(), decide_par: actor ? `${actor.prenom} ${actor.nom}` : undefined };
      }
      return s;
    });
    return this.kycDossier(dossierId);
  }

  documentsExpiring(withinDays = 30): Observable<DriverDocumentExpiry[]> {
    const now = Date.now();
    const out: DriverDocumentExpiry[] = [];
    for (const d of this.db.drivers().filter((dr) => dr.statut === 'ACTIF' || dr.statut === 'SUSPENDU_DOCUMENT')) {
      for (const [piece, date] of [['PERMIS', d.permis_expire_le], ['ASSURANCE', d.assurance_expire_le]] as const) {
        const days = Math.round((new Date(date).getTime() - now) / 86_400_000);
        if (days <= withinDays) out.push({ livreur_id: d.id, livreur_nom: `${d.prenom} ${d.nom}`, piece, expire_le: date, jours_restants: days });
      }
    }
    return mockOk(out.sort((a, b) => a.jours_restants - b.jours_restants));
  }

  qualityRanking(): Observable<Driver[]> {
    return mockOk([...this.db.drivers()].filter((d) => d.statut === 'ACTIF').sort((a, b) => a.score_qualite - b.score_qualite));
  }

  sanctionsFor(driverId: string): Observable<DriverSanction[]> {
    return mockOk(this.db.sanctions().filter((s) => s.livreur_id === driverId));
  }

  allSanctions(): Observable<DriverSanction[]> {
    return mockOk(this.db.sanctions());
  }

  /** UC-ADM-11 — sanctions graduées avec procédure contradictoire, jamais automatiques. */
  proposeSanction(driverId: string, type: SanctionType, motif: string, dureeJours?: number): Observable<DriverSanction> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif est obligatoire.');
    const actor = this.auth.currentUser();
    const sanction: DriverSanction = {
      id: uid('sanc', Math.random), livreur_id: driverId, type, motif, duree_jours: dureeJours,
      decide_par: actor ? `${actor.prenom} ${actor.nom}` : 'Agent', cree_le: new Date().toISOString(), statut: 'PROPOSEE',
    };
    this.db.mutate((s) => { s.sanctions.unshift(sanction); return s; });
    return mockOk(sanction);
  }

  /** Human validation required before any suspension/deactivation takes effect. */
  confirmSanction(sanctionId: string): Observable<DriverSanction> {
    const sanction = this.db.sanctions().find((s) => s.id === sanctionId);
    if (!sanction) return mockFail('ERR-4001', 'Sanction introuvable.');
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.sanctions.findIndex((x) => x.id === sanctionId);
      s.sanctions[idx] = { ...s.sanctions[idx], statut: 'CONFIRMEE' };
      if (sanction.type !== 'AVERTISSEMENT') {
        const dIdx = s.drivers.findIndex((d) => d.id === sanction.livreur_id);
        if (dIdx >= 0) s.drivers[dIdx] = { ...s.drivers[dIdx], statut: 'SUSPENDU', statut_operationnel: 'HORS_LIGNE' };
      }
      return s;
    });
    if (actor) {
      this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Sanction confirmée', ressource: 'livreur', ressource_id: sanction.livreur_id, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: { sanction: sanction.type } });
    }
    return mockOk({ ...sanction, statut: 'CONFIRMEE' as const });
  }

  cancelSanction(sanctionId: string): Observable<DriverSanction> {
    this.db.mutate((s) => {
      const idx = s.sanctions.findIndex((x) => x.id === sanctionId);
      if (idx >= 0) s.sanctions[idx] = { ...s.sanctions[idx], statut: 'ANNULEE' };
      return s;
    });
    const sanction = this.db.sanctions().find((s) => s.id === sanctionId)!;
    return mockOk(sanction);
  }

  suspend(driverId: string, motif: string): Observable<Driver> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif de suspension est obligatoire.');
    this.db.mutate((s) => {
      const idx = s.drivers.findIndex((d) => d.id === driverId);
      if (idx >= 0) s.drivers[idx] = { ...s.drivers[idx], statut: 'SUSPENDU', statut_operationnel: 'HORS_LIGNE' };
      return s;
    });
    return this.get(driverId);
  }

  reactivate(driverId: string): Observable<Driver> {
    this.db.mutate((s) => {
      const idx = s.drivers.findIndex((d) => d.id === driverId);
      if (idx >= 0) s.drivers[idx] = { ...s.drivers[idx], statut: 'ACTIF' };
      return s;
    });
    return this.get(driverId);
  }
}
