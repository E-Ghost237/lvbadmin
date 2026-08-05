import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Address, AgentActivitySnapshot, Callback, ClientSearchResult, ClientUser, Order, OrderChannel,
  ParcelType, PaymentMethod, PricingSimulationResult, UrgencyLevel,
} from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { matchesSearch, mockFail, mockOk, uid } from '../mock/mock-utils';
import { computeQuote } from '../utils/pricing-engine';
import { AuthService } from '../auth/auth.service';

export interface TeleconseillerOrderPayload {
  client_id?: string;
  nouveau_client?: { nom: string; prenom: string; telephone: string };
  adresse_depart: Address;
  adresse_arrivee: Address;
  destinataire_nom: string;
  destinataire_telephone: string;
  colis_type: ParcelType;
  poids_kg: number;
  fragile: boolean;
  valeur_declaree?: number;
  urgence: UrgencyLevel;
  mode_paiement: PaymentMethod;
  distance_km: number;
  duree_min: number;
}

/**
 * UC-TEL-01→07 — console téléconseiller. Reuses the same `commandes` /
 * `reclamations` domain objects as the back-office (a call-center agent and
 * a supervisor are looking at the same order, just through different UIs).
 */
@Injectable({ providedIn: 'root' })
export class TeleconseillerService {
  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  /** UC-TEL-02 — recherche par numéro, nom, numéro de commande. */
  searchClient(query: string): Observable<ClientSearchResult[]> {
    if (!query.trim()) return mockOk([], 120);
    const results = this.db.clients()
      .filter((c) => matchesSearch([c.nom, c.prenom, c.telephone, c.raison_sociale], query))
      .slice(0, 8)
      .map<ClientSearchResult>((c) => ({
        client_id: c.id, nom: `${c.prenom} ${c.nom}`, telephone: c.telephone!, type_client: c.type_client,
        nb_commandes: c.nb_commandes, derniere_commande_le: this.db.orders().filter((o) => o.client_id === c.id).sort((a, b) => b.cree_le.localeCompare(a.cree_le))[0]?.cree_le,
        connu: true,
      }));
    return mockOk(results, 220);
  }

  /** UC-TEL-01 A1 — "création de compte à la volée si inconnu". */
  quickCreateClient(payload: { nom: string; prenom: string; telephone: string }): Observable<ClientUser> {
    const exists = this.db.clients().some((c) => c.telephone === payload.telephone);
    if (exists) return mockFail('ERR-4001', 'Un compte existe déjà avec ce numéro.');
    const client: ClientUser = {
      id: uid('cli', Math.random), uuid: uid('u', Math.random), kind: 'client', nom: payload.nom, prenom: payload.prenom,
      telephone: payload.telephone, langue: 'fr', statut: 'ACTIF', mfa_actif: false, type_client: 'PARTICULIER',
      partenaire_verifie: true, encours_autorise: 0, solde_avoirs: 0, nb_commandes: 0, cree_le: new Date().toISOString(),
    };
    this.db.mutate((s) => { s.clients.unshift(client); return s; });
    return mockOk(client, 250);
  }

  /** Tarification identique au canal client (RG-010→016) — même moteur, même grille active. */
  estimate(ville: 'Douala' | 'Yaoundé', input: { distance_km: number; duree_min: number; urgence: UrgencyLevel; poids_kg: number; fragile: boolean }): Observable<PricingSimulationResult> {
    const grid = this.db.pricingGrids().find((g) => g.ville === ville && g.statut === 'ACTIVE');
    if (!grid) return mockFail('ERR-4001', 'Aucune grille tarifaire active pour cette ville.');
    return mockOk(computeQuote(grid, { ...input, heure: new Date().toTimeString().slice(0, 5), ratio_demande: 1 }), 300);
  }

