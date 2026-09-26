import { ERROR_CODES } from './error-codes';

export type ErrorLocale = 'fr' | 'en';

export type ProblemKind =
  | 'network' | 'auth' | 'forbidden' | 'notFound' | 'validation' | 'conflict' | 'rateLimit' | 'server' | 'client';

export interface FieldIssue {
  /** Backend field name, dotted for nested fields (`cancellation_policy.description`). */
  field: string;
  /** Human label in the active language. */
  label: string;
  /** Short reason in the active language, e.g. "déjà utilisé". */
  reason: string;
}

export interface ProblemInput {
  status: number;
  code?: string | null;
  detail?: string | null;
  errors?: { field: string; message: string; code?: string }[] | null;
}

export interface FriendlyProblem {
  kind: ProblemKind;
  message: string;
  fieldErrors: FieldIssue[];
  /** True when the code is unknown to the catalogue or the failure is a server fault — worth quoting the request reference. */
  needsReference: boolean;
}

// --- Field labels ------------------------------------------------------------

const FIELD_LABELS: Record<string, [string, string]> = {
  email: ['Email', 'Email'], telephone: ['Téléphone', 'Phone'], phone: ['Téléphone', 'Phone'],
  password: ['Mot de passe', 'Password'], password_confirmation: ['Confirmation du mot de passe', 'Password confirmation'],
  code: ['Code', 'Code'], nom: ['Nom', 'Last name'], prenom: ['Prénom', 'First name'],
  first_name: ['Prénom', 'First name'], last_name: ['Nom', 'Last name'], birth_date: ['Date de naissance', 'Date of birth'],
  address: ['Adresse', 'Address'], adresse_physique: ['Adresse', 'Address'], ville: ['Ville', 'City'], city: ['Ville', 'City'],
  nom_commercial: ['Nom commercial', 'Trade name'], secteur_activite: ['Secteur d’activité', 'Business sector'],
  rccm: ['RCCM', 'RCCM'], raison_sociale: ['Raison sociale', 'Company name'],
  numero_contribuable: ['N° contribuable (NIU)', 'Taxpayer no. (NIU)'],
  responsable_nom: ['Nom du responsable', 'Manager name'], responsable_telephone: ['Téléphone du responsable', 'Manager phone'],
  responsable_email: ['Email du responsable', 'Manager email'], site_web: ['Site web', 'Website'], logo_url: ['URL du logo', 'Logo URL'],
  zones_desservies: ['Zones desservies', 'Service zones'], reseaux_sociaux: ['Réseaux sociaux', 'Social links'],
  owner_uuid: ['Client Entreprise', 'Enterprise client'], roles: ['Rôles', 'Roles'], role: ['Rôle', 'Role'],
  type_client: ['Type de client', 'Client type'], registration: ['Immatriculation', 'Licence plate'],
  brand: ['Marque', 'Brand'], model: ['Modèle', 'Model'], year: ['Année', 'Year'], vehicle_type: ['Type de véhicule', 'Vehicle type'],
  category: ['Catégorie', 'Category'], license_category: ['Catégorie de permis', 'Licence category'], color: ['Couleur', 'Colour'],
  capacity_kg: ['Capacité (kg)', 'Capacity (kg)'], volume_liters: ['Volume (litres)', 'Volume (litres)'], seats: ['Places', 'Seats'],
  fuel: ['Carburant', 'Fuel'], transmission: ['Transmission', 'Transmission'], mileage: ['Kilométrage', 'Mileage'],
  condition: ['État', 'Condition'], status: ['Statut', 'Status'], license_number: ['Numéro de permis', 'Licence number'],
  license_categories: ['Catégories de permis', 'Licence categories'], license_expires_at: ['Validité du permis', 'Licence expiry'],
  experience_years: ['Années d’expérience', 'Years of experience'], photo_url: ['Photo', 'Photo'], vehicle_types: ['Types de véhicule', 'Vehicle types'],
  title: ['Titre', 'Title'], description: ['Description', 'Description'], service_zones: ['Zones desservies', 'Service zones'],
  media: ['Médias', 'Media'], conditions: ['Conditions', 'Conditions'], rate_plan_uuid: ['Tarif', 'Rate plan'],
  vehicle_uuid: ['Véhicule', 'Vehicle'], category_uuid: ['Catégorie', 'Category'], booking_mode: ['Mode de réservation', 'Booking mode'],
  indicative_amount: ['Montant indicatif', 'Indicative amount'], 'cancellation_policy.description': ['Description de la politique d’annulation', 'Cancellation policy description'],
  'cancellation_policy.free_cancellation_hours': ['Annulation gratuite (heures)', 'Free cancellation (hours)'],
  'cancellation_policy.fee_basis_points': ['Frais d’annulation (points de base)', 'Cancellation fee (basis points)'],
  'cancellation_policy.fixed_fee_xaf': ['Frais fixes d’annulation', 'Fixed cancellation fee'],
  name: ['Nom', 'Name'], mode: ['Mode', 'Mode'], parameters: ['Paramètres', 'Parameters'], provider: ['Opérateur', 'Provider'],
  account_number: ['Numéro de compte', 'Account number'], holder_name: ['Titulaire', 'Account holder'],
  amount_xaf: ['Montant (XAF)', 'Amount (XAF)'], payout_account_uuid: ['Compte de paiement', 'Payout account'],
  reason: ['Motif', 'Reason'], motif: ['Motif', 'Reason'], type_document: ['Type de document', 'Document type'],
  fichier: ['Fichier', 'File'], file: ['Fichier', 'File'], expire_le: ['Date d’expiration', 'Expiry date'],
  telephone_client: ['Téléphone du client', 'Client phone'], destinataire_telephone: ['Téléphone du destinataire', 'Recipient phone'],
  email_client: ['Email du client', 'Client email'], encours_autorise_xaf: ['Plafond d’encours (XAF)', 'Credit ceiling (XAF)'],
  basis_points: ['Taux (points de base)', 'Rate (basis points)'], valid_from: ['Valide à partir du', 'Valid from'], valid_to: ['Valide jusqu’au', 'Valid until'],
  kind: ['Type', 'Type'], driver_uuid: ['Chauffeur', 'Driver'], outcome: ['Résolution', 'Resolution'],
  operator_reference: ['Référence opérateur', 'Operator reference'], starts_at: ['Début', 'Start'], ends_at: ['Fin', 'End'],
};

