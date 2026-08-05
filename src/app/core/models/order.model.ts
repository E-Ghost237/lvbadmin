import {
  AuditActorType, CancellationReason, OrderChannel, OrderStatus, ParcelType,
  PaymentMethod, UrgencyLevel,
} from './enums';
import { Address, AuditFields, GeoPoint } from './common.model';

export interface Parcel {
  id: string;
  reference: string;
  type: ParcelType;
  poids_kg: number;
  longueur_cm?: number;
  largeur_cm?: number;
  hauteur_cm?: number;
  valeur_declaree?: number;
  description?: string;
  statut: 'EN_ATTENTE' | 'LIVRE' | 'RETOURNE';
}

export interface OrderHistoryEntry {
  id: string;
  ancien_statut?: OrderStatus;
  nouveau_statut: OrderStatus;
  auteur_type: AuditActorType;
  auteur_nom: string;
  position?: GeoPoint;
  motif?: string;
  cree_le: string;
}

export interface ProofOfDelivery {
  type: 'RAMASSAGE' | 'LIVRAISON';
  photos: string[];
  signature_url?: string;
  code_valide: boolean;
  recu_par_nom?: string;
  recu_par_lien?: string;
  position: GeoPoint;
  distance_point_reference_m: number;
  capture_le: string;
  synchronise_le: string;
}

/** `commandes` (§7.2.10) flattened with joined display fields for list/detail screens. */
export interface Order extends AuditFields {
  id: string;
  uuid: string;
  numero: string;
  client_id: string;
  client_nom: string;
  client_telephone: string;
  livreur_id?: string;
  livreur_nom?: string;
  cree_par_utilisateur_id?: string;
  canal: OrderChannel;
  statut: OrderStatus;
  urgence: UrgencyLevel;
  ville: 'Douala' | 'Yaoundé';
  adresse_depart: Address;
  adresse_arrivee: Address;
  destinataire_nom: string;
  destinataire_telephone: string;
  colis: Parcel[];
  prix_total: number;
  commission: number;
  remuneration_livreur: number;
  mode_paiement: PaymentMethod;
  montant_cod: number;
  creneau_debut?: string;
  creneau_fin?: string;
  echeance_promise: string;
  confirmee_le?: string;
  affectee_le?: string;
  recuperee_le?: string;
  livree_le?: string;
  annulee_le?: string;
  motif_annulation?: CancellationReason;
  frais_annulation?: number;
  cle_idempotence: string;
  a_lheure?: boolean;
  distance_m: number;
  historique: OrderHistoryEntry[];
  preuves: ProofOfDelivery[];
  a_reclamation: boolean;
}

export interface OrderListFilters {
  statut?: OrderStatus | 'TOUS' | 'ACTIVES';
  ville?: string;
  canal?: OrderChannel;
  livreur_id?: string;
  client_id?: string;
  date_debut?: string;
  date_fin?: string;
  search?: string;
}

export interface CancellationQuote {
  frais: number;
  frais_pct: number;
  remboursement: number;
  justification: string;
}
