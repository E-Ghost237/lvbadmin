import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CancellationReason, ListQuery, Order, OrderListFilters, PagedResult } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { matchesSearch, mockFail, mockOk, paginate, uid } from '../mock/mock-utils';
import { canTransition, isCancellable, quoteCancellation } from '../utils/cancellation';
import { AuthService } from '../auth/auth.service';
import { Driver } from '../models';

/**
 * Mirrors §9.2.2 (`/orders`) and the admin extensions under `/admin/orders`
 * and `/admin/dispatch/assign`. UC-ADM-01 (supervision), UC-TEL-03/04 and the
 * Commandes module all consume this single service.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  list(filters?: OrderListFilters & ListQuery): Observable<PagedResult<Order>> {
    let items = [...this.db.orders()].sort((a, b) => b.cree_le.localeCompare(a.cree_le));

    if (filters?.statut && filters.statut !== 'TOUS') {
      items = filters.statut === 'ACTIVES'
        ? items.filter((o) => ['EN_ATTENTE_AFFECTATION', 'EN_ATTENTE_MANUELLE', 'AFFECTEE', 'EN_ROUTE_RAMASSAGE', 'ARRIVE_RAMASSAGE', 'COLIS_RECUPERE', 'EN_LIVRAISON', 'ARRIVE_LIVRAISON'].includes(o.statut))
        : items.filter((o) => o.statut === filters.statut);
    }
    if (filters?.ville) items = items.filter((o) => o.ville === filters.ville);
    if (filters?.canal) items = items.filter((o) => o.canal === filters.canal);
    if (filters?.livreur_id) items = items.filter((o) => o.livreur_id === filters.livreur_id);
    if (filters?.client_id) items = items.filter((o) => o.client_id === filters.client_id);
    if (filters?.date_debut) items = items.filter((o) => o.cree_le >= filters.date_debut!);
    if (filters?.date_fin) items = items.filter((o) => o.cree_le <= filters.date_fin!);
    if (filters?.search) {
      items = items.filter((o) => matchesSearch([o.numero, o.client_nom, o.client_telephone, o.livreur_nom, o.destinataire_nom], filters.search));
    }

    return mockOk(paginate(items, filters));
  }

  get(id: string): Observable<Order> {
    const order = this.db.orders().find((o) => o.id === id);
    return order ? mockOk(order) : mockFail('ERR-4001', 'Commande introuvable.');
  }

  recentForClient(clientId: string, limit = 10): Observable<Order[]> {
    const items = this.db.orders().filter((o) => o.client_id === clientId).sort((a, b) => b.cree_le.localeCompare(a.cree_le)).slice(0, limit);
    return mockOk(items);
  }

  /** Candidate pool approximating RG-050 eligibility (statut ACTIF+DISPONIBLE, même ville). */
  eligibleDrivers(order: Order): Observable<Driver[]> {
    const candidates = this.db.drivers().filter((d) =>
      d.statut === 'ACTIF'
      && d.statut_operationnel === 'DISPONIBLE'
      && d.zone_predilection === (order.ville === 'Douala' ? 'zone_dla_couv' : 'zone_yde_couv')
      && d.encours_cod + order.montant_cod <= d.plafond_cod,
    ).sort((a, b) => b.note_moyenne - a.note_moyenne);
    return mockOk(candidates);
  }

  assign(orderId: string, driverId: string, motif?: string): Observable<Order> {
    const order = this.db.orders().find((o) => o.id === orderId);
    if (!order) return mockFail('ERR-4001', 'Commande introuvable.');
    if (!canTransition(order.statut, 'AFFECTEE') && order.statut !== 'AFFECTEE') return mockFail('ERR-4220');
    const driver = this.db.drivers().find((d) => d.id === driverId);
    if (!driver || driver.statut !== 'ACTIF') return mockFail('ERR-4093');
    if (driver.encours_cod + order.montant_cod > driver.plafond_cod) return mockFail('ERR-4232');

    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.orders.findIndex((o) => o.id === orderId);
      const wasReassignment = s.orders[idx].statut === 'AFFECTEE';
      s.orders[idx] = {
        ...s.orders[idx], statut: 'AFFECTEE', livreur_id: driverId, livreur_nom: `${driver.prenom} ${driver.nom}`,
        affectee_le: new Date().toISOString(), modifie_le: new Date().toISOString(),
      };
      s.orders[idx].historique = [
        ...s.orders[idx].historique,
        {
          id: uid('h', Math.random), ancien_statut: order.statut, nouveau_statut: 'AFFECTEE', auteur_type: 'AGENT',
          auteur_nom: actor ? `${actor.prenom} ${actor.nom}` : 'Agent', motif: motif || (wasReassignment ? 'Réaffectation manuelle' : 'Affectation manuelle'),
          cree_le: new Date().toISOString(),
        },
      ];
      return s;
    });
    if (actor) {
      this.db.logAudit({
        auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Affectation manuelle',
        ressource: 'commande', ressource_id: orderId, ip: '41.202.11.4', appareil: 'Navigateur web',
        valeur_avant: { livreur_id: order.livreur_id ?? null }, valeur_apres: { livreur_id: driverId, motif },
      });
    }
    return this.get(orderId);
  }

  /** UC-TEL-04 — motif obligatoire, tracé avec l'agent et l'horodatage. */
  reassign(orderId: string, driverId: string, motif: string): Observable<Order> {
    if (!motif || !motif.trim()) return mockFail('ERR-4001', 'Le motif de réaffectation est obligatoire.');
    return this.assign(orderId, driverId, motif);
  }

  quoteCancellation(order: Order) {
    return quoteCancellation(order);
  }

  cancel(orderId: string, reason: CancellationReason, note?: string): Observable<Order> {
    const order = this.db.orders().find((o) => o.id === orderId);
    if (!order) return mockFail('ERR-4001', 'Commande introuvable.');
    if (!isCancellable(order)) return mockFail('ERR-4220', 'Cette commande ne peut plus être annulée — ouvrez une réclamation.');

    const quote = quoteCancellation(order);
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      const idx = s.orders.findIndex((o) => o.id === orderId);
      s.orders[idx] = {
        ...s.orders[idx], statut: 'ANNULEE', annulee_le: new Date().toISOString(), motif_annulation: reason,
        frais_annulation: quote.frais, modifie_le: new Date().toISOString(),
      };
      s.orders[idx].historique = [
        ...s.orders[idx].historique,
        { id: uid('h', Math.random), ancien_statut: order.statut, nouveau_statut: 'ANNULEE', auteur_type: actor ? 'AGENT' : 'CLIENT', auteur_nom: actor ? `${actor.prenom} ${actor.nom}` : 'Agent', motif: note || reason, cree_le: new Date().toISOString() },
      ];
      if (order.livreur_id) {
        const dIdx = s.drivers.findIndex((d) => d.id === order.livreur_id);
        if (dIdx >= 0) s.drivers[dIdx] = { ...s.drivers[dIdx], statut_operationnel: 'DISPONIBLE' };
      }
      return s;
    });
    if (actor) {
      this.db.logAudit({
        auteur_nom: `${actor.prenom} ${actor.nom}`, auteur_role: actor.role, action: 'Annulation par un agent',
        ressource: 'commande', ressource_id: orderId, ip: '41.202.11.4', appareil: 'Navigateur web',
        valeur_avant: { statut: order.statut }, valeur_apres: { statut: 'ANNULEE', motif: reason, frais: quote.frais },
      });
    }
    return this.get(orderId);
  }
}
