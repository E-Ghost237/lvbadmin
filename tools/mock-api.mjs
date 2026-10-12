#!/usr/bin/env node
/**
 * DEV-ONLY mock of the LVB backend (`/v1`). Not part of the app bundle and
 * never used in a production build: the dev configurations replace
 * `src/environments/environment.ts` with `environment.development.ts`
 * (`apiBaseUrl: '/v1'`) and the dev server proxies `/v1` to this process.
 *
 * Purpose: browse every page of the admin panel and the partner portal with
 * plausible data while the real API is unreachable. Fixtures are deliberately
 * "fat" — they carry a superset of the fields the two front-ends read, so a
 * page renders populated instead of blank. Any authenticated request is
 * accepted; `POST /v1/auth/login` always succeeds (no MFA step).
 *
 *   node tools/mock-api.mjs           # listens on 127.0.0.1:4300
 *   MOCK_PORT=4301 node tools/mock-api.mjs
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4300);
const HOST = process.env.MOCK_HOST ?? '127.0.0.1';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const iso = (dayOffset = 0, hourOffset = 0) =>
  new Date(Date.now() + dayOffset * 864e5 + hourOffset * 36e5).toISOString();
const uuid = (n) => `a1b2c3d4-1111-4222-8333-${String(n).padStart(12, '0')}`;
const pick = (list, n) => list[n % list.length];
const pickAll = (list) => list;

const VILLES = ['Douala', 'Yaoundé', 'Bafoussam', 'Kribi'];
const QUARTIERS = ['Bonanjo', 'Akwa', 'Bonapriso', 'Bastos', 'Makepe', 'Deido'];
const PRENOMS = ['Awa', 'Jean', 'Mireille', 'Paul', 'Sandrine', 'Éric', 'Nadège', 'Blaise', 'Chantal', 'Serge', 'Lucie', 'Armand'];
const NOMS = ['Ngassa', 'Mbarga', 'Tchoumi', 'Fotso', 'Abena', 'Kamdem', 'Njoya', 'Bello', 'Essomba', 'Manga', 'Owona', 'Sadi'];
const ENTREPRISES = ['Douala Express SARL', 'Sahel Logistique', 'Bonapriso Transit', 'Cameroun Cargo', 'Wouri Fleet', 'Littoral Rent-A-Car', 'Kribi Mobility', 'Yaoundé Premium Rent'];
const POINTS = [
  { lat: 4.0483, lng: 9.7043 },
  { lat: 4.0621, lng: 9.7186 },
  { lat: 4.0321, lng: 9.7092 },
  { lat: 4.0778, lng: 9.7351 },
  { lat: 4.0145, lng: 9.7523 },
  { lat: 4.0901, lng: 9.6894 },
];
const point = (n) => pick(POINTS, n);
const money = (n, base) => base + n * 1375;

const ORDER_STATUSES = ['CREEE', 'AFFECTEE', 'EN_RAMASSAGE', 'EN_LIVRAISON', 'LIVREE', 'ANNULEE', 'ECHEC_LIVRAISON', 'RETOURNEE', 'PLANIFIEE'];
const DRIVER_OPS = ['DISPONIBLE', 'EN_MISSION', 'PAUSE', 'HORS_LIGNE'];
const ACCOUNT_STATUSES = ['ACTIF', 'ACTIF', 'ACTIF', 'SUSPENDU', 'EN_ATTENTE_VALIDATION'];
const PAYMENT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY', 'CARTE', 'COD', 'PORTEFEUILLE_PARTENAIRE'];

// ---------------------------------------------------------------------------
// entities — admin panel
// ---------------------------------------------------------------------------
const user = (n) => ({
  uuid: uuid(100 + n),
  telephone: `+237 6 ${51 + (n % 8)} ${12 + n} ${45 + n}`,
  email: `client${n}@exemple.cm`,
  nom: pick(NOMS, n),
  prenom: pick(PRENOMS, n + 3),
  statut: pick(ACCOUNT_STATUSES, n),
  profil: n % 7 === 0 ? 'INTERNE' : n % 5 === 0 ? 'LIVREUR' : 'CLIENT',
  type_client: n % 4 === 0 ? 'ENTREPRISE' : 'PARTICULIER',
  partenaire_verifie: n % 4 === 0,
  matricule: n % 5 === 0 ? `LVB-${1200 + n}` : null,
  langue: 'fr',
  motif_suspension: null,
  suspendu_le: null,
  derniere_connexion_le: iso(-1, -n),
  supprime_le: null,
  cree_le: iso(-120 + n * 3),
  photo_url: null,
  partenaire: n % 4 === 0 ? {
    type: 'ENTREPRISE', raison_sociale: pick(ENTREPRISES, n), numero_contribuable: `M0${712345 + n}AB`,
    verifie: true, encours_autorise_xaf: 500000, valide_le: iso(-90 + n),
  } : null,
  livreur: n % 5 === 0 ? {
    matricule: `LVB-${1200 + n}`, statut_operationnel: pick(DRIVER_OPS, n),
    permis_expire_le: iso(200 + n), assurance_expire_le: iso(150 + n),
  } : null,
  historique_administratif: [],
  est_session_courante: false,
});

const order = (n) => {
  const status = pick(ORDER_STATUSES, n);
  const p = point(n);
  const q = point(n + 2);
  return {
    uuid: uuid(200 + n),
    id: 5400 + n,
    reference: `LVB-${5400 + n}`,
    statut: status,
    status,
    canal: n % 3 === 0 ? 'TELECONSEILLER' : 'APP_CLIENT',
    ville: pick(VILLES, n),
    quartier: pick(QUARTIERS, n),
    depart: p, arrival: q, pickup: p, dropoff: q, arrivee: q,
    destinataire: { nom: pick(NOMS, n + 1), telephone: `+237 6 ${55 + n} ${23 + n} ${10 + n}` },
    destinataire_nom: pick(NOMS, n + 1),
    destinataire_telephone: `+237 6 ${55 + n} ${23 + n} ${10 + n}`,
    mode_paiement: pick(PAYMENT_METHODS, n),
    payment_method: pick(PAYMENT_METHODS, n),
    prix_final_xaf: money(n, 2500),
    prix_final: money(n, 2500),
    price_xaf: money(n, 2500),
    poids_kg: 1 + (n % 12),
    valeur_declaree_xaf: n % 3 === 0 ? 150000 : null,
    creneau_planifie: n % 6 === 0 ? iso(1, 3) : null,
    echeance_promise: iso(0, 4),
    promised_at: iso(0, 4),
    promesse: iso(0, 4),
    affectee_le: n % 3 ? iso(0, -2) : null,
    livree_le: status === 'LIVREE' ? iso(0, -1) : null,
    delivered_at: status === 'LIVREE' ? iso(0, -1) : null,
    cree_le: iso(0, -(n + 1)),
    created_at: iso(0, -(n + 1)),
    archivee_le: null,
    recu_disponible: status === 'LIVREE',
    client: { uuid: uuid(100 + n), nom: pick(NOMS, n), prenom: pick(PRENOMS, n + 3), telephone: `+237 6 ${51 + n} 12 ${45 + n}` },
    livreur: n % 4 === 3 ? null : {
      uuid: uuid(300 + n), matricule: `LVB-${1200 + n}`, nom: pick(NOMS, n + 2), prenom: pick(PRENOMS, n), telephone: `+237 6 77 ${30 + n} ${11 + n}`,
    },
    suivi: [
      { statut: 'CREEE', horodatage: iso(0, -6) },
      { statut: 'AFFECTEE', horodatage: iso(0, -5) },
      { statut: 'EN_LIVRAISON', horodatage: iso(0, -2) },
      { statut: status, horodatage: iso(0, -1) },
    ],
    reclamations: n % 5 === 0 ? [{
      uuid: uuid(400 + n), categorie: 'RETARD_LIVRAISON', statut: 'EN_COURS',
      description: 'La livraison a dépassé le créneau promis de plus de deux heures.',
      cree_le: iso(-1, -4),
    }] : [],
    historique: [{ ancien_statut: null, nouveau_statut: 'CREEE', auteur_utilisateur_id: 1, horodatage: iso(0, -6), motif: null }],
  };
};

const driver = (n) => ({
  uuid: uuid(300 + n),
  id: 700 + n,
  matricule: `LVB-${1200 + n}`,
  nom: pick(NOMS, n), last_name: pick(NOMS, n),
  prenom: pick(PRENOMS, n), first_name: pick(PRENOMS, n),
  telephone: `+237 6 77 ${30 + n} ${11 + n}`,
  phone: `+237 6 77 ${30 + n} ${11 + n}`,
  email: `livreur${n}@lvb.cm`,
  statut_compte: pick(ACCOUNT_STATUSES, n),
  statut_operationnel: pick(DRIVER_OPS, n),
  status: n % 6 === 5 ? 'EN_ATTENTE_VALIDATION' : 'ACTIF',
  encours_cod_xaf: money(n, 15000),
  plafond_cod_xaf: 500000,
  note_moyenne: 4.1 + (n % 9) / 10,
  taux_acceptation_7j: 0.62 + (n % 30) / 100,
  cree_le: iso(-200 + n * 4),
  created_at: iso(-200 + n * 4),
  langue: 'fr',
  account_linked: true,
  adresse: `${n} rue ${pick(QUARTIERS, n)}, ${pick(VILLES, n)}`,
  address: `${n} rue ${pick(QUARTIERS, n)}, ${pick(VILLES, n)}`,
  birth_date: '1994-05-18',
  license_categories: ['A', 'B'],
  license_expires_at: iso(240 + n),
  permis_expire_le: iso(240 + n),
  assurance_expire_le: iso(180 + n),
  experience_years: 3 + (n % 6),
  vehicle_types: ['MOTO', 'TRICYCLE'],
  photo_url: null,
  origine: n % 3 === 0 ? 'PARTENAIRE' : 'LVB',
  compliance_suspended: false,
  vehicles: [0, 1].map((i) => ({
    authorization_uuid: uuid(2800 + n * 2 + i),
    vehicle_uuid: uuid(1100 + n + i),
    registration: `LT ${300 + n + i} AB`,
    brand: pick(['Toyota', 'Mercedes'], i),
    model: pick(['Hilux', 'Actros'], i),
    category: pick(['UTILITAIRE', 'CAMION'], i),
    authorized_from: iso(-30 + i),
    authorized_until: i === 0 ? null : iso(120),
  })),
});

const kycSummary = (n) => ({
  uuid: uuid(300 + n),
  nom: pick(NOMS, n),
  prenom: pick(PRENOMS, n + 1),
  statut_compte: 'EN_ATTENTE_VALIDATION',
  matricule: n % 3 === 0 ? null : `LVB-${1300 + n}`,
});

const kycDossier = (n) => ({
  ...kycSummary(n),
  documents: [
    { type: 'CNI', statut: 'VALIDE', motif_rejet: null, decide_le: iso(-3) },
    { type: 'PERMIS', statut: 'EN_ATTENTE', motif_rejet: null, decide_le: null },
    { type: 'CARTE_GRISE', statut: n % 2 ? 'EN_ATTENTE' : 'REJETE', motif_rejet: n % 2 ? null : 'Document illisible — merci de renvoyer une photo nette.', decide_le: iso(-2) },
    { type: 'ASSURANCE', statut: 'EN_ATTENTE', motif_rejet: null, decide_le: null },
    { type: 'VISITE_TECHNIQUE', statut: 'EN_ATTENTE', motif_rejet: null, decide_le: null },
  ],
  statut_compte: 'EN_ATTENTE_VALIDATION',
});

const partner = (n) => ({
  uuid: uuid(500 + n),
  nom_commercial: pick(ENTREPRISES, n),
  logo_url: null,
  secteur_activite: pick(['Transport de marchandises', 'Location de véhicules', 'Transit & douane', 'Logistique urbaine'], n),
  telephone: `+237 6 ${33 + n} ${22 + n} ${44 + n}`,
  email: `contact${n}@partenaire.cm`,
  adresse_physique: `${100 + n} boulevard de la Liberté, ${pick(QUARTIERS, n)}`,
  ville: pick(VILLES, n),
  zones_desservies: ['Douala', 'Yaoundé', 'Kribi'].slice(0, 1 + (n % 3)),
  site_web: `https://partenaire${n}.cm`,
  reseaux_sociaux: { facebook: `https://facebook.com/partenaire${n}` },
  responsable_nom: `${pick(PRENOMS, n + 2)} ${pick(NOMS, n + 4)}`,
  responsable_telephone: `+237 6 99 ${21 + n} ${33 + n}`,
  responsable_email: `direction${n}@partenaire.cm`,
  rccm: `RC/DLA/2026/B/${12000 + n}`,
  raison_sociale: pick(ENTREPRISES, n).toUpperCase(),
  numero_contribuable: `M0${712345 + n}CD`,
  statut_partenaire: n % 5 === 4 ? 'EN_ATTENTE_VALIDATION' : n % 7 === 6 ? 'SUSPENDU' : 'ACTIF',
  valide_le: iso(-160 + n * 5),
  archive_le: null,
  cree_le: iso(-220 + n * 6),
  modifie_le: iso(-2, -n),
  categorie: { uuid: uuid(600 + (n % 3)), nom: pick(['Transport', 'Location', 'Transit'], n), actif: true },
});

const partnerDocument = (n) => ({
  uuid: uuid(700 + n),
  type_document: pick(['RCCM', 'FISCAL', 'ID_RESPONSABLE', 'CONTRAT_LVB', 'AUTRE'], n),
  version: 1 + (n % 2),
  mime_type: n % 2 ? 'application/pdf' : 'image/png',
  taille_octets: 245_760 + n * 1024,
  statut_verification: pick(['EN_ATTENTE', 'VALIDE', 'REJETE'], n),
  expire_le: iso(300 + n),
  verifie_le: n % 3 ? iso(-10) : null,
  motif_rejet: n % 3 === 2 ? 'Le document ne correspond pas au type attendu.' : null,
  cree_le: iso(-30 + n),
  kind: pick(['ASSURANCE', 'VISITE_TECHNIQUE', 'CARTE_GRISE', 'PERMIS', 'JUSTIFICATIF'], n),
  bytes: 245_760 + n * 1024,
  created_at: iso(-30 + n),
});

const partnerMember = (n) => ({
  uuid: uuid(800 + n),
  utilisateur: { uuid: n === 0 ? ME_UUID : uuid(810 + n), nom: pick(NOMS, n), prenom: pick(PRENOMS, n) },
  role: n === 0 ? 'RESPONSABLE_PARTENAIRE' : n % 2 ? 'OPERATEUR_PARTENAIRE' : 'LECTEUR_PARTENAIRE',
  actif: n % 4 !== 3,
});

const partnerChange = (n) => ({
  uuid: uuid(900 + n),
  valeurs_avant: { raison_sociale: 'ANCIENNE RAISON SOCIALE' },
  valeurs_apres: { raison_sociale: pick(ENTREPRISES, n).toUpperCase(), rccm: `RC/DLA/2026/B/${15000 + n}` },
  statut: pick(['EN_ATTENTE', 'APPROUVEE', 'REJETEE'], n),
  motif: n % 3 === 2 ? 'Pièce justificative illisible.' : null,
  cree_le: iso(-12 + n),
  decide_le: n % 3 ? iso(-8 + n) : null,
});

const auditEntry = (n) => ({
  id: 3200 + n,
  action: pick(['USER_SUSPENDED', 'PARTNER_VALIDATED', 'WITHDRAWAL_APPROVED', 'ROLE_UPDATED', 'SETTING_UPDATED'], n),
  ressource_type: pick(['User', 'Partner', 'Withdrawal', 'RbacRole', 'Setting'], n),
  ressource_id: String(1200 + n),
  acteur_utilisateur_id: 1 + (n % 4),
  acteur_type: pick(['AGENT', 'SYSTEME', 'CLIENT'], n),
  ip: `41.202.${n}.${20 + n}`,
  valeur_avant: { statut: 'ACTIF' },
  valeur_apres: { statut: 'SUSPENDU' },
  metadonnees: { source: 'admin-web' },
  cree_le: iso(0, -(n + 2)),
});

const offer = (n) => ({
  id: 2100 + n,
  uuid: uuid(1000 + n),
  partner_id: 42 + n,
  category_id: 1 + (n % 3),
  category_uuid: uuid(600 + (n % 3)),
  service_type: pick(['LOCATION', 'LIVRAISON'], n),
  title: pick(['Location camionnette 1 journée', 'Transfert Douala → Kribi', 'Camion 3,5 t avec chauffeur', 'Location berline premium'], n),
  description: 'Véhicule récent, assurance tous risques et conducteur expérimenté inclus.',
  city: pick(VILLES, n),
  service_zones: ['Douala', 'Kribi'],
  media: [],
  conditions: 'Carburant à la charge du client au-delà de 100 km.',
  vehicle_uuid: uuid(1100 + n),
  vehicle_category: 'CAMIONNETTE',
  rate_plan_uuid: uuid(1200 + n),
  booking_mode: n % 2 ? 'AUTO_CONFIRM' : 'PARTNER_CONFIRM',
  with_driver: n % 2 === 0,
  indicative_amount: money(n, 25000),
  status: pick(['PUBLIEE', 'EN_REVUE', 'BROUILLON', 'SUSPENDUE', 'ARCHIVEE', 'REJETEE'], n),
  version: 1 + (n % 3),
  rating: 4.2,
  rating_count: 18 + n,
  created_at: iso(-60 + n * 3),
  updated_at: iso(-4, -n),
  name: `Tarif ${2026 + n}`,
});

const booking = (n) => ({
  uuid: uuid(1300 + n),
  status: pick(['CONFIRMEE', 'EN_ATTENTE_CONFIRMATION', 'PLANIFIEE', 'EN_ROUTE', 'TERMINEE', 'ANNULEE', 'EN_ATTENTE_PAIEMENT'], n),
  statut: pick(['CONFIRMEE', 'PLANIFIEE', 'TERMINEE'], n),
  payment_status: pick(['PAID', 'PENDING', 'REFUND_PENDING'], n),
  payment_uuid: uuid(1400 + n),
  offer_uuid: uuid(1000 + (n % 4)),
  offer_title: pick(['Location camionnette 1 journée', 'Transfert Douala → Kribi'], n),
  vehicle_uuid: uuid(1100 + n),
  with_driver: n % 2 === 0,
  driver_assigned: n % 3 !== 2,
  starts_at: iso(1 + n, 2),
  ends_at: iso(2 + n, 4),
  hold_expires_at: iso(0, 6),
  currency: 'XAF',
  total_amount: money(n, 45000),
  commission_amount: Math.round(money(n, 45000) * 0.12),
  refund_amount: n % 5 === 0 ? 15000 : 0,
  refunded_amount: n % 5 === 0 ? 15000 : 0,
  dispute_status: n % 6 === 5 ? 'OPEN' : null,
  completed_at: n % 4 === 3 ? iso(-1, 5) : null,
  pricing: { base_amount: money(n, 45000) },
  cancellation_policy: { description: 'Annulation gratuite jusqu’à 24 h avant le départ.' },
  vehicle: { uuid: uuid(1100 + n), registration: `LT ${300 + n} AB`, brand: 'Toyota', model: 'Hilux', vehicle_type: 'CAMIONNETTE', color: 'Blanc' },
  driver: { uuid: uuid(300 + n), first_name: pick(PRENOMS, n), last_name: pick(NOMS, n), phone: `+237 6 77 ${30 + n} ${11 + n}` },
  pickup: { lat: point(n).lat, lng: point(n).lng, address: `${pick(QUARTIERS, n)}, Douala` },
  destination: { lat: point(n + 3).lat, lng: point(n + 3).lng, address: 'Kribi centre' },
  rating: n % 3 === 0 ? { score: 5, comment: 'Véhicule impeccable, chauffeur ponctuel.', created_at: iso(-1) } : null,
  history: [
    { uuid: uuid(1500 + n), from_status: null, to_status: 'EN_ATTENTE_PAIEMENT', reason: null, position: null, created_at: iso(-2, -6) },
    { uuid: uuid(1510 + n), from_status: 'EN_ATTENTE_PAIEMENT', to_status: 'CONFIRMEE', reason: 'Acompte reçu', position: null, created_at: iso(-2, -4) },
    { uuid: uuid(1520 + n), from_status: 'CONFIRMEE', to_status: 'PLANIFIEE', reason: 'Chauffeur affecté', position: null, created_at: iso(-1, -2) },
  ],
});

const vehicle = (n) => ({
  id: 3100 + n,
  uuid: uuid(1100 + n),
  partner_id: 42,
  registration: `LT ${300 + n} AB`,
  brand: pick(['Toyota', 'Mercedes', 'Isuzu', 'Hyundai', 'Suzuki'], n),
  model: pick(['Hilux', 'Actros', 'NPR', 'H1', 'Swift'], n),
  year: 2018 + (n % 7),
  vehicle_type: pick(['CAMIONNETTE', 'VOITURE', 'MOTO', 'CAMION', 'TRICYCLE'], n),
  category: pick(['UTILITAIRE', 'PREMIUM', 'STANDARD'], n),
  license_category: pick(['B', 'C', 'A'], n),
  color: pick(['Blanc', 'Gris', 'Bleu', 'Noir'], n),
  capacity_kg: 500 + n * 250,
  volume_liters: 2000 + n * 500,
  length_cm: 420, width_cm: 180, height_cm: 190, seats: 5,
  fuel: 'DIESEL', transmission: 'MANUELLE',
  mileage: 45000 + n * 1200,
  condition: 'BON',
  status: pick(['ACTIF', 'ACTIF', 'EN_MAINTENANCE', 'INDISPONIBLE', 'BROUILLON'], n),
  media: [],
  compliance_suspended: n % 9 === 8,
  created_at: iso(-300 + n * 5),
  updated_at: iso(-3, -n),
});

const ratePlan = (n) => ({
  id: 4100 + n,
  uuid: uuid(1200 + n),
  partner_id: 42,
  name: pick(['Tarif horaire standard', 'Forfait journée 8 h', 'Tarif kilométrique longues distances', 'Trajet Douala → Kribi'], n),
  mode: pick(['HORAIRE', 'JOURNALIER', 'KILOMETRIQUE', 'PAR_TRAJET', 'MIXTE'], n),
  version: 1 + (n % 2),
  active: n % 4 !== 3,
  parameters: {
    base_amount: 5000, duration_amount: 3000, kilometer_amount: 350, trip_amount: 45000,
    minimum_amount: 8000, driver_amount: 4000, handling_amount: 1000, fuel_amount: 6000,
    toll_amount: 2500, insurance_amount: 3000, waiting_hour_amount: 1500, discount_amount: 0,
    tax_bps: 1925, minimum_minutes: 60, maximum_minutes: 720, increment_minutes: 30, unit_minutes: 60,
    rounding: 'NEAREST', zone_amounts: [0, 2500],
  },
  created_at: iso(-120 + n * 4),
  updated_at: iso(-5, -n),
});

const courier = (n) => ({ ...driver(n), role: 'LIVREUR', roles: ['LIVREUR'], statut: pick(ACCOUNT_STATUSES, n) });

const withdrawal = (n) => ({
  uuid: uuid(1600 + n),
  livreur_id: 700 + n,
  partner_id: 42 + n,
  payout_account_uuid: uuid(1700 + n),
  amount_xaf: money(n, 25000),
  montant_xaf: money(n, 25000),
  numero_momo: `+237 6 77 ${44 + n} ${22 + n}`,
  statut: pick(['EN_ATTENTE', 'PAYE', 'REJETE', 'EN_COURS'], n),
  status: pick(['DEMANDEE', 'EN_VALIDATION', 'APPROUVEE', 'PAYEE', 'REJETEE'], n),
  operator_reference: n % 2 ? `MOMO-${20250 + n}` : null,
  reason: null,
  libreur_nom: `${pick(PRENOMS, n)} ${pick(NOMS, n)}`,
  demandee_le: iso(-20 + n),
  traitee_le: n % 3 ? iso(-18 + n) : null,
  motif_decision: null,
  created_at: iso(-20 + n),
  updated_at: iso(-2, -n),
});

const reconciliationPeriod = (n) => ({
  uuid: uuid(1800 + n),
  status: pick(['OUVERTE', 'CLOTUREE'], n),
  from: iso(-30 - n * 7), to: iso(-24 - n * 7),
  expected_amount_xaf: money(n, 1_850_000),
  statement_amount_xaf: money(n, 1_845_000),
  platform_amount_xaf: money(n, 1_850_000),
  gap_xaf: n % 2 ? 5000 : 0,
  gap_rate: n % 2 ? 0.0027 : 0,
  alert: n % 2 === 1,
  report_sha256: '3f7c9a1b2d4e5f60a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4',
  report_signature: 'MEUCIQDx',
  created_at: iso(-24 - n * 7),
  closed_at: n % 2 ? iso(-22 - n * 7) : null,
  discrepancies: [0, 1, 2].map((i) => ({
    uuid: uuid(1900 + n * 10 + i),
    channel: pick(['MTN_MOMO', 'ORANGE_MONEY', 'COD'], n + i),
    reference: `TRX-${88000 + n * 10 + i}`,
    platform_amount_xaf: money(n + i, 12000),
    statement_amount_xaf: money(n + i, 12000) - 500 * (i + 1),
    gap_xaf: 500 * (i + 1),
    nature: pick(['MONTANT_DIFFERENT', 'ABSENT_RELEVE', 'ABSENT_PLATEFORME'], i),
    suggested_action: pick(['REMBOURSEMENT', 'REGULARISATION', 'ENQUETE'], i),
    status: i === 0 ? 'OUVERT' : 'QUALIFIE',
    action: i === 0 ? null : 'REGULARISATION',
    resolution_reason: i === 0 ? null : 'Erreur de saisie opérateur, régularisée le lendemain.',
  })),
  next_cursor: null,
});

const setting = (n) => ({
  key: pick(['dispatch.rayon_vague_1_km', 'dispatch.rayon_vague_2_km', 'pricing.marge_urgence', 'wallet.plafond_retrait_xaf'], n),
  value: String(pick([3, 6, 1.25, 500000], n)),
  valeur: String(pick([3, 6, 1.25, 500000], n)),
  type: pick(['NOMBRE', 'TEXTE', 'BOOLEEN'], n),
  description: 'Paramètre opérationnel ajustable sans redéploiement.',
  updated_at: iso(-9 + n),
});

const zone = (n) => ({
  id: 5100 + n,
  nom: pick(['Bonanjo', 'Akwa', 'Bonapriso', 'Bastos', 'Makepe', 'Kribi centre'], n),
  ville: pick(VILLES, n),
  type: pick(['COUVERTURE', 'MAJORATION', 'DIFFICILE', 'INTERDITE'], n),
});

const pricingGrid = (n) => ({
  uuid: uuid(2000 + n),
  name: `DOUALA_2026_R${1 + n}`,
  city: pick(VILLES, n),
  status: pick(['BROUILLON', 'ACTIVE', 'ARCHIVEE'], n),
  base_fee_xaf: 1000 + n * 100,
  price_per_km_xaf: 250 + n * 10,
  price_per_minute_xaf: 40 + n,
  minimum_price_xaf: 1500 + n * 100,
  rounding_xaf: 100,
  active_from: n % 3 === 1 ? iso(-40 + n) : null,
  archived_at: n % 3 === 2 ? iso(-10 + n) : null,
  frais_prise_en_charge: 1000 + n * 100,
  tarif_km: 250 + n * 10,
  tarif_minute: 40 + n,
  prix_minimum: 1500 + n * 100,
  arrondi: 100,
  plafond_remise: 5000,
});

const commission = (n) => ({
  uuid: uuid(2100 + n),
  partner_uuid: n % 3 ? uuid(500 + n) : null,
  category_uuid: n % 2 ? uuid(600 + n) : null,
  version: 1 + (n % 3),
  basis_points: 1200 + n * 25,
  valid_from: iso(-90 + n),
  valid_to: null,
  reason: 'Révision trimestrielle des taux de commission.',
  created_at: iso(-90 + n),
});

const category = (n) => ({ uuid: uuid(600 + n), name: pick(['Transport', 'Location de véhicules', 'Transit'], n), nom: pick(['Transport', 'Location de véhicules', 'Transit'], n), slug: pick(['transport', 'location', 'transit'], n), active: n % 3 !== 2, actif: n % 3 !== 2 });

const vehicleType = (n) => ({ id: 6100 + n, code: pick(['MOTO', 'TRICYCLE', 'VOITURE', 'CAMIONNETTE', 'CAMION'], n), label: pick(['Moto', 'Tricycle', 'Voiture', 'Camionnette', 'Camion'], n), active: n % 4 !== 3 });

const offerStatusAction = () => ({ uuid: uuid(1000), status: 'EN_REVUE', statut: 'EN_REVUE' });

const movement = (n) => ({
  uuid: uuid(2200 + n),
  reference: `LED-${77000 + n}`,
  kind: pick(['BOOKING_SETTLEMENT', 'WITHDRAWAL', 'ADJUSTMENT', 'COMMISSION'], n),
  status: pick(['POSTED', 'PENDING', 'REVERSED'], n),
  booking_uuid: uuid(1300 + n),
  withdrawal_uuid: n % 3 === 0 ? uuid(1600 + n) : null,
  created_at: iso(-14 + n),
  entries: [
    { account: 'partner_available', amount_xaf: money(n, 12000) },
    { account: 'platform_commission', amount_xaf: -Math.round(money(n, 12000) * 0.12) },
  ],
});

const payoutAccount = (n) => ({
  uuid: uuid(1700 + n),
  provider: pick(['MTN_MOMO', 'ORANGE_MONEY', 'BANK'], n),
  account_last_four: String(1200 + n).slice(-4),
  holder_name: pick(ENTREPRISES, n),
  verified: n % 3 !== 2,
  created_at: iso(-120 + n * 6),
});

const position = (n) => ({
  uuid: uuid(300 + n),
  kind: n % 2 ? 'CHAUFFEUR' : 'LIVREUR',
  prenom: pick(PRENOMS, n),
  nom: pick(NOMS, n),
  telephone: `+237 6 77 ${30 + n} ${11 + n}`,
  matricule: `LVB-${1200 + n}`,
  vehicle_type: pick(['MOTO', 'CAMIONNETTE', 'VOITURE'], n),
  statut_operationnel: pick(DRIVER_OPS, n),
  lat: point(n).lat + (n % 5) * 0.004,
  lng: point(n).lng + (n % 5) * 0.004,
  position_updated_at: iso(0, -0.2),
});

const exportJob = (n) => ({
  uuid: uuid(2300 + n),
  requested_by: 1,
  resource: pick(['ORDERS', 'PAYMENTS', 'WITHDRAWALS'], n),
  ressource: pick(['ORDERS', 'PAYMENTS', 'WITHDRAWALS'], n),
  format: 'CSV',
  filters: {},
  status: 'PRET',
  statut: 'PRET',
  file_name: `export-${20260 + n}.csv`,
  rows: 1250 + n * 40,
  bytes: 245_760 + n * 2048,
  sha256: '9a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef',
  error_code: null,
  requested_at: iso(0, -3),
  completed_at: iso(0, -2),
  expires_at: iso(1),
  download_url: 'data:text/csv;base64,cmVmZXJlbmNlLHN0YXR1dApsdnYtMDAxLExJVlJFRQo=',
  status_url: '/v1/admin/exports/' + uuid(2300 + n),
  export_id: uuid(2300 + n),
  expire_le: iso(1),
});

const surveillanceAlert = (n) => ({
  id: `${3100 + n}`,
  type: pick(['COMMANDE_NON_AFFECTEE', 'SLA_DEPASSE', 'ECART_PROXIMITE', 'PLAFOND_COD_PROCHE', 'PAIEMENT_EN_ATTENTE', 'INCIDENT_CRITIQUE'], n),
  resource_type: pick(['Order', 'Driver', 'Payment'], n),
  resource_id: uuid(200 + n),
  severity: pick(['FAIBLE', 'MOYENNE', 'HAUTE', 'CRITIQUE'], n),
  message: pick([
    'Commande non affectée depuis plus de 15 minutes.',
    'Le créneau promis est dépassé pour cette livraison.',
    'Écart de proximité détecté entre le livreur et le point de ramassage.',
    'Le plafond COD du livreur est atteint à 92 %.',
  ], n),
  context: { ville: pick(VILLES, n) },
  acknowledgement: n % 3 === 0 ? { motif: 'Pris en charge par le superviseur.', acquitte_par: 'Superviseur', acquitte_le: iso(0, -1) } : null,
});

// ---------------------------------------------------------------------------
// composite payloads
// ---------------------------------------------------------------------------
const ME_UUID = uuid(0);

const me = {
  uuid: ME_UUID,
  telephone: '+237 6 51 23 45 67',
  email: 'admin@lvb.cm',
  nom: 'Ndongo',
  prenom: 'Victor',
  photo_url: null,
  langue: 'fr',
  statut: 'ACTIF',
  role: 'ADMIN',
  roles: ['ADMIN'],
};

const supervision = () => ({
  generated_at: iso(),
  limits: { drivers: 50, orders: 200 },
  daily_stats: { created: 183, delivered: 154, cancelled: 7 },
  drivers: Array.from({ length: 12 }, (_, n) => ({
    id: 700 + n, user_uuid: uuid(300 + n), matricule: `LVB-${1200 + n}`,
    account_status: 'ACTIF', operational_status: pick(DRIVER_OPS, n),
    cod_outstanding_xaf: money(n, 12000), cod_limit_xaf: 500000,
    position_updated_at: iso(0, -0.2), permit_expires_at: iso(200 + n), insurance_expire_at: iso(180 + n),
    insurance_expires_at: iso(180 + n),
    lat: point(n).lat, lng: point(n).lng,
    nom: pick(NOMS, n), prenom: pick(PRENOMS, n), telephone: `+237 6 77 ${30 + n} ${11 + n}`,
    vehicle_type: pick(['MOTO', 'CAMIONNETTE', 'VOITURE'], n),
  })),
  orders: Array.from({ length: 10 }, (_, n) => ({
    id: 5400 + n, uuid: uuid(200 + n), status: pick(ORDER_STATUSES.slice(0, 5), n),
    payment_method: pick(PAYMENT_METHODS, n), price_xaf: money(n, 2500),
    city: pick(VILLES, n), promised_at: iso(0, 4), created_at: iso(0, -(n + 1)),
    pickup: point(n), dropoff: point(n + 2), destinataire_nom: pick(NOMS, n + 1),
  })),
  payments_pending_over_10m: [0, 1, 2].map((n) => ({
    id: 8100 + n, uuid: uuid(2400 + n), order_id: 5400 + n, provider: pick(['MTN_MOMO', 'ORANGE_MONEY'], n),
    status: 'EN_ATTENTE', amount_xaf: money(n, 2500), initiated_at: iso(0, -(n + 1)),
  })),
  critical_incidents: [0, 1].map((n) => ({
    id: 9100 + n, driver_id: 700 + n, order_id: 5400 + n,
    type: pick(['ACCIDENT', 'PANNE', 'AGRESSION'], n), severity: 'CRITIQUE',
    description: 'Incident signalé par le livreur, en attente de traitement.',
    lat: point(n).lat, lng: point(n).lng, created_at: iso(0, -2),
  })),
  alerts: Array.from({ length: 7 }, (_, n) => surveillanceAlert(n)),
});

const kpiMeasurement = (n) => ({
  id: `KPI-${String(n + 1).padStart(3, '0')}`,
  label: pick([
    'Taux de livraison dans les délais', 'Délai médian de ramassage', 'Taux d’échec de livraison',
    'Commandes par livreur actif', 'Taux de conversion devis → commande', 'Marge brute par course',
    'Taux de réclamation', 'Coût moyen par livraison', 'Taux d’acceptation livreur',
  ], n),
  category: pick(['operations', 'finance', 'qualite', 'support'], n),
  value: Math.round((20 + n * 7.35) * 100) / 100,
  unit: pick(['min', '%', 'XAF', 'count'], n),
  status: pick(['OK', 'WARNING', 'ALERT', 'MEASURED', 'NO_DATA'], n),
  source_event_count: 120 + n * 13,
  formula: 'sum(events)/count(events)',
  frequency: pick(['quotidien', 'hebdomadaire', 'temps réel'], n),
  target: pick(['≥ 92 %', '≤ 30 min', '≥ 4,5'], n),
  alert_threshold: pick(['< 90 %', '> 45 min'], n),
  source_events: ['order.delivered', 'order.created'],
});

const kpiDashboard = () => ({
  day: new Date().toISOString().slice(0, 10),
  catalog_version: 'v2026.10',
  instrumented_kpis: 9,
  measurements: Array.from({ length: 9 }, (_, n) => kpiMeasurement(n)),
});

const partnerDashboard = () => ({
  periode: { from: iso(-30).slice(0, 10), to: iso().slice(0, 10) },
  commandes: { creees: 268, en_cours: 41, livrees: 219, annulees: 8, taux_livraison_delai: 93.4 },
  finance: {
    devise: 'XAF', total_paye_xaf: 4_820_000, total_rembourse_xaf: 120_000, net_paye_xaf: 4_700_000,
    paiements_reussis: 246, paiements_echoues: 9, commissions_xaf: 578_400,
    commissions_disponibilite: 'disponible', base_periode_paiements: 'date de paiement',
    base_remboursements: 'date de remboursement', perimetre_paiements: 'commandes payées en ligne',
    transactions_non_attribuables: 3, encaisse_cod_xaf: 1_260_000, livraisons_cod_encaissees: 88,
    base_periode_cod: 'date de livraison', total_facture_xaf: 5_040_000,
    base_periode_facturation: 'date de création', periode: { from: iso(-30).slice(0, 10), to: iso().slice(0, 10) },
  },
  qualite: {
    taux_reclamation: 1.8, reclamations_ouvertes: 4, note_moyenne: 4.6, nombre_evaluations: 132,
    incidents_ouverts: 1, incidents_disponibilite: 'disponible',
  },
  activite: {
    volumes: { j: 12, j_7: 78, j_30: 268 },
    principales_villes: [
      { ville: 'Douala', commandes: 168 }, { ville: 'Yaoundé', commandes: 62 }, { ville: 'Kribi', commandes: 38 },
    ],
    zones_depart: null, zones_arrivee: null, zones_disponibilite: 'indisponible',
  },
  alertes: [
    { type: 'RECLAMATION_OUVERTE', nombre: 4 },
    { type: 'PAIEMENT_ECHOUE', nombre: 9 },
    { type: 'DOCUMENT_EXPIRANT', document_uuid: uuid(700), type_document: 'ASSURANCE', expire_le: iso(21) },
  ],
});

const partnerFinance = () => ({
  devise: 'XAF', total_facture_xaf: 5_040_000, total_paye_xaf: 4_820_000, total_rembourse_xaf: 120_000,
  net_paye_xaf: 4_700_000, paiements_reussis: 246, paiements_echoues: 9, encaisse_cod_xaf: 1_260_000,
  livraisons_cod_encaissees: 88, commissions_xaf: 578_400, periode: { from: iso(-30).slice(0, 10), to: iso().slice(0, 10) },
});

const partnerWallet = () => ({
  currency: 'XAF', devise: 'XAF',
  solde_en_attente: 320_000, solde_disponible: 1_180_000, solde_bloque: 45_000,
  retraits_en_cours: 150_000, total_gagne: 6_940_000, total_retire: 5_245_000,
});

const fleetCalendar = () => ({
  unavailability: [0, 1, 2].map((n) => ({
    uuid: uuid(2500 + n),
    vehicle_uuid: n % 2 ? null : uuid(1100 + n),
    driver_uuid: n % 2 ? uuid(300 + n) : null,
    starts_at: iso(n + 1, 7), ends_at: iso(n + 2, 18),
    reason: pick(['Entretien périodique', 'Congés annuels', 'Réparation carrosserie'], n),
    kind: pick(['MAINTENANCE', 'CONGE', 'MANUEL'], n),
  })),
  bookings: {
    items: [0, 1, 2, 3].map((n) => ({
      uuid: uuid(1300 + n), vehicle_uuid: uuid(1100 + n), driver_uuid: n % 2 ? uuid(300 + n) : null,
      starts_at: iso(n + 2, 8), ends_at: iso(n + 3, 17),
      status: n % 2 ? 'RESERVED' : 'HOLD', expires_at: iso(0, 6),
    })),
  },
});

const consoleSearch = () => ({
  clients: [0, 1, 2].map((n) => ({ id: 900 + n, nom: pick(NOMS, n), prenom: pick(PRENOMS, n), telephone: `+237 6 51 ${20 + n} ${30 + n}` })),
  commandes: [0, 1, 2].map((n) => ({ id: 5400 + n, uuid: uuid(200 + n), statut: pick(ORDER_STATUSES.slice(0, 5), n), destinataire_nom: pick(NOMS, n + 1) })),
});

const rbac = () => ({
  permissions: [
    'orders.view', 'orders.assign', 'users.view', 'users.manage', 'partners.view', 'partners.validate',
    'drivers.view', 'drivers.kyc.review', 'marketplace.manage', 'wallet.manage', 'finance.reconcile',
    'analytics.view', 'settings.manage', 'audit.view', 'roles.manage', 'supervision.view', 'claims.arbitrate',
  ],
  roles: [
    { id: 1, name: 'SUPER_ADMIN', permissions: ['orders.view', 'users.manage', 'partners.validate', 'analytics.view', 'settings.manage'], users_count: 2 },
    { id: 2, name: 'SUPERVISEUR', permissions: ['orders.view', 'orders.assign', 'supervision.view', 'drivers.view'], users_count: 4 },
    { id: 3, name: 'FINANCE', permissions: ['wallet.manage', 'finance.reconcile', 'analytics.view'], users_count: 2 },
    { id: 4, name: 'SUPPORT_N1', permissions: ['orders.view', 'users.view'], users_count: 7 },
    { id: 5, name: 'AUDITEUR', permissions: ['audit.view', 'analytics.view'], users_count: 1 },
    { id: 6, name: 'STAGIAIRE', permissions: ['orders.view'], users_count: 0 },
  ],
});

const partnerReconciliation = () => ({
  balanced: false,
  unbalanced_journals: [1042, 1087],
  settlement_mismatches: [0, 1].map((n) => ({ booking_uuid: uuid(1300 + n), expected_xaf: money(n, 45000), actual_xaf: money(n, 45000) - 2500 })),
  missing_payout_journals: [uuid(1600), uuid(1601)],
  settlements: [0, 1, 2, 3].map((n) => ({
    booking_uuid: uuid(1300 + n), payment_uuid: uuid(2400 + n), amount_xaf: money(n, 45000),
    commission_xaf: Math.round(money(n, 45000) * 0.12), payment_fee_xaf: 500,
    partner_income_xaf: money(n, 45000) - Math.round(money(n, 45000) * 0.12) - 500,
    bucket: pick(['pending', 'available', 'blocked', 'reversed'], n),
  })),
  generated_at: iso(0, -1),
});

const disputeDossier = (n) => ({
  complaint: { id: 4200 + n, uuid: uuid(2600 + n), category: 'RETARD_LIVRAISON', status: 'ESCALADEE', description: 'Colis livré avec 26 heures de retard, sans information du client.', client_id: 900 + n, opened_at: iso(-3) },
  order: {
    id: 5400 + n, uuid: uuid(200 + n), client_id: 900 + n, status: 'LIVREE', recipient_name: pick(NOMS, n),
    recipient_phone: `+237 6 51 ${20 + n} ${30 + n}`, price_xaf: money(n, 2500), payment_method: 'MTN_MOMO',
    created_at: iso(-3, -4), delivered_at: iso(-1, -2), promised_at: iso(-2, -4),
  },
  order_history: [
    { from: null, to: 'CREEE', actor_user_id: 1, at: iso(-3, -6), reason: null },
    { from: 'CREEE', to: 'AFFECTEE', actor_user_id: 2, at: iso(-3, -5), reason: 'Affectation manuelle' },
    { from: 'AFFECTEE', to: 'LIVREE', actor_user_id: 3, at: iso(-1, -2), reason: null },
  ],
  assignment: { driver_uuid: uuid(300), assigned_at: iso(-3, -5), mode: 'MANUEL' },
  pod: { signature: true, photo: true, delivered_at: iso(-1, -2) },
  incidents: [],
  trajectory: { positions: [], truncated: false },
  exchanges: {
    complaint_statement: 'Le client indique avoir attendu toute la journée du 11.',
    attachments: [
      { name: 'photo-colis.jpg', mime_type: 'image/jpeg', size_bytes: 245_760, sha256: 'ab12cd34', temporary_url: 'data:image/png;base64,iVBORw0KGgo=' },
    ],
    masked_calls: [{ call_id: 'CALL-88213', mode: 'APPEL_MASQUE_CLIENT', provider_reference: 'REF-9912', initiated_at: iso(-2, -3) }],
  },
  driver: {
    profile: { matricule: 'LVB-1203', nom: pick(NOMS, n), prenom: pick(PRENOMS, n), telephone: '+237 6 77 30 11' },
    quality: { score: 78.5 },
    sanctions: [{ uuid: uuid(2700 + n), type: 'AVERTISSEMENT', status: 'PROPOSEE', score: 78.5, reason: 'Retard répété sur la semaine.', proposed_at: iso(-2), contradiction: null, decision_reason: null, confirmed_at: null }],
  },
  arbitration: null,
  assembled_at: iso(0, -1),
});

const consoleActivity = () => ({ commandes_creees: 42, commandes_confirmees: 31, taux_conversion: 73.8 });

const operatingHours = () => ({
  resource_uuid: uuid(1100),
  configured: true,
  timezone: 'Africa/Douala',
  weekly_hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens_at: '08:00', closes_at: '18:00' })),
  exceptions: [{ date: iso(9).slice(0, 10), intervals: [] }],
  version: 3,
});

const quality = (n) => ({
  user_uuid: uuid(300 + n),
  account_status: 'ACTIF',
  score: 78.4,
  components: { rating: 0.92, acceptance: 0.81, on_time: 0.74, incidents: 0.66 },
  weights: { rating: 0.4, acceptance: 0.2, on_time: 0.25, incidents: 0.15 },
  thresholds: { warning_below: 85, temporary_suspension_below: 70, deactivation_review_below: 55 },
  recommendation: 'Deux retards signalés cette semaine — un rappel pédagogique suffit.',
});

const orderRoute = () => ({
  route_available: true,
  reason: null,
  target: 'delivery',
  distance_m: 8450,
  duration_seconds: 1320,
  eta_min_minutes: 20,
  eta_max_minutes: 28,
  geometry: { type: 'LineString', coordinates: [[9.7043, 4.0483], [9.7186, 4.0621]] },
});

// ---------------------------------------------------------------------------
// routing
// ---------------------------------------------------------------------------
const REGISTRY = {
  supervision, 'kpi-dashboard': kpiDashboard, rbac, 'partner/dashboard': partnerDashboard,
  'partner/finance/summary': partnerFinance, 'partner/wallet': partnerWallet,
  'partner/calendar': fleetCalendar, 'console/search': consoleSearch, 'console/activity': consoleActivity,
  'partner-wallet/reconciliation': partnerReconciliation, me,
};

/** Collection name → fixture builder, matched on the last path segment. */
const COLLECTIONS = [
  [/\/admin\/orders$/, order],
  [/\/partner\/orders$/, order],
  [/\/console\/orders$/, order],
  [/\/admin\/users$/, user],
  [/\/admin\/partners\/[^/]+\/documents$/, partnerDocument],
  [/\/admin\/partners\/[^/]+\/users$/, partnerMember],
  [/\/partner\/users$/, partnerMember],
  [/\/admin\/partners\/[^/]+\/change-requests$/, partnerChange],
  [/\/partner\/profile\/change-requests$/, partnerChange],
  [/\/admin\/partners\/[^/]+\/audit$/, auditEntry],
  [/\/admin\/partners$/, partner],
  [/\/admin\/partner-categories$/, category],
  [/\/admin\/audit$/, auditEntry],
  [/\/admin\/kyc$/, kycSummary],
  [/\/admin\/drivers$/, driver],
  [/\/partner\/drivers$/, driver],
  [/\/partner\/couriers$/, courier],
  [/\/admin\/marketplace\/offers$/, offer],
  [/\/admin\/rate-plans$/, ratePlan],
  [/\/partner\/rate-plans$/, ratePlan],
  [/\/marketplace\/offers$/, offer],
  [/\/partner\/offers$/, offer],
  [/\/marketplace\/bookings$/, booking],
  [/\/partner\/bookings$/, booking],
  [/\/marketplace\/vehicles$/, vehicle],
  [/\/partner\/vehicles$/, vehicle],
  [/\/marketplace\/drivers$/, driver],
  [/\/marketplace\/commissions$/, commission],
  [/\/marketplace\/vehicle-types$/, vehicleType],
  [/\/marketplace\/categories$/, category],
  [/\/admin\/withdrawals$/, withdrawal],
  [/\/admin\/partner-wallet\/withdrawals$/, withdrawal],
  [/\/partner\/wallet\/withdrawals$/, withdrawal],
  [/\/partner\/wallet\/payout-accounts$/, payoutAccount],
  [/\/partner\/wallet\/movements$/, movement],
  [/\/partner\/fleet\/positions$/, position],
  [/\/admin\/reconciliation$/, reconciliationPeriod],
  [/\/admin\/settings$/, setting],
  [/\/admin\/zones$/, zone],
  [/\/admin\/pricing-grids$/, pricingGrid],
  [/\/admin\/exports$/, exportJob],
  [/\/admin\/rbac\/roles$/, () => rbac().roles[0]],
  [/\/partner\/(vehicles|drivers)\/[^/]+\/documents$/, partnerDocument],
  [/\/partner\/documents$/, partnerDocument],
  [/\/partner\/(vehicles|drivers)\/[^/]+\/authorizations$/, (n) => ({ authorization_uuid: uuid(2800 + n), vehicle_uuid: uuid(1100 + n), registration: `LT ${300 + n} AB`, category: null, brand: 'Toyota', model: 'Hilux', from: iso(-30), until: null })],
  [/\/console\/reminders$/, (n) => ({ id: 6100 + n, client_id: 900 + n, commande_id: 5400 + n, echeance: iso(1, n), notes: pick(['Rappeler le client pour confirmation', 'Relancer pour le paiement COD', 'Vérifier l’adresse de livraison'], n) })],
];

