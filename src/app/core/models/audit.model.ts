/** `journal_audit` (SEC-40/41/42) — write-once, queryable. */
export interface AuditLogEntry {
  id: string;
  auteur_nom: string;
  auteur_role: string;
  action: string;
  ressource: string;
  ressource_id?: string;
  ip: string;
  appareil: string;
  valeur_avant?: Record<string, unknown>;
  valeur_apres?: Record<string, unknown>;
  cree_le: string;
}

export interface SystemParameter {
  cle: string;
  categorie: 'DISPATCH' | 'DELAIS' | 'PLAFONDS' | 'SLA' | 'TARIFICATION';
  label: string;
  description: string;
  valeur: number | boolean | string;
  type: 'NOMBRE' | 'BOOLEEN' | 'TEXTE';
  unite?: string;
  min?: number;
  max?: number;
  modifie_le: string;
  modifie_par: string;
}
