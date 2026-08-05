import { AuditFields } from './common.model';

export interface ClientSearchResult {
  client_id: string;
  nom: string;
  telephone: string;
  type_client: 'PARTICULIER' | 'ENTREPRISE';
  nb_commandes: number;
  derniere_commande_le?: string;
  connu: boolean;
}

export interface Callback extends AuditFields {
  id: string;
  client_id?: string;
  client_nom: string;
  client_telephone: string;
  commande_id?: string;
  commande_numero?: string;
  motif: string;
  echeance: string;
  statut: 'PLANIFIE' | 'FAIT' | 'ANNULE';
  agent_id: string;
  agent_nom: string;
}

export interface AgentActivitySnapshot {
  agent_id: string;
  agent_nom: string;
  appels_traites: number;
  commandes_creees: number;
  taux_conversion: number;
  temps_moyen_traitement_s: number;
  rappels_en_attente: number;
  reclamations_traitees: number;
  refreshed_le: string;
}
