import { PartnerDocumentType, PartnerRole, PartnerStatus } from '../models/enums';

/**
 * Client-side mirror of the backend's `PartnerRole::allows()` and of the
 * onboarding rules in `ManagePartnerProfile::transition()`. It exists so the UI can
 * hide what a role can never do and explain what is missing — the server stays
 * the authority and still answers 403 (ERR-4038) if this ever drifts.
 */

const ALL_ROLES_READ = new Set([
  'profile.read', 'documents.read', 'users.read', 'orders.read', 'dashboard.read',
  'marketplace.offer.read', 'booking.read',
]);

const BY_ROLE: Record<PartnerRole, ReadonlySet<string>> = {
  RESPONSABLE_PARTENAIRE: new Set([
    'profile.write', 'documents.write', 'users.manage', 'orders.create', 'finance.read', 'finance.export',
    'marketplace.offer.create', 'marketplace.offer.update', 'fleet.vehicle.manage', 'fleet.driver.manage',
    'booking.accept', 'booking.assign_driver', 'booking.execute', 'pricing.manage', 'wallet.read', 'wallet.withdraw',
  ]),
  OPERATEUR_PARTENAIRE: new Set(['orders.create', 'booking.accept', 'booking.assign_driver', 'booking.execute']),
  LECTEUR_PARTENAIRE: new Set(),
};

/** Permissions usable while the dossier is still being onboarded (backend `requireContext(..., dossier: true)`). */
const DOSSIER_PERMISSIONS = new Set(['profile.read', 'profile.write', 'documents.read', 'documents.write']);

export function roleAllows(role: PartnerRole | null, permission: string): boolean {
  if (!role) return false;
  return ALL_ROLES_READ.has(permission) || BY_ROLE[role].has(permission);
}

/** Whether `permission` is reachable for this role in this partner status. */
export function partnerCan(role: PartnerRole | null, status: PartnerStatus | null, permission: string): boolean {
  if (!roleAllows(role, permission)) return false;
  if (status === 'ACTIF') return true;
  if (status === 'EN_ATTENTE_VALIDATION' || status === 'VALIDE') return DOSSIER_PERMISSIONS.has(permission);
  return false;
}

export const REQUIRED_DOCUMENT_TYPES: readonly PartnerDocumentType[] = ['RCCM', 'FISCAL', 'ID_RESPONSABLE', 'CONTRAT_LVB'];

export const DOCUMENT_LABELS: Record<PartnerDocumentType, string> = {
  RCCM: 'RCCM', FISCAL: 'Attestation fiscale (NIU)', ID_RESPONSABLE: 'Pièce d’identité du responsable',
  CONTRAT_LVB: 'Contrat LVB signé', AUTRE: 'Autre document',
};

export const REQUIRED_PROFILE_FIELDS: readonly { key: string; label: string }[] = [
  { key: 'raison_sociale', label: 'Raison sociale' },
  { key: 'numero_contribuable', label: 'Numéro contribuable (NIU)' },
  { key: 'nom_commercial', label: 'Nom commercial' },
  { key: 'rccm', label: 'RCCM' },
  { key: 'responsable_nom', label: 'Nom du responsable' },
  { key: 'responsable_telephone', label: 'Téléphone du responsable' },
];

export interface ReadinessItem {
  key: string;
  label: string;
  ok: boolean;
  /** Extra context, e.g. "en attente de vérification LVB" or a rejection reason. */
  detail?: string;
}

export interface PartnerReadiness {
  documents: ReadinessItem[];
  fields: ReadinessItem[];
  /** Everything the backend requires before VALIDE / ACTIF is satisfied. */
  ready: boolean;
  missing: string[];
}

interface DocLike { type_document: PartnerDocumentType; statut_verification: string; motif_rejet?: string | null }

const DOC_STATUS_DETAIL: Record<string, string> = {
  EN_ATTENTE: 'déposé — en attente de vérification LVB',
  REJETE: 'refusé', EXPIRE: 'expiré',
};

export function computeReadiness(profile: object | null | undefined, documents: readonly DocLike[]): PartnerReadiness {
  const p = (profile ?? {}) as Record<string, unknown>;
  const fields = REQUIRED_PROFILE_FIELDS.map((f): ReadinessItem => {
    const v = p[f.key];
    return { key: f.key, label: f.label, ok: typeof v === 'string' && v.trim() !== '' };
  });
  const docs = REQUIRED_DOCUMENT_TYPES.map((type): ReadinessItem => {
    const mine = documents.filter((d) => d.type_document === type);
    const accepted = mine.some((d) => d.statut_verification === 'VALIDE');
    if (accepted) return { key: type, label: DOCUMENT_LABELS[type], ok: true };
    const latest = mine[mine.length - 1];
    if (!latest) return { key: type, label: DOCUMENT_LABELS[type], ok: false, detail: 'non déposé' };
    const base = DOC_STATUS_DETAIL[latest.statut_verification] ?? latest.statut_verification;
    return { key: type, label: DOCUMENT_LABELS[type], ok: false, detail: latest.motif_rejet ? `${base} — ${latest.motif_rejet}` : base };
  });
  const missing = [...fields, ...docs].filter((i) => !i.ok).map((i) => (i.detail ? `${i.label} (${i.detail})` : i.label));
  return { documents: docs, fields, ready: missing.length === 0, missing };
}
