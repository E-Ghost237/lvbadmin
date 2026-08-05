export type AlertKind =
  | 'SANS_AFFECTATION' | 'RETARD_SLA' | 'INCIDENT_CRITIQUE'
  | 'PAIEMENT_EN_ATTENTE' | 'PLAFOND_COD' | 'ECART_PROXIMITE';

export interface SupervisionAlert {
  id: string;
  type: AlertKind;
  gravite: 'INFO' | 'AVERTISSEMENT' | 'CRITIQUE';
  titre: string;
  detail: string;
  commande_id?: string;
  commande_numero?: string;
  livreur_id?: string;
  livreur_nom?: string;
  cree_le: string;
  acquittee: boolean;
  acquittee_par?: string;
  acquittee_motif?: string;
  acquittee_le?: string;
}

export interface AppNotification {
  id: string;
  titre: string;
  message: string;
  type: 'INFO' | 'SUCCES' | 'AVERTISSEMENT' | 'ERREUR';
  lien?: string;
  lue: boolean;
  cree_le: string;
}