function humanize(field: string): string {
  const last = field.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? field;
  const text = last.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fieldLabel(field: string, locale: ErrorLocale): string {
  const normalised = field.replace(/\.\d+(?=\.|$)/g, '');
  const entry = FIELD_LABELS[normalised] ?? FIELD_LABELS[normalised.split('.').pop() ?? ''];
  if (entry) return locale === 'fr' ? entry[0] : entry[1];
  return humanize(field);
}

// --- Server validation message -> reason -----------------------------------------

type Reason =
  | 'required' | 'email' | 'taken' | 'max' | 'min' | 'format' | 'confirmed' | 'prohibited' | 'missing' | 'url'
  | 'date' | 'integer' | 'uuid' | 'in' | 'compromised' | 'other';

const REASON_TEXT: Record<Reason, [string, string]> = {
  required: ['obligatoire', 'required'],
  email: ['adresse email invalide', 'invalid email address'],
  taken: ['déjà utilisé', 'already in use'],
  max: ['trop long ou trop élevé', 'too long or too high'],
  min: ['trop court ou trop faible', 'too short or too low'],
  format: ['format invalide', 'invalid format'],
  confirmed: ['la confirmation ne correspond pas', 'confirmation does not match'],
  prohibited: ['champ non autorisé', 'field not allowed'],
  missing: ['champ non attendu', 'unexpected field'],
  url: ['URL invalide (https requis)', 'invalid URL (https required)'],
  date: ['date invalide', 'invalid date'],
  integer: ['nombre entier requis', 'whole number required'],
  uuid: ['identifiant invalide', 'invalid identifier'],
  in: ['valeur non autorisée', 'value not allowed'],
  compromised: ['mot de passe trop courant ou déjà compromis', 'password too common or previously breached'],
  other: ['valeur invalide', 'invalid value'],
};

/** The backend has no French validation file: `errors[].message` is Laravel's English default, and every `code` is the literal "invalid". */
export function reasonFromServerMessage(message: string): Reason {
  const m = message.toLowerCase();
  if (/data leak|data breach|compromised|appeared in/.test(m)) return 'compromised';
  if (/already been taken|already exists/.test(m)) return 'taken';
  if (/valid email/.test(m)) return 'email';
  if (/confirmation/.test(m)) return 'confirmed';
  if (/prohibited/.test(m)) return 'prohibited';
  if (/must be missing|is missing|not allowed|unexpected/.test(m)) return 'missing';
  if (/valid url/.test(m)) return 'url';
  if (/is required|must be present|field is required/.test(m)) return 'required';
  if (/greater than|at most|too long|may not be greater|must not have more/.test(m)) return 'max';
  if (/at least|less than|too short|must not have fewer/.test(m)) return 'min';
  if (/uuid/.test(m)) return 'uuid';
  if (/integer/.test(m)) return 'integer';
  if (/valid date|date format|before|after/.test(m)) return 'date';
  if (/selected .* is invalid|must be one of|is invalid\.$/.test(m)) return 'in';
  if (/format is invalid|regex/.test(m)) return 'format';
  return 'other';
}

// --- Status fallbacks ----------------------------------------------------------

const GENERIC_DETAILS = new Set([
  'une erreur inattendue est survenue.',
  'un ou plusieurs champs sont invalides.',
  'erreur interne',
  'requête malformée',
]);

function statusFallback(status: number, locale: ErrorLocale): string {
  const fr = locale === 'fr';
  if (status === 0) return fr ? 'Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez.' : 'Cannot reach the server. Check your internet connection and try again.';
  if (status === 401) return fr ? 'Votre session a expiré. Reconnectez-vous.' : 'Your session has expired. Please sign in again.';
  if (status === 403) return fr ? 'Vous n’avez pas la permission d’effectuer cette action.' : 'You do not have permission to perform this action.';
  if (status === 404) return fr ? 'Élément introuvable — ou fonctionnalité non activée sur cet environnement.' : 'Item not found — or this feature is not enabled on this environment.';
  if (status === 408 || status === 504) return fr ? 'Le serveur met trop de temps à répondre. Réessayez dans un instant.' : 'The server is taking too long to respond. Try again in a moment.';
  if (status === 409) return fr ? 'Conflit avec l’état actuel. Actualisez puis réessayez.' : 'Conflicts with the current state. Refresh and try again.';
  if (status === 413) return fr ? 'Le fichier est trop volumineux.' : 'The file is too large.';
  if (status === 415) return fr ? 'Ce type de fichier n’est pas accepté.' : 'This file type is not accepted.';
  if (status === 429) return fr ? 'Trop de tentatives. Patientez quelques instants avant de réessayer.' : 'Too many attempts. Please wait a moment before trying again.';
  if (status >= 500) return fr ? 'Le service rencontre un problème. Réessayez ; si cela persiste, communiquez la référence au support.' : 'The service is having a problem. Try again; if it persists, give the reference to support.';
  return fr ? 'La demande n’a pas pu aboutir. Vérifiez les informations saisies.' : 'The request could not be completed. Check the information entered.';
}

function kindFor(status: number): ProblemKind {
  if (status === 0) return 'network';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409 || status === 423) return 'conflict';
  if (status === 429) return 'rateLimit';
  if (status >= 500) return 'server';
  if (status === 400 || status === 422) return 'validation';
  return 'client';
}

