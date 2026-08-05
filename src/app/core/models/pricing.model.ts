import { AuditFields, GeoPoint } from './common.model';
import { ZoneType } from './enums';

/** RG-012/013/014 grid, versioned & datable (UC-ADM-06). */
export interface PricingGrid extends AuditFields {
  id: string;
  version_label: string;
  ville: 'Douala' | 'Yaoundé';
  statut: 'BROUILLON' | 'PLANIFIEE' | 'ACTIVE' | 'ARCHIVEE';
  frais_prise_en_charge: number;
  tarif_par_km: number;
  tarif_par_minute: number;
  prix_minimum: number;
  arrondi: number;
  coef_urgence_express: number;
  coef_horaire_soir: number;
  coef_horaire_nuit: number;
  supplement_poids_kg: number;
  supplement_volume: number;
  supplement_fragile: number;
  plafond_remise: number;
  demande_dynamique_active: boolean;
  demande_plafond: number;
  active_le?: string;
  archivee_le?: string;
}

export interface PricingSimulationInput {
  distance_km: number;
  duree_min: number;
  urgence: 'STANDARD' | 'EXPRESS' | 'PLANIFIE';
  heure: string;
  poids_kg: number;
  fragile: boolean;
  ratio_demande: number;
}

export interface PricingSimulationResult {
  prix_base: number;
  prix_ajuste: number;
  majorations: number;
  supplements: number;
  prix_avant_remise: number;
  prix_final: number;
  decomposition: { libelle: string; montant: number }[];
}

/** `zones` (§7.2.7), polygon abstracted to a bounding description for the mock map. */
export interface Zone extends AuditFields {
  id: string;
  nom: string;
  ville: 'Douala' | 'Yaoundé';
  type: ZoneType;
  centre: GeoPoint;
  rayon_km: number;
  supplement_fixe: number;
  prix_minimum?: number;
  actif: boolean;
}

export interface PromoCode extends AuditFields {
  id: string;
  code: string;
  description: string;
  plafond_remise: number;
  plafond_utilisation_global: number;
  utilisations: number;
  mono_usage_par_compte: boolean;
  montant_minimum?: number;
  valide_du: string;
  valide_au: string;
  actif: boolean;
}
