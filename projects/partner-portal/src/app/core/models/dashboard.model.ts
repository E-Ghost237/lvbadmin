/**
 * `GET /v1/partner/dashboard` (ModularPartnerReporting::dashboard) — the
 * single aggregate home-page endpoint for a partner org. `from`/`to` default
 * server-side to a trailing 30-day window when omitted. `finance` is `null`
 * for any role other than RESPONSABLE_PARTENAIRE — the backend never sends
 * financial data to a reader without `finance.read`, not just a UI choice.
 */
export interface PartnerDashboard {
  periode: { from: string; to: string };
  commandes: DashboardOrderCounts;
  finance: DashboardFinance | null;
  qualite: DashboardQuality;
  activite: DashboardActivity;
  alertes: DashboardAlert[];
}

export interface DashboardOrderCounts {
  creees: number;
  en_cours: number;
  livrees: number;
  annulees: number;
  taux_livraison_delai: number | null;
}

/** `PartnerPaymentTotals::result()` + cash-collection summary + invoicing total, merged. */
export interface DashboardFinance {
  devise: 'XAF';
  total_paye_xaf: number;
  total_rembourse_xaf: number;
  net_paye_xaf: number;
  paiements_reussis: number;
  paiements_echoues: number;
  commissions_xaf: number | null;
  commissions_disponibilite: string;
  base_periode_paiements: string;
  base_remboursements: string;
  perimetre_paiements: string;
  transactions_non_attribuables: number;
  encaisse_cod_xaf: number;
  livraisons_cod_encaissees: number;
  base_periode_cod: string;
  total_facture_xaf: number;
  base_periode_facturation: string;
  periode: { from: string; to: string };
}

/** Order-side quality fields merged with `PartnerQualityQueryInterface::summary()`. */
export interface DashboardQuality {
  taux_reclamation: number | null;
  reclamations_ouvertes: number;
  note_moyenne: number | null;
  nombre_evaluations: number;
  incidents_ouverts: number | null;
  incidents_disponibilite: string;
}

export interface DashboardCityVolume {
  ville: string;
  commandes: number;
}

export interface DashboardActivity {
  /** Keys are `j` (today), `j_7`, `j_30` — daily order counts at each offset, not a time series. */
  volumes: Record<string, number>;
  principales_villes: DashboardCityVolume[];
  zones_depart: null;
  zones_arrivee: null;
  zones_disponibilite: string;
}

export type DashboardAlert =
  | { type: 'DOCUMENT_EXPIRANT' | 'DOCUMENT_EXPIRE' | 'DOCUMENT_REJETE'; document_uuid: string; type_document: string; expire_le: string | null }
  | { type: 'RECLAMATION_OUVERTE'; nombre: number }
  | { type: 'PAIEMENT_ECHOUE'; nombre: number };