/** Single-object endpoints keyed by a path substring (checked before collections). */
const SINGLES = [
  [/\/admin\/supervision$/, supervision],
  [/\/admin\/kpi-dashboard$/, kpiDashboard],
  [/\/admin\/rbac$/, rbac],
  [/\/partner\/dashboard$/, partnerDashboard],
  [/\/partner\/finance\/summary$/, partnerFinance],
  [/\/partner\/wallet$/, partnerWallet],
  [/\/partner\/calendar$/, fleetCalendar],
  [/\/console\/search$/, consoleSearch],
  [/\/console\/activity$/, consoleActivity],
  [/\/admin\/partner-wallet\/reconciliation$/, partnerReconciliation],
  [/\/admin\/users\/[^/]+$/, (n) => user(n)],
  [/\/admin\/drivers\/[^/]+\/quality$/, quality],
  [/\/admin\/kyc\/[^/]+$/, kycDossier],
  [/\/admin\/drivers\/[^/]+$/, driver],
  [/\/partner\/wallet\/withdrawals\/[^/]+$/, withdrawal],
  [/\/admin\/partners\/[^/]+$/, (n) => partner(n)],
  [/\/partner\/profile$/, () => ({ ...partner(0), statut_partenaire: 'ACTIF', raison_sociale: 'DOUALA EXPRESS SARL', numero_contribuable: 'M0712345CD', rccm: 'RC/DLA/2026/B/12000', responsable_nom: 'Victor Ndongo' })],
  [/\/admin\/orders\/[^/]+$/, order],
  [/\/partner\/orders\/[^/]+$/, (n) => ({ ...order(n), suivi: order(n).suivi, reclamations: order(n).reclamations, recu_disponible: true })],
  [/\/console\/orders\/[^/]+$/, (n) => ({ commande_id: uuid(200 + n), statut: 'AFFECTEE', destinataire_nom: pick(NOMS, n), destinataire_telephone: `+237 6 51 20 30`, prix_final: money(n, 2500), echeance_promise: iso(0, 4), historique: [{ ancien_statut: null, nouveau_statut: 'CREEE', auteur_utilisateur_id: 1, horodatage: iso(0, -5), motif: null }, { ancien_statut: 'CREEE', nouveau_statut: 'AFFECTEE', auteur_utilisateur_id: 2, horodatage: iso(0, -4), motif: 'Affectation automatique' }] })],
  [/\/admin\/marketplace\/bookings\/[^/]+$/, booking],
  [/\/partner\/bookings\/[^/]+$/, booking],
  [/\/admin\/marketplace\/offers\/[^/]+\/status$/, offerStatusAction],
  [/\/admin\/marketplace\/offers\/[^/]+$/, offer],
  [/\/partner\/offers\/[^/]+$/, offer],
  [/\/admin\/marketplace\/vehicles\/[^/]+$/, vehicle],
  [/\/admin\/marketplace\/drivers\/[^/]+$/, driver],
  [/\/partner\/(vehicles|drivers)\/[^/]+$/, (n, path) => (path.includes('/vehicles/') ? vehicle(n) : driver(n))],
  [/\/partner\/(vehicles|drivers)\/[^/]+\/operating-hours$/, operatingHours],
  [/\/partner\/rate-plans\/[^/]+$/, ratePlan],
  [/\/partner\/couriers\/[^/]+$/, courier],
  [/\/admin\/reconciliation\/[^/]+$/, reconciliationPeriod],
  [/\/admin\/disputes\/[^/]+$/, disputeDossier],
  [/\/admin\/exports\/[^/]+$/, exportJob],
  [/\/admin\/settings\/[^/]+$/, (n, path) => {
    const key = decodeURIComponent(path.split('/').pop());
    return key === 'dispatch.rayon_vague_1_km'
      ? { cle: key, valeur: '3', key, value: '3', type: 'NOMBRE', description: 'Rayon de la première vague de dispatch (km).', updated_at: iso(-4) }
      : null; // unknown key → 404, which is the "create it" path in the UI
  }],
  [/\/partner\/(vehicles|drivers)\/[^/]+\/documents\/[^/]+\/download$/, (n) => ({ uuid: uuid(700 + n), kind: 'ASSURANCE', url: 'data:application/pdf;base64,JVBERi0xLjQK', expires_at: iso(1) })],
  [/\/admin\/partners\/[^/]+\/documents\/[^/]+\/download$/, () => ({ url: 'data:application/pdf;base64,JVBERi0xLjQK', expires_at: iso(1) })],
  [/\/partner\/documents\/[^/]+\/download$/, () => ({ url: 'data:application/pdf;base64,JVBERi0xLjQK', expires_at: iso(1) })],
  [/\/orders\/[^/]+\/route$/, orderRoute],
  [/\/profile\/sessions$/, () => [{ id: 1, appareilNom: 'Navigateur web', appareilModele: 'Chrome', ip: '41.202.219.14', derniereActiviteLe: { date: iso(), timezone_type: 3, timezone: 'UTC' }, estSessionCourante: true }, { id: 2, appareilNom: 'Application livreur', appareilModele: 'Android', ip: '41.202.219.88', derniereActiviteLe: { date: iso(-1), timezone_type: 3, timezone: 'UTC' }, estSessionCourante: false }]],
  [/\/notification-preferences$/, () => [{ category: 'TRANSACTIONNEL_CRITIQUE', enabled: true, can_disable: false }, { category: 'TRANSACTIONNEL', enabled: true, can_disable: true }, { category: 'SUPPORT', enabled: true, can_disable: true }, { category: 'MARKETING', enabled: false, can_disable: true }]],
];

