import { AccountStatus, ClientType, StaffRoleCode, VehicleType } from './enums';
import { AuditFields } from './common.model';

/** `utilisateurs` (§7.2.1). */
export interface UtilisateurBase extends AuditFields {
  id: string;
  uuid: string;
  telephone?: string;
  telephone_verifie_le?: string;
  email?: string;
  email_verifie_le?: string;
  nom: string;
  prenom?: string;
  photo_url?: string;
  langue: 'fr' | 'en';
  statut: AccountStatus;
  derniere_connexion_le?: string;
  mfa_actif: boolean;
}

export interface StaffUser extends UtilisateurBase {
  kind: 'staff';
  role: StaffRoleCode;
  permissions: string[];
}

/** `clients` (§7.2.3). */
export interface ClientUser extends UtilisateurBase {
  kind: 'client';
  type_client: ClientType;
  raison_sociale?: string;
  numero_contribuable?: string;
  partenaire_verifie: boolean;
  encours_autorise: number;
  solde_avoirs: number;
  nb_commandes: number;
  note_moyenne?: number;
}

export type AnyUser = StaffUser | ClientUser;

export interface Vehicle {
  id: string;
  livreur_id: string;
  type: VehicleType;
  immatriculation: string;
  marque?: string;
  modele?: string;
  capacite_poids_kg: number;
  capacite_volume_l: number;
  actif: boolean;
}

export interface UserActionLogEntry {
  id: string;
  utilisateur_id: string;
  action: 'SUSPENSION' | 'REACTIVATION' | 'MODIFICATION' | 'CREATION';
  motif?: string;
  auteur: string;
  cree_le: string;
}

export interface Session {
  id: string;
  utilisateur_id: string;
  appareil: string;
  modele: string;
  ip: string;
  localisation_approx?: string;
  cree_le: string;
  derniere_activite_le: string;
  courante: boolean;
}

export interface Role {
  code: StaffRoleCode;
  nom: string;
  description: string;
  permissions: string[];
}
