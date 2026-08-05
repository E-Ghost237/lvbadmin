/** Instrumentation contracts mirrored from §14 (a KPI not instrumented does not exist). */

export interface KpiPoint {
  label: string;
  value: number;
}

export interface KpiSeries {
  id: string;
  label: string;
  unit: '%' | 'XAF' | 'min' | 's' | 'count';
  points: KpiPoint[];
}

export interface KpiCardValue {
  id: string;
  label: string;
  value: number;
  unit: '%' | 'XAF' | 'min' | 's' | 'count';
  target?: number;
  alertBelow?: number;
  alertAbove?: number;
  trend?: number;
  formatted?: string;
}

export interface OperationsSnapshot {
  commandes_creees: number;
  commandes_livrees: number;
  commandes_en_cours: number;
  taux_livraison_heure: number;
  chiffre_affaires: number;
  panier_moyen: number;
  livreurs_actifs: number;
}

export interface FinalRecetteChecklist {
  code: string;
  label: string;
  seuil: string;
  valeur_actuelle: string;
  atteint: boolean;
}
