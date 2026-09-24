import { AccountStatus } from './enums';

/**
 * The backend never returns "who am I" after login (no `/v1/profile` GET,
 * no user data in the auth response — only Sanctum tokens). This is the
 * only identity data the frontend legitimately has: the email the user
 * typed into the login form. No name/role/permissions are fabricated.
 */
export interface AuthIdentity {
  email: string;
  /** Filled by `GET /v1/me`. */
  uuid?: string;
  /** Filled by `GET /v1/me` after login (best-effort). */
  nom?: string;
  prenom?: string | null;
  langue?: string;
  role?: string | null;
  roles?: string[];
}

/** `GET /v1/me` (alias `/v1/auth/me`) — exact backend shape. */
export interface CurrentUser {
  uuid: string;
  telephone: string;
  email: string | null;
  nom: string;
  prenom: string | null;
  photo_url: string | null;
  langue: string;
  statut: string;
  role: string | null;
  roles: string[];
}

export type UserProfile = 'CLIENT' | 'LIVREUR' | 'INTERNE';

/** `AdminUserSummary` — GET /v1/admin/users. */
export interface AdminUserSummary {
  uuid: string;
  telephone: string;
  email: string | null;
  nom: string;
  prenom: string | null;
  statut: AccountStatus;
  profil: UserProfile;
  type_client: 'PARTICULIER' | 'ENTREPRISE' | null;
  partenaire_verifie: boolean | null;
  matricule: string | null;
  cree_le: string | null;
}

/** `AdminUserDetail` — GET /v1/admin/users/{uuid}. */
export interface AdminUserDetail extends AdminUserSummary {
  langue: string | null;
  motif_suspension: string | null;
  suspendu_le: string | null;
  derniere_connexion_le: string | null;
  supprime_le: string | null;
  partenaire: {
    type: 'PARTICULIER' | 'ENTREPRISE';
    raison_sociale: string | null;
    numero_contribuable: string | null;
    verifie: boolean;
    encours_autorise_xaf: number;
    valide_le: string | null;
  } | null;
  livreur: {
    matricule: string;
    statut_operationnel: string | null;
    permis_expire_le: string | null;
    assurance_expire_le: string | null;
  } | null;
  historique_administratif: Record<string, unknown>[];
}

/** `DeviceSessionSummary` — GET /v1/profile/sessions (camelCase per contract, PHP DateTimeImmutable shape for dates). */
export interface DeviceSessionSummary {
  id: number;
  appareilNom: string | null;
  appareilModele: string | null;
  ip: string | null;
  derniereActiviteLe: { date: string; timezone_type: number; timezone: string };
  estSessionCourante: boolean;
}

/** `RbacCatalog` — GET /v1/admin/rbac. */
export interface RbacRole {
  id: number;
  name: string;
  permissions: string[];
  users_count: number;
}

export interface RbacCatalog {
  permissions: string[];
  roles: RbacRole[];
}
