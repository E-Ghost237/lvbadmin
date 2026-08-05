import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SystemParameter } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';

/** UC-ADM-13 — paramètres opérationnels modifiables sans redéploiement, effectifs en < 60 s, journalisés. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  list(): Observable<SystemParameter[]> {
    return mockOk([...this.db.systemParameters()].sort((a, b) => a.categorie.localeCompare(b.categorie)));
  }

  update(cle: string, valeur: number | boolean | string): Observable<SystemParameter> {
    const param = this.db.systemParameters().find((p) => p.cle === cle);
    if (!param) return mockFail('ERR-4001', 'Paramètre introuvable.');
    if (param.type === 'NOMBRE') {
      const num = Number(valeur);
      if (!Number.isFinite(num)) return mockFail('ERR-4001', 'Valeur numérique invalide.');
      if (param.min !== undefined && num < param.min) return mockFail('ERR-4001', `La valeur minimale est ${param.min}.`);
      if (param.max !== undefined && num > param.max) return mockFail('ERR-4001', `La valeur maximale est ${param.max}.`);
    }
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.systemParameters.findIndex((p) => p.cle === cle);
      s.systemParameters[idx] = { ...s.systemParameters[idx], valeur, modifie_le: new Date().toISOString(), modifie_par: actor ? `${actor.prenom} ${actor.nom}` : 'Système' };
      return s;
    });
    if (actor) {
      this.db.logAudit({
        auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Modification de paramètre système',
        ressource: 'parametre', ressource_id: cle, ip: '41.202.11.4', appareil: 'Navigateur web',
        valeur_avant: { valeur: param.valeur }, valeur_apres: { valeur },
      });
    }
    return mockOk(this.db.systemParameters().find((p) => p.cle === cle)!, 200);
  }
}