  /** UC-TEL-01 — objectif : commande créée en moins de 90 s. */
  createOrder(payload: TeleconseillerOrderPayload): Observable<Order> {
    const ville = payload.adresse_depart.ville as 'Douala' | 'Yaoundé';
    const grid = this.db.pricingGrids().find((g) => g.ville === ville && g.statut === 'ACTIVE');
    if (!grid) return mockFail('ERR-4001', 'Aucune grille tarifaire active pour cette ville.');

    let client = payload.client_id ? this.db.clients().find((c) => c.id === payload.client_id) : undefined;
    if (!client && payload.nouveau_client) {
      client = {
        id: uid('cli', Math.random), uuid: uid('u', Math.random), kind: 'client', nom: payload.nouveau_client.nom,
        prenom: payload.nouveau_client.prenom, telephone: payload.nouveau_client.telephone, langue: 'fr', statut: 'ACTIF',
        mfa_actif: false, type_client: 'PARTICULIER', partenaire_verifie: true, encours_autorise: 0, solde_avoirs: 0,
        nb_commandes: 0, cree_le: new Date().toISOString(),
      };
      this.db.mutate((s) => { s.clients.unshift(client!); return s; });
    }
    if (!client) return mockFail('ERR-4001', 'Sélectionnez un client existant ou créez-en un nouveau.');

    const quote = computeQuote(grid, {
      distance_km: payload.distance_km, duree_min: payload.duree_min, urgence: payload.urgence,
      heure: new Date().toTimeString().slice(0, 5), poids_kg: payload.poids_kg, fragile: payload.fragile, ratio_demande: 1,
    });
    const actor = this.auth.currentUser();
    const now = new Date().toISOString();
    const numero = `LVB-${ville === 'Douala' ? 'DLA' : 'YDE'}-${now.slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const isCod = payload.mode_paiement === 'COD';

    const order: Order = {
      id: uid('ord', Math.random), uuid: uid('u', Math.random), numero, client_id: client.id, client_nom: `${client.prenom} ${client.nom}`,
      client_telephone: client.telephone!, cree_par_utilisateur_id: actor?.id, canal: 'TELECONSEILLER' as OrderChannel,
      statut: isCod ? 'EN_ATTENTE_AFFECTATION' : 'EN_ATTENTE_PAIEMENT', urgence: payload.urgence, ville,
      adresse_depart: payload.adresse_depart, adresse_arrivee: payload.adresse_arrivee,
      destinataire_nom: payload.destinataire_nom, destinataire_telephone: payload.destinataire_telephone,
      colis: [{ id: uid('col', Math.random), reference: `${numero}-1`, type: payload.colis_type, poids_kg: payload.poids_kg, valeur_declaree: payload.valeur_declaree, statut: 'EN_ATTENTE' }],
      prix_total: quote.prix_final, commission: Math.round(quote.prix_final * 0.2), remuneration_livreur: Math.round(quote.prix_final * 0.8),
      mode_paiement: payload.mode_paiement, montant_cod: isCod ? quote.prix_final : 0,
      echeance_promise: payload.urgence === 'EXPRESS' ? new Date(Date.now() + 120 * 60_000).toISOString() : new Date(Date.now() + 8 * 3_600_000).toISOString(),
      confirmee_le: isCod ? now : undefined, cle_idempotence: uid('idem', Math.random),
      distance_m: Math.round(payload.distance_km * 1000),
      historique: [{ id: uid('h', Math.random), nouveau_statut: isCod ? 'EN_ATTENTE_AFFECTATION' : 'EN_ATTENTE_PAIEMENT', auteur_type: 'AGENT', auteur_nom: actor ? `${actor.prenom} ${actor.nom}` : 'Agent', cree_le: now }],
      preuves: [], a_reclamation: false, cree_le: now, modifie_le: now,
    };

    this.db.mutate((s) => {
      s.orders.unshift(order);
      const cIdx = s.clients.findIndex((c) => c.id === client!.id);
      if (cIdx >= 0) s.clients[cIdx] = { ...s.clients[cIdx], nb_commandes: s.clients[cIdx].nb_commandes + 1 };
      return s;
    });

    if (!isCod) {
      // Simulates the MoMo/OM webhook confirmation arriving moments later (UC-CLI-02 nominal path).
      setTimeout(() => {
        this.db.mutate((s) => {
          const idx = s.orders.findIndex((o) => o.id === order.id);
          if (idx >= 0 && s.orders[idx].statut === 'EN_ATTENTE_PAIEMENT') {
            s.orders[idx] = { ...s.orders[idx], statut: 'EN_ATTENTE_AFFECTATION', confirmee_le: new Date().toISOString() };
            s.orders[idx].historique = [...s.orders[idx].historique, { id: uid('h', Math.random), ancien_statut: 'EN_ATTENTE_PAIEMENT', nouveau_statut: 'EN_ATTENTE_AFFECTATION', auteur_type: 'SYSTEME', auteur_nom: 'Webhook paiement', cree_le: new Date().toISOString() }];
          }
          return s;
        });
      }, 2500);
    }

    return mockOk(order, 400);
  }

  callbacks(agentId?: string): Observable<Callback[]> {
    let items = [...this.db.callbacks()].sort((a, b) => a.echeance.localeCompare(b.echeance));
    if (agentId) items = items.filter((c) => c.agent_id === agentId);
    // "Les rappels échus apparaissent en tête de la file" (UC-TEL-06).
    items.sort((a, b) => {
      const overdueA = a.statut === 'PLANIFIE' && new Date(a.echeance).getTime() < Date.now();
      const overdueB = b.statut === 'PLANIFIE' && new Date(b.echeance).getTime() < Date.now();
      if (overdueA !== overdueB) return overdueA ? -1 : 1;
      return a.echeance.localeCompare(b.echeance);
    });
    return mockOk(items);
  }

  createCallback(payload: Omit<Callback, 'id' | 'statut' | 'cree_le' | 'agent_id' | 'agent_nom'>): Observable<Callback> {
    const actor = this.auth.currentUser();
    const callback: Callback = { ...payload, id: uid('cb', Math.random), statut: 'PLANIFIE', agent_id: actor?.id ?? '', agent_nom: actor ? `${actor.prenom} ${actor.nom}` : 'Agent', cree_le: new Date().toISOString() };
    this.db.mutate((s) => { s.callbacks.unshift(callback); return s; });
    return mockOk(callback, 200);
  }

  completeCallback(id: string): Observable<Callback> {
    this.db.mutate((s) => {
      const idx = s.callbacks.findIndex((c) => c.id === id);
      if (idx >= 0) s.callbacks[idx] = { ...s.callbacks[idx], statut: 'FAIT' };
      return s;
    });
    return mockOk(this.db.callbacks().find((c) => c.id === id)!);
  }

  cancelCallback(id: string): Observable<Callback> {
    this.db.mutate((s) => {
      const idx = s.callbacks.findIndex((c) => c.id === id);
      if (idx >= 0) s.callbacks[idx] = { ...s.callbacks[idx], statut: 'ANNULE' };
      return s;
    });
    return mockOk(this.db.callbacks().find((c) => c.id === id)!);
  }

  /** UC-TEL-07 — rafraîchi au minimum toutes les 15 minutes côté UI (le mock recalcule à chaque appel). */
  activity(agentId: string): Observable<AgentActivitySnapshot> {
    const actor = this.db.staff().find((s) => s.id === agentId);
    const orders = this.db.orders().filter((o) => o.cree_par_utilisateur_id === agentId);
    const callbacks = this.db.callbacks().filter((c) => c.agent_id === agentId && c.statut === 'PLANIFIE');
    return mockOk({
      agent_id: agentId, agent_nom: actor ? `${actor.prenom} ${actor.nom}` : 'Agent',
      appels_traites: orders.length + callbacks.length + 12,
      commandes_creees: orders.length,
      taux_conversion: orders.length ? Math.round((orders.filter((o) => o.statut !== 'ANNULEE').length / orders.length) * 1000) / 10 : 0,
      temps_moyen_traitement_s: 96,
      rappels_en_attente: callbacks.length,
      reclamations_traitees: this.db.claims().filter((c) => c.assignee_a === (actor ? `${actor.prenom} ${actor.nom}` : '')).length,
      refreshed_le: new Date().toISOString(),
    });
  }
}
