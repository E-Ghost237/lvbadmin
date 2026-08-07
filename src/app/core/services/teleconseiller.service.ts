import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { GeoPoint } from '../models';

export interface ConsoleSearchResult {
  clients: { id: number; nom: string; prenom: string | null; telephone: string }[];
  commandes: { id: number; uuid: string; statut: string; destinataire_nom: string }[];
}

export type UrgencyLevel = 'STANDARD' | 'EXPRESS' | 'PLANIFIE';
export type PaymentMethod = 'MTN_MOMO' | 'ORANGE_MONEY' | 'CARTE' | 'COD' | 'PORTEFEUILLE_PARTENAIRE';

export interface QuoteRequest {
  ville: string;
  depart: GeoPoint;
  arrivee: GeoPoint;
  urgence: UrgencyLevel;
  colis: {
    poids_kg: number;
    somme_dimensions_cm?: number | null;
    fragile?: boolean;
    valeur_declaree_xaf?: number | null;
    assurance_souscrite?: boolean;
  };
  remise_souhaitee_xaf?: number;
}

export interface QuoteCreated {
  devis_id: string;
  expire_le: string;
  prix_final: number;
  montant_assurance: number;
  distance_km: number;
  distance_via_repli: boolean;
  duree_estimee_minutes: number;
  coefficients: Record<string, number>;
  decomposition: Record<string, number>;
}

export interface CreateConsoleOrderRequest {
  telephone_client: string;
  nom_client: string;
  prenom_client?: string | null;
  devis_id: string;
  destinataire_nom: string;
  destinataire_telephone: string;
  mode_paiement: PaymentMethod;
  instructions_ramassage?: string | null;
  instructions_livraison?: string | null;
  creneau_planifie?: string | null;
}

export interface ConsoleOrderCreated {
  commande_id: string;
  statut: string;
  prix_final: number;
  echeance_promise: string;
}

export interface OrderHistoryEntry {
  ancien_statut: string | null;
  nouveau_statut: string;
  auteur_utilisateur_id: number | null;
  horodatage: string;
  motif: string | null;
}

export interface ConsoleOrderDetail {
  commande_id: string;
  statut: string;
  destinataire_nom: string;
  destinataire_telephone: string;
  prix_final: number;
  echeance_promise: string;
  historique: OrderHistoryEntry[];
}

export type ComplaintCategory = 'RETARD' | 'COLIS_ENDOMMAGE' | 'COLIS_PERDU' | 'COMPORTEMENT' | 'ERREUR_FACTURATION';

export interface Reminder {
  id: number;
  client_id: number | null;
  commande_id: number | null;
  echeance: string;
  notes: string | null;
}

export interface AgentActivitySummary {
  commandes_creees: number;
  commandes_confirmees: number;
  taux_conversion: number;
}

/** UC-TEL-01→07 — /v1/console/* (Ordering module). */
@Injectable({ providedIn: 'root' })
export class TeleconseillerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  search(q: string): Observable<ConsoleSearchResult> {
    return this.http.get<ConsoleSearchResult>(`${this.baseUrl}/console/search`, { params: { q } });
  }

  quote(req: QuoteRequest): Observable<QuoteCreated> {
    return this.http.post<QuoteCreated>(`${this.baseUrl}/quotes`, req);
  }

  createOrder(req: CreateConsoleOrderRequest): Observable<ConsoleOrderCreated> {
    return this.http.post<ConsoleOrderCreated>(`${this.baseUrl}/console/orders`, req, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  getOrder(commandeId: string): Observable<ConsoleOrderDetail> {
    return this.http.get<ConsoleOrderDetail>(`${this.baseUrl}/console/orders/${commandeId}`);
  }

  reassignOrder(commandeId: string, motif: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/console/orders/${commandeId}/reassign`, { motif });
  }

  openComplaint(req: { commande_id: number; client_id: number; categorie: ComplaintCategory; description: string }): Observable<{ reclamation_id: number }> {
    return this.http.post<{ reclamation_id: number }>(`${this.baseUrl}/console/complaints`, req);
  }

  resolveComplaint(reclamationId: number, motifResolution: string, gesteCommercialXaf?: number | null): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/console/complaints/${reclamationId}/resolve`, {
      motif_resolution: motifResolution, geste_commercial_xaf: gesteCommercialXaf ?? null,
    });
  }

  escalateComplaint(reclamationId: number, motif: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/console/complaints/${reclamationId}/escalate`, { motif });
  }

  createReminder(req: { client_id?: number | null; commande_id?: number | null; echeance: string; notes?: string | null }): Observable<{ tache_id: number }> {
    return this.http.post<{ tache_id: number }>(`${this.baseUrl}/console/reminders`, req);
  }

  reminders(): Observable<Reminder[]> {
    return this.http.get<{ data: Reminder[] }>(`${this.baseUrl}/console/reminders`).pipe(map((r) => r.data));
  }

  activity(depuis?: string): Observable<AgentActivitySummary> {
    const params: Record<string, string> = depuis ? { depuis } : {};
    return this.http.get<AgentActivitySummary>(`${this.baseUrl}/console/activity`, { params });
  }
}
