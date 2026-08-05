import { ClaimCategory, ClaimSeverity, ClaimStatus } from './enums';
import { AuditFields } from './common.model';

/** `reclamations` (§7.2.17). */
export interface Claim extends AuditFields {
  id: string;
  numero: string;
  commande_id: string;
  commande_numero: string;
  ouverte_par_nom: string;
  ouverte_par_id: string;
  categorie: ClaimCategory;
  gravite: ClaimSeverity;
  statut: ClaimStatus;
  description: string;
  pieces_jointes: string[];
  assignee_a?: string;
  echeance_sla: string;
  resolue_le?: string;
  resolution?: string;
  geste_commercial?: number;
  sanction_livreur_id?: string;
}

export interface ClaimMessage {
  id: string;
  claim_id: string;
  auteur: string;
  auteur_role: string;
  message: string;
  cree_le: string;
}

export interface ArbitrationDossier {
  claim: Claim;
  order_snapshot: {
    numero: string;
    statut: string;
    prix_total: number;
    livree_le?: string;
    echeance_promise: string;
  };
  driver_history: {
    livreur_nom: string;
    note_moyenne: number;
    incidents_recents: number;
    reclamations_recentes: number;
  } | null;
  timeline: { label: string; horodatage: string }[];
}
