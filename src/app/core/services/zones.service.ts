import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Zone } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk, uid } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';

/** UC-ADM-07 — zones de couverture, interdites, à majoration, difficiles. */
@Injectable({ providedIn: 'root' })
export class ZonesService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  list(ville?: string): Observable<Zone[]> {
    let items = [...this.db.zones()].sort((a, b) => a.nom.localeCompare(b.nom));
    if (ville) items = items.filter((z) => z.ville === ville);
    return mockOk(items);
  }

  get(id: string): Observable<Zone> {
    const zone = this.db.zones().find((z) => z.id === id);
    return zone ? mockOk(zone) : mockFail('ERR-4001', 'Zone introuvable.');
  }

  create(payload: Omit<Zone, 'id' | 'cree_le'>): Observable<Zone> {
    const exists = this.db.zones().some((z) => z.nom.toLowerCase() === payload.nom.toLowerCase());
    if (exists) return mockFail('ERR-4001', 'Une zone porte déjà ce nom.');
    const zone: Zone = { ...payload, id: uid('zone', Math.random), cree_le: new Date().toISOString() };
    const actor = this.auth.currentUser();
    this.db.mutate((s) => { s.zones.unshift(zone); return s; });
    if (actor) this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Modification de zone', ressource: 'zone', ressource_id: zone.id, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_apres: payload });
    return mockOk(zone);
  }

  update(id: string, payload: Partial<Zone>): Observable<Zone> {
    const before = this.db.zones().find((z) => z.id === id);
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.zones.findIndex((z) => z.id === id);
      if (idx >= 0) s.zones[idx] = { ...s.zones[idx], ...payload, modifie_le: new Date().toISOString() };
      return s;
    });
    if (actor && before) this.db.logAudit({ auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Modification de zone', ressource: 'zone', ressource_id: id, ip: '41.202.11.4', appareil: 'Navigateur web', valeur_avant: { ...before }, valeur_apres: { ...payload } });
    return this.get(id);
  }

  toggleActive(id: string): Observable<Zone> {
    this.db.mutate((s) => {
      const idx = s.zones.findIndex((z) => z.id === id);
      if (idx >= 0) s.zones[idx] = { ...s.zones[idx], actif: !s.zones[idx].actif };
      return s;
    });
    return this.get(id);
  }
}
