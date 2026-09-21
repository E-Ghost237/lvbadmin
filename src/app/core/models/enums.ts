/**
 * Enumerations mirrored 1:1 from LVB-CDC-TECH-2026-V2.0 Annexe B and §7.
 * Values are kept identical (French, upper-snake-case) to the future API
 * wire format so this layer requires no translation when the real backend
 * lands — only the HTTP transport (mock -> HttpClient) changes.
 */

export type OrderStatus =
  | 'BROUILLON'
  | 'EN_ATTENTE_PAIEMENT'
  | 'PLANIFIEE'
  | 'EN_ATTENTE_AFFECTATION'
  | 'EN_ATTENTE_MANUELLE'
  | 'AFFECTEE'
  | 'EN_ROUTE_RAMASSAGE'
  | 'ARRIVE_RAMASSAGE'
  | 'COLIS_RECUPERE'
  | 'EN_LIVRAISON'
  | 'ARRIVE_LIVRAISON'
  | 'LIVREE'
  | 'ECHEC_RAMASSAGE'
  | 'ECHEC_LIVRAISON'
  | 'RETOUR_EXPEDITEUR'
  | 'RETOURNEE'
  | 'ANNULEE'
  | 'EXPIREE'
  | 'ECHEC_PAIEMENT'
  | 'INCIDENT'
  | 'EN_LITIGE';

export const ORDER_STATUS_VALUES: OrderStatus[] = [
  'BROUILLON', 'EN_ATTENTE_PAIEMENT', 'PLANIFIEE', 'EN_ATTENTE_AFFECTATION',
  'EN_ATTENTE_MANUELLE', 'AFFECTEE', 'EN_ROUTE_RAMASSAGE', 'ARRIVE_RAMASSAGE',
  'COLIS_RECUPERE', 'EN_LIVRAISON', 'ARRIVE_LIVRAISON', 'LIVREE',
  'ECHEC_RAMASSAGE', 'ECHEC_LIVRAISON', 'RETOUR_EXPEDITEUR', 'RETOURNEE',
  'ANNULEE', 'EXPIREE', 'ECHEC_PAIEMENT', 'INCIDENT', 'EN_LITIGE',
];

/** Statuses considered "active" (still executing) for supervision alerting (§5.7.1). */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'EN_ATTENTE_AFFECTATION', 'EN_ATTENTE_MANUELLE', 'AFFECTEE',
  'EN_ROUTE_RAMASSAGE', 'ARRIVE_RAMASSAGE', 'COLIS_RECUPERE',
  'EN_LIVRAISON', 'ARRIVE_LIVRAISON',
];

export type TransactionStatus =
  | 'INITIEE' | 'EN_ATTENTE' | 'REUSSIE' | 'ECHOUEE' | 'EXPIREE' | 'REMBOURSEE' | 'LITIGE';

export type TransactionType =
  | 'PAIEMENT' | 'REMBOURSEMENT' | 'VERSEMENT_LIVREUR' | 'REVERSEMENT_COD' | 'AJUSTEMENT';

export type PaymentProvider = 'MTN_MOMO' | 'ORANGE_MONEY' | 'PSP_CARTE' | 'INTERNE';

export type DriverOperationalStatus = 'HORS_LIGNE' | 'DISPONIBLE' | 'EN_MISSION' | 'PAUSE';

export type AccountStatus =
  | 'ACTIF' | 'EN_ATTENTE_VALIDATION' | 'DOSSIER_SOUMIS' | 'SUSPENDU' | 'SUSPENDU_DOCUMENT' | 'SUPPRIME';

export type IncidentType =
  | 'VEHICULE_PANNE' | 'ACCIDENT' | 'AGRESSION' | 'COLIS_ENDOMMAGE' | 'ADRESSE_INTROUVABLE'
  | 'DESTINATAIRE_ABSENT' | 'EXPEDITEUR_ABSENT' | 'COLIS_INTERDIT' | 'REFUS_DESTINATAIRE' | 'AUTRE';

export type IncidentGravity = 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';

export type CancellationReason =
  | 'ERREUR_ADRESSE' | 'ERREUR_COLIS' | 'PLUS_BESOIN' | 'TROP_CHER' | 'TROP_LONG'
  | 'LIVREUR_INJOIGNABLE' | 'AUTRE';