const page = (items) => ({
  items,
  data: items,
  next_cursor: null,
  cursor: null,
  total: items.length,
  page: 1,
  page_size: items.length,
  meta: { per_page: items.length, next_cursor: null, previous_cursor: null },
});

const listFor = (path) => {
  for (const [re, build] of COLLECTIONS) if (re.test(path)) return page(Array.from({ length: 14 }, (_, n) => build(n)));
  return page([]);
};

const objectFor = (path) => {
  for (const [re, build] of SINGLES) {
    if (re.test(path)) {
      const value = build(0, path);
      if (value === null) return null; // explicit 404
      return value;
    }
  }
  return undefined;
};

const problem = (status, title, code, detail) => ({ type: 'about:blank', title, status, code, detail, request_id: 'mock' });

const session = () => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'Bearer',
  expires_in: 3600,
});

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------
const readBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    if (!raw) return resolve({});
    try { resolve(JSON.parse(raw)); } catch { resolve({}); }
  });
});

const json = (res, status, payload) => {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'cache-control': 'no-store',
  });
  res.end(body);
};

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  const method = (req.method ?? 'GET').toUpperCase();
  const body = method === 'GET' || method === 'DELETE' ? {} : await readBody(req);
  console.log(`${method} ${req.url}`);

  if (method === 'OPTIONS') return json(res, 204, undefined);
  if (!path.startsWith('/v1')) return json(res, 404, problem(404, 'Not found', 'ERR-4040', `No mock route for ${path}.`));

  const p = path.slice(3); // drop '/v1'

  // ---- auth -------------------------------------------------------------
  if (p === '/auth/login' || p === '/auth/login/mfa/verify' || p === '/auth/refresh') return json(res, 200, session());
  if (p === '/auth/logout') return json(res, 204, undefined);
  if (p === '/auth/password/request-reset' || p === '/auth/password/reset') return json(res, 200, { message: 'Instructions envoyées.' });
  if (p === '/me') return json(res, 200, me);

  // ---- writes -----------------------------------------------------------
  if (method !== 'GET') {
    if (/\/export\/?$/.test(p) || /\/exports$/.test(p)) return json(res, 202, { export_id: uuid(2300), statut: 'EN_PREPARATION', status: 'EN_PREPARATION', expire_le: iso(1), status_url: `/v1${p}/${uuid(2300)}` });
    if (/\/auth\/login/.test(p)) return json(res, 200, session());
    if (p === '/profile/delete') return json(res, 200, { message: 'Compte programmé pour suppression.' });
    if (p === '/profile/consent') return json(res, 200, { message: 'Consentement enregistré.' });
    if (p.endsWith('/simulate')) return json(res, 200, {
      currency: 'XAF', billed_minutes: 480, detail_calcul: { base: 5000, duration: 3000, fuel: 6000, driver: 4000, toll: 2500 },
      subtotal_amount: 20500, discount_amount: 1000, tax_amount: 3753, total_amount: 23253, commission_amount: 2790, partner_amount: 20463,
    });
    if (p === '/console/complaints') return json(res, 201, { reclamation_id: 4201 });
    if (p === '/console/reminders') return json(res, 201, { tache_id: 6101 });
    if (/\/admin\/drivers\/[^/]+\/approve$/.test(p)) return json(res, 200, { message: 'Livreur approuvé.', all_validated: true, any_rejected: false });
    if (/sanctions$/.test(p)) return json(res, 201, { sanction_id: uuid(2700), statut: 'PROPOSEE', delai_contradiction_jours: 7 });
    if (/\/decision$/.test(p) && p.includes('/disputes/')) return json(res, 200, { arbitrage_id: uuid(2900), statut: 'RENDUE' });
    if (/\/validate$/.test(p)) return json(res, 200, { message: 'Partenaire validé.' });
    if (/\/status$/.test(p) && p.includes('/offers/')) return json(res, 200, offerStatusAction());
    if (/\/users\/[^/]+\/role$/.test(p)) return json(res, 200, { uuid: uuid(800), partenaire_uuid: uuid(500), role: body.role ?? 'OPERATEUR_PARTENAIRE' });
    if (p === '/admin/rbac/roles') return json(res, 201, { message: 'Rôle créé.' });
    if (/\/admin\/rbac\/roles\/[^/]+$/.test(p)) return json(res, 200, { message: 'Permissions mises à jour.' });
    if (/\/admin\/rbac\/users\/[^/]+\/roles$/.test(p)) return json(res, 200, { message: 'Rôles affectés.' });
    if (p === '/admin/zones') return json(res, 201, { id: 5199 });
    if (p === '/admin/pricing-grids') return json(res, 201, { uuid: uuid(2099), status: 'BROUILLON' });
    if (/\/admin\/marketplace\/vehicle-types$/.test(p)) return json(res, 201, { id: 6199, code: body.code ?? 'MOTO', label: body.label ?? 'Moto', active: true });
    if (/\/admin\/marketplace\/categories$/.test(p)) return json(res, 201, category(9));
    if (/\/admin\/partner-categories$/.test(p)) return json(res, 201, category(9));
    if (/\/admin\/marketplace\/commissions$/.test(p)) return json(res, 201, commission(9));
    if (/\/admin\/marketplace\/offers\/[^/]+\/status$/.test(p)) return json(res, 200, offerStatusAction());
    if (/\/admin\/partners$/.test(p)) return json(res, 201, partner(9));
    if (/\/admin\/users$/.test(p)) return json(res, 201, user(9));
    if (/\/admin\/drivers$/.test(p)) return json(res, 201, driver(9));
    if (/\/partner\/couriers$/.test(p)) return json(res, 201, courier(9));
    if (/\/partner\/vehicles$/.test(p)) return json(res, 201, vehicle(9));
    if (/\/partner\/drivers$/.test(p)) return json(res, 201, driver(9));
    if (/\/partner\/offers$/.test(p)) return json(res, 201, offer(9));
    if (/\/partner\/rate-plans$/.test(p)) return json(res, 201, ratePlan(9));
    if (/\/partner\/(vehicles|drivers)\/[^/]+\/documents$/.test(p)) return json(res, 201, partnerDocument(9));
    if (/\/partner\/unavailability$/.test(p)) return json(res, 201, { uuid: uuid(2500), starts_at: body.starts_at ?? iso(1), ends_at: body.ends_at ?? iso(2) });
    if (/\/maintenance$/.test(p)) return json(res, 201, { uuid: uuid(2500), starts_at: iso(1), ends_at: iso(2) });
    if (/\/authorizations$/.test(p)) return json(res, 201, { uuid: uuid(2800), active: true });
    if (/\/partner\/profile\/change-requests$/.test(p)) return json(res, 201, { uuid: uuid(900), statut: 'EN_ATTENTE' });
    if (/\/partner\/wallet\/withdrawals$/.test(p)) return json(res, 201, withdrawal(9));
    if (/\/partner\/wallet\/payout-accounts$/.test(p)) return json(res, 201, payoutAccount(9));
    if (/\/admin\/partner-wallet\/[^/]+\/adjustments$/.test(p)) return json(res, 200, partnerWallet());
    return json(res, 200, { message: 'OK', statut: 'OK' });
  }

  // ---- reads ------------------------------------------------------------
  if (/\/profile\/sessions$/.test(p)) return json(res, 200, { data: objectFor(p) });
  if (/\/notification-preferences$/.test(p)) return json(res, 200, { items: objectFor(p), data: objectFor(p) });
  if (/\/admin\/zones$/.test(p)) return json(res, 200, { data: listFor(p).items, items: listFor(p).items });
  if (/\/console\/reminders$/.test(p)) return json(res, 200, { data: listFor(p).items, items: listFor(p).items });

  const single = objectFor(p);
  if (single === null) {
    return json(res, 404, problem(404, 'Ressource introuvable', 'ERR-4040', 'Cette clé n’existe pas encore — créez-la.'));
  }
  if (single !== undefined) return json(res, 200, single);

  if (p === '/admin/settings/' || /\/admin\/settings\/[^/]+$/.test(p)) return json(res, 404, problem(404, 'Paramètre introuvable', 'ERR-4040', 'Cette clé n’existe pas encore.'));

  return json(res, 200, listFor(p));
});

server.listen(PORT, HOST, () => {
  console.log(`LVB mock API listening on http://${HOST}:${PORT}/v1  (dev only — no auth, fake data)`);
});