const MAX_LISTED_FIELDS = 6;

/** Dispatch eligibility (RG-050) — the backend reports each failed criterion as `RG-050-<n>` in `errors[].code`. */
const ELIGIBILITY_REASONS: Record<number, [string, string]> = {
  1: ['le compte du livreur n’est pas actif ou il n’est pas « disponible » dans l’application', 'the driver’s account is not active, or the driver is not set to “available” in the app'],
  2: ['un document du livreur est expiré (permis ou assurance)', 'one of the driver’s documents has expired (licence or insurance)'],
  3: ['la position du livreur date de plus de 2 minutes — l’application doit rester ouverte et connectée', 'the driver’s position is older than 2 minutes — the app must stay open and online'],
  4: ['le livreur est trop loin du point de ramassage', 'the driver is too far from the pickup point'],
  5: ['le véhicule du livreur ne peut pas transporter ce colis (poids ou volume) ou aucun véhicule actif n’est enregistré', 'the driver’s vehicle cannot carry this parcel (weight or volume), or no active vehicle is registered'],
  6: ['le plafond d’encaissement à la livraison (COD) du livreur serait dépassé', 'the driver’s cash-on-delivery ceiling would be exceeded'],
  7: ['le livreur a déjà le nombre maximal de missions en cours', 'the driver already has the maximum number of missions in progress'],
  8: ['le livreur a déjà refusé cette commande', 'the driver has already refused this order'],
  9: ['le livreur se trouve dans une zone interdite', 'the driver is in a forbidden zone'],
};

