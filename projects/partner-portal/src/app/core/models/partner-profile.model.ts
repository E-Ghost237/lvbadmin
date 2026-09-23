import { PartnerLinks } from '@lvb/models/partner.model';
import { PartnerRole } from '@lvb/models/enums';

/**
 * `PATCH /v1/partner/profile` — RGPRT005ProfileChanges::DIRECT. Every field
 * is independently optional (Laravel `sometimes`); omit what isn't
 * changing.
 */
export interface UpdatePartnerProfileRequest {
  nom_commercial?: string;
  logo_url?: string | null;
  secteur_activite?: string | null;
  telephone?: string;
  email?: string | null;
  adresse_physique?: string;
  ville?: string;
  zones_desservies?: string[];
  site_web?: string | null;
  reseaux_sociaux?: PartnerLinks;
  responsable_telephone?: string;
  responsable_email?: string | null;
}

/**
 * `POST /v1/partner/profile/change-requests` — RGPRT005ProfileChanges::SENSITIVE.
 * Goes to an admin approval queue rather than applying directly (RG-PRT-005).
 */
export interface RequestPartnerProfileChangeRequest {
  raison_sociale?: string;
  numero_contribuable?: string;
  rccm?: string;
  responsable_nom?: string;
}

export interface InvitePartnerUserRequest {
  email?: string;
  telephone?: string;
  role: PartnerRole;
}
