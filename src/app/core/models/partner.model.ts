import { PartnerChangeStatus, PartnerDocumentStatus, PartnerDocumentType, PartnerRole, PartnerStatus } from './enums';

/** A referenced website/social link — the backend accepts either shape (RG-PRT §8.2). */
export type PartnerLinks = Record<string, string> | string[] | null;

export interface PartnerCategory {
  uuid: string;
  nom: string;
  actif: boolean;
}

/** Admin-visible partner profile — GET/PATCH /v1/admin/partners/{uuid} (LVB-CDC-PART-2026-V1.0 §8.2). */
export interface Partner {
  uuid: string;
  nom_commercial: string;
  logo_url: string | null;
  secteur_activite: string | null;
  telephone: string;
  email: string | null;
  adresse_physique: string;
  ville: string;
  zones_desservies: string[];
  site_web: string | null;
  reseaux_sociaux: PartnerLinks;
  responsable_nom: string;
  responsable_telephone: string;
  responsable_email: string | null;
  /** Sensitive fields (RG-PRT-005) — only ever set via a change-request approval, never directly. */
  rccm: string | null;
  raison_sociale: string | null;
  numero_contribuable: string | null;
  statut_partenaire: PartnerStatus;
  valide_le: string | null;
  archive_le: string | null;
  cree_le: string;
  modifie_le: string;
  categorie: PartnerCategory | null;
}

/**
 * Fields an admin supplies when creating a partner (UC-ADM-PRT-01). Note
 * `raison_sociale`/`numero_contribuable` are never part of creation — the
 * backend rejects them here; they only ever arrive through a partner's own
 * sensitive change-request, later approved by an admin.
 */
export interface CreatePartnerRequest {
  owner_uuid: string;
  nom_commercial: string;
  telephone: string;
  adresse_physique: string;
  ville: string;
  responsable_nom: string;
  responsable_telephone: string;
  logo_url?: string | null;
  secteur_activite?: string | null;
  email?: string | null;
  zones_desservies?: string[];
  site_web?: string | null;
  reseaux_sociaux?: PartnerLinks;
  responsable_email?: string | null;
  rccm?: string | null;
}

/**
 * Non-sensitive fields an admin may update directly (RG-PRT-005 "DIRECT"
 * set), plus the category assignment, which only an admin controls.
 * `raison_sociale`/`numero_contribuable`/`rccm`/`responsable_nom` are
 * deliberately absent — the backend rejects them on this endpoint even for
 * admins; they only change through the change-request workflow.
 */
export interface AdminUpdatePartnerRequest {
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
  categorie_uuid?: string | null;
}

export interface PartnerDocument {
  uuid: string;
  type_document: PartnerDocumentType;
  version: number;
  mime_type: 'application/pdf' | 'image/jpeg' | 'image/png';
  taille_octets: number;
  statut_verification: PartnerDocumentStatus;
  expire_le: string | null;
  verifie_le: string | null;
  motif_rejet: string | null;
  cree_le: string;
}

export interface PartnerDocumentDownload {
  url: string;
  expires_at: string;
}

export interface PartnerMember {
  uuid: string;
  utilisateur: { uuid: string; nom: string; prenom: string | null } | null;
  role: PartnerRole;
  actif: boolean;
}

export interface PartnerInvitation {
  uuid: string;
  role: PartnerRole;
  expire_le: string;
}

/** A pending/decided change to one of the RG-PRT-005 "sensitive" fields. */
export interface PartnerChangeRequest {
  uuid: string;
  valeurs_avant: Record<string, unknown>;
  valeurs_apres: Partial<Record<'raison_sociale' | 'numero_contribuable' | 'rccm' | 'responsable_nom', string>>;
  statut: PartnerChangeStatus;
  motif: string | null;
  cree_le: string;
  decide_le: string | null;
}

export interface PartnerAuditEntry {
  id: number;
  action: string;
  ressource_type: string;
  ressource_id: string;
  acteur_utilisateur_id: number | null;
  acteur_type: string;
  ip: string | null;
  valeur_avant: Record<string, unknown> | null;
  valeur_apres: Record<string, unknown> | null;
  metadonnees: Record<string, unknown> | null;
  cree_le: string | null;
}
