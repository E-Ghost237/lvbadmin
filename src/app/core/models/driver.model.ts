import { AccountStatus, DriverOperationalStatus, VehicleType } from './enums';
import { AuditFields, GeoPoint } from './common.model';
import { Vehicle } from './user.model';

/** `livreurs` (§7.2.4). */
export interface Driver extends AuditFields {
  id: string;
  utilisateur_id: string;
  matricule: string;
  nom: string;
  prenom: string;
  telephone: string;
  photo_url?: string;
  numero_cni: string;
  numero_permis: string;
  permis_expire_le: string;
  assurance_expire_le: string;
  statut: AccountStatus;
  statut_operationnel: DriverOperationalStatus;
  position?: GeoPoint;
  position_maj_le?: string;
  note_moyenne: number;
  taux_acceptation_7j: number;
  encours_cod: number;
  plafond_cod: number;
  commission_taux: number;
  zone_predilection?: string;
  numero_versement: string;
  vehicule?: Vehicle;
  score_qualite: number;
  courses_du_jour: number;
  courses_total: number;
}

export type KycPieceType =
  | 'CNI_RECTO' | 'CNI_VERSO' | 'PERMIS' | 'CARTE_GRISE' | 'PHOTO_VEHICULE'
  | 'PHOTO_PROFIL' | 'ASSURANCE' | 'RIB_MOMO';

export type KycPieceStatus = 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE';

export interface KycPiece {
  type: KycPieceType;
  label: string;
  url: string;
  statut: KycPieceStatus;
  motif_rejet?: string;
  televerse_le: string;
}

export type KycDossierStatus = 'DOSSIER_SOUMIS' | 'ACTIF' | 'REJETE';

export interface DriverKycDossier extends AuditFields {
  id: string;
  livreur_id: string;
  nom: string;
  prenom: string;
  telephone: string;
  statut: KycDossierStatus;
  pieces: KycPiece[];
  soumis_le: string;
  decide_le?: string;
  decide_par?: string;
  motif_rejet_global?: string;
}

export type SanctionType = 'AVERTISSEMENT' | 'SUSPENSION_TEMPORAIRE' | 'DESACTIVATION';

export interface DriverSanction {
  id: string;
  livreur_id: string;
  type: SanctionType;
  motif: string;
  duree_jours?: number;
  decide_par: string;
  cree_le: string;
  procedure_contradictoire_notes?: string;
  statut: 'PROPOSEE' | 'CONFIRMEE' | 'ANNULEE';
}

export interface DriverDocumentExpiry {
  livreur_id: string;
  livreur_nom: string;
  piece: 'PERMIS' | 'ASSURANCE';
  expire_le: string;
  jours_restants: number;
}

export interface WithdrawalRequest extends AuditFields {
  id: string;
  livreur_id: string;
  livreur_nom: string;
  montant: number;
  solde_disponible_au_moment: number;
  encours_cod_au_moment: number;
  statut: 'EN_ATTENTE' | 'VALIDE' | 'REJETE' | 'VERSE';
  numero_versement: string;
  motif_rejet?: string;
  cle_idempotence: string;
}