export type UrgencyLevel = 'STANDARD' | 'EXPRESS' | 'PLANIFIE';

export type PaymentMethod = 'MTN_MOMO' | 'ORANGE_MONEY' | 'CARTE' | 'COD' | 'COMPTE_DIFFERE' | 'AVOIR';

export type ParcelType = 'DOCUMENT' | 'PETIT' | 'STANDARD' | 'VOLUMINEUX' | 'FRAGILE' | 'ALIMENTAIRE';

export type OrderChannel = 'APP_CLIENT' | 'TELECONSEILLER' | 'API_PARTENAIRE' | 'WEB';

export type ZoneType = 'COUVERTURE' | 'INTERDITE' | 'MAJORATION' | 'DIFFICILE';

export type ClaimCategory =
  | 'RETARD' | 'COLIS_ENDOMMAGE' | 'COLIS_PERDU' | 'COMPORTEMENT' | 'FACTURATION' | 'AUTRE';

export type ClaimSeverity = 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';

export type ClaimStatus = 'OUVERTE' | 'EN_COURS' | 'ESCALADEE' | 'RESOLUE' | 'FERMEE';

export type VehicleType = 'MOTO' | 'TRICYCLE' | 'VOITURE' | 'CAMIONNETTE' | 'VELO' | 'PIETON';

export type ClientType = 'PARTICULIER' | 'ENTREPRISE';

export type WalletMovementSense = 'CREDIT' | 'DEBIT';

export type WalletMovementMotif =
  | 'REMUNERATION_COURSE' | 'BONUS' | 'PENALITE' | 'RETRAIT' | 'REVERSEMENT_COD'
  | 'AJUSTEMENT' | 'CORRECTION';

export type AuditActorType = 'CLIENT' | 'LIVREUR' | 'AGENT' | 'SYSTEME';

export type ReconciliationDomain = 'MOBILE_MONEY' | 'COD' | 'RETRAITS_LIVREURS';

export type ReconciliationGapKind =
  | 'PLATEFORME_SANS_OPERATEUR' | 'OPERATEUR_SANS_PLATEFORME' | 'ECART_MONTANT' | 'DOUBLON_SUSPECTE';

export type WithdrawalStatus = 'EN_ATTENTE' | 'EN_COURS' | 'PAYE' | 'REJETE' | 'ECHEC';

export type ReconciliationStatus = 'OUVERTE' | 'CLOTUREE';

export type ReconciliationItemStatus = 'OUVERT' | 'QUALIFIE';

export type ReconciliationResolutionAction = 'REMBOURSEMENT' | 'REGULARISATION' | 'ENQUETE';

export type Locale = 'fr' | 'en';

/**
 * Partner module (LVB-CDC-PART-2026-V1.0 §7, RG-PRT-002/003). A partner is a
 * specialization of an ENTREPRISE client, created explicitly by an admin —
 * it does not exist for every ENTREPRISE client automatically.
 *
 * Allowed transitions (RG-PRT-003): EN_ATTENTE_VALIDATION → VALIDE|SUSPENDU ;
 * VALIDE → ACTIF ; ACTIF ↔ SUSPENDU ; ACTIF|SUSPENDU → DESACTIVE ;
 * DESACTIVE → ARCHIVE. Any other transition is rejected server-side.
 * VALIDE is only reachable through the dedicated validate endpoint, never
 * through the generic status-change one (backend throws ERR-4038).
 */
export type PartnerStatus = 'EN_ATTENTE_VALIDATION' | 'VALIDE' | 'ACTIF' | 'SUSPENDU' | 'DESACTIVE' | 'ARCHIVE';

export type PartnerRole = 'RESPONSABLE_PARTENAIRE' | 'OPERATEUR_PARTENAIRE' | 'LECTEUR_PARTENAIRE';

export type PartnerDocumentType = 'RCCM' | 'FISCAL' | 'ID_RESPONSABLE' | 'CONTRAT_LVB' | 'AUTRE';

export type PartnerDocumentStatus = 'EN_ATTENTE' | 'VALIDE' | 'REJETE' | 'EXPIRE';

export type PartnerChangeStatus = 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE';