/** Failed dispatch criteria found in `errors[]`, as readable reasons. */
export function eligibilityReasons(errors: ProblemInput['errors'], locale: ErrorLocale): string[] {
  const out: string[] = [];
  for (const item of errors ?? []) {
    const m = /^RG-050-(\d)$/.exec(item.code ?? '');
    const reason = m ? ELIGIBILITY_REASONS[Number(m[1])] : undefined;
    if (reason) out.push(reason[locale === 'fr' ? 0 : 1]);
  }
  return out;
}

/**
 * Turns a raw API failure into a message a user can act on, plus the list of
 * fields the server refused (so forms can mark them).
 */
export function buildFriendlyProblem(input: ProblemInput, locale: ErrorLocale): FriendlyProblem {
  const fr = locale === 'fr';
  const code = input.code ?? '';
  const def = ERROR_CODES[code];
  const detail = (input.detail ?? '').trim();
  const specificDetail = detail && !GENERIC_DETAILS.has(detail.toLowerCase()) ? detail : '';

  const fieldErrors: FieldIssue[] = [];
  const seen = new Set<string>();
  const eligibility = eligibilityReasons(input.errors, locale);
  for (const item of input.errors ?? []) {
    if (/^RG-050-\d$/.test(item.code ?? '')) continue; // shown as eligibility reasons, not as form fields
    const key = `${item.field}|${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fieldErrors.push({
      field: item.field,
      label: fieldLabel(item.field, locale),
      reason: REASON_TEXT[reasonFromServerMessage(item.message)][fr ? 0 : 1],
    });
  }

  let message: string;
  if (eligibility.length > 0) {
    message = `${fr ? 'Livreur non éligible : ' : 'Driver not eligible: '}${eligibility.join(' ; ')}.`;
  } else if (fieldErrors.length > 0) {
    const listed = fieldErrors.slice(0, MAX_LISTED_FIELDS).map((f) => `${f.label} (${f.reason})`).join(' ; ');
    const more = fieldErrors.length > MAX_LISTED_FIELDS ? (fr ? ` et ${fieldErrors.length - MAX_LISTED_FIELDS} autre(s)` : ` and ${fieldErrors.length - MAX_LISTED_FIELDS} more`) : '';
    message = `${fr ? 'Corrigez les champs suivants' : 'Please fix the following fields'} : ${listed}${more}.`;
  } else if (def) {
    // French: the backend's own detail is written at the throw site and is usually more specific.
    if (fr) message = specificDetail || def.fr;
    else message = specificDetail && specificDetail !== def.en ? `${def.en} (${specificDetail})` : def.en;
  } else if (specificDetail) {
    message = specificDetail;
  } else {
    message = statusFallback(input.status, locale);
  }

  return {
    kind: kindFor(input.status),
    message,
    fieldErrors,
    needsReference: input.status >= 500 || (!def && input.status !== 0 && fieldErrors.length === 0),
  };
}
