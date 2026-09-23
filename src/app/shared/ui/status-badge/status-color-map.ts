export type StatusTone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral' | 'info';

const ORDER_TONE: Record<string, StatusTone> = {
  BROUILLON: 'neutral', EN_ATTENTE_PAIEMENT: 'warning', PLANIFIEE: 'info',
  EN_ATTENTE_AFFECTATION: 'warning', EN_ATTENTE_MANUELLE: 'serious', AFFECTEE: 'info',
  EN_ROUTE_RAMASSAGE: 'info', ARRIVE_RAMASSAGE: 'info', COLIS_RECUPERE: 'info',
  EN_LIVRAISON: 'info', ARRIVE_LIVRAISON: 'info', LIVREE: 'good',
  ECHEC_RAMASSAGE: 'critical', ECHEC_LIVRAISON: 'critical', RETOUR_EXPEDITEUR: 'serious',
  RETOURNEE: 'neutral', ANNULEE: 'neutral', EXPIREE: 'neutral',
  ECHEC_PAIEMENT: 'critical', INCIDENT: 'serious', EN_LITIGE: 'serious',
};

const DRIVER_OP_TONE: Record<string, StatusTone> = {
  HORS_LIGNE: 'neutral', DISPONIBLE: 'good', EN_MISSION: 'info', PAUSE: 'warning',
};

const ACCOUNT_TONE: Record<string, StatusTone> = {
  ACTIF: 'good', EN_ATTENTE_VALIDATION: 'warning', DOSSIER_SOUMIS: 'warning',
  SUSPENDU: 'critical', SUSPENDU_DOCUMENT: 'critical', SUPPRIME: 'neutral',
};

const CLAIM_TONE: Record<string, StatusTone> = {
  OUVERTE: 'warning', EN_COURS: 'info', ESCALADEE: 'serious', RESOLUE: 'good', FERMEE: 'neutral',
};

const TRANSACTION_TONE: Record<string, StatusTone> = {
  INITIEE: 'neutral', EN_ATTENTE: 'warning', REUSSIE: 'good', ECHOUEE: 'critical',
  EXPIREE: 'neutral', REMBOURSEE: 'info', LITIGE: 'serious',
};

const WITHDRAWAL_TONE: Record<string, StatusTone> = {
  EN_ATTENTE: 'warning', EN_COURS: 'info', PAYE: 'good', REJETE: 'critical', ECHEC: 'critical',
};

const RECONCILIATION_TONE: Record<string, StatusTone> = {
  OUVERTE: 'warning', CLOTUREE: 'good',
};

const RECONCILIATION_ITEM_TONE: Record<string, StatusTone> = {
  OUVERT: 'warning', QUALIFIE: 'good',
};

const GRAVITY_TONE: Record<string, StatusTone> = {
  FAIBLE: 'neutral', MOYENNE: 'info', HAUTE: 'serious', CRITIQUE: 'critical',
};

/** RG-PRT-002/003 — EN_ATTENTE_VALIDATION → VALIDE|SUSPENDU ; VALIDE → ACTIF ; ACTIF ↔ SUSPENDU ; ACTIF|SUSPENDU → DESACTIVE ; DESACTIVE → ARCHIVE. */
const PARTNER_TONE: Record<string, StatusTone> = {
  EN_ATTENTE_VALIDATION: 'warning', VALIDE: 'info', ACTIF: 'good', SUSPENDU: 'critical',
  DESACTIVE: 'neutral', ARCHIVE: 'neutral',
};

const PARTNER_DOCUMENT_TONE: Record<string, StatusTone> = {
  EN_ATTENTE: 'warning', VALIDE: 'good', REJETE: 'critical', EXPIRE: 'neutral',
};

const PARTNER_CHANGE_TONE: Record<string, StatusTone> = {
  EN_ATTENTE: 'warning', APPROUVEE: 'good', REJETEE: 'critical',
};

/** OfferPublication::TRANSITIONS (LVB-CDC-MKT-RENT-2026-V1.0 §7.3) — BROUILLON→EN_REVUE→PUBLIEE↔SUSPENDUE→ARCHIVEE, or REJETEE. */
const MARKETPLACE_OFFER_TONE: Record<string, StatusTone> = {
  BROUILLON: 'neutral', EN_REVUE: 'warning', PUBLIEE: 'good', SUSPENDUE: 'critical',
  ARCHIVEE: 'neutral', REJETEE: 'critical',
};

/** §9.3 — a partner's rental vehicle (distinct from an LVB delivery order). */
const RENTAL_VEHICLE_TONE: Record<string, StatusTone> = {
  BROUILLON: 'neutral', ACTIF: 'good', INDISPONIBLE: 'warning', EN_MAINTENANCE: 'warning',
  SUSPENDU: 'critical', ARCHIVE: 'neutral',
};

/** §10.2 — a partner's own rental driver (distinct from an LVB delivery driver / `driverOp`). */
const RENTAL_DRIVER_TONE: Record<string, StatusTone> = {
  EN_ATTENTE_VALIDATION: 'warning', ACTIF: 'good', INDISPONIBLE: 'warning', EN_CONGE: 'info',
  SUSPENDU: 'critical', ARCHIVE: 'neutral',
};

/** RGRNT030BookingTransition::TRANSITIONS (LVB-CDC-MKT-RENT-2026-V1.0) — the reservation lifecycle. */
const BOOKING_TONE: Record<string, StatusTone> = {
  EN_ATTENTE_PAIEMENT: 'warning', EN_ATTENTE_CONFIRMATION: 'warning', CONFIRMEE: 'info',
  EN_ATTENTE_AFFECTATION: 'warning', PLANIFIEE: 'info', EN_ROUTE: 'info', PRESTATION_EN_COURS: 'info',
  TERMINEE: 'good', ANNULEE: 'neutral', REJETEE: 'critical', EXPIREE: 'neutral', ECHEC_PAIEMENT: 'critical',
};

/** Independent of `status` — a booking's payment lifecycle. */
const BOOKING_PAYMENT_TONE: Record<string, StatusTone> = {
  PENDING: 'warning', PAID: 'good', FAILED: 'critical',
  REFUND_PENDING: 'warning', REFUNDED: 'info', PARTIALLY_REFUNDED: 'info',
};

/** Independent two-state flag — `null` (no dispute) is not rendered as a badge. */
const BOOKING_DISPUTE_TONE: Record<string, StatusTone> = {
  OPEN: 'serious', RESOLVED: 'good',
};

/** WithdrawalStateMachine (PartnerLedger, LVB-CDC-MKT-RENT-2026-V1.0) — distinct from the base Finance `withdrawal` enum/tone map. */
const PARTNER_WITHDRAWAL_TONE: Record<string, StatusTone> = {
  DEMANDEE: 'warning', EN_VALIDATION: 'warning', APPROUVEE: 'info', EN_PAIEMENT: 'info',
  PAYEE: 'good', REJETEE: 'critical', ANNULEE: 'neutral', ECHEC_PAIEMENT: 'critical',
};

export type StatusDomain =
  | 'order' | 'driverOp' | 'account' | 'claim' | 'transaction' | 'withdrawal' | 'gravity'
  | 'reconciliation' | 'reconciliationItem' | 'partner' | 'partnerDocument' | 'partnerChange'
  | 'marketplaceOffer' | 'rentalVehicle' | 'rentalDriver' | 'booking' | 'bookingPayment' | 'bookingDispute'
  | 'partnerWithdrawal';

const DOMAIN_MAPS: Record<StatusDomain, Record<string, StatusTone>> = {
  order: ORDER_TONE, driverOp: DRIVER_OP_TONE, account: ACCOUNT_TONE, claim: CLAIM_TONE,
  transaction: TRANSACTION_TONE, withdrawal: WITHDRAWAL_TONE, gravity: GRAVITY_TONE,
  reconciliation: RECONCILIATION_TONE, reconciliationItem: RECONCILIATION_ITEM_TONE,
  partner: PARTNER_TONE, partnerDocument: PARTNER_DOCUMENT_TONE, partnerChange: PARTNER_CHANGE_TONE,
  marketplaceOffer: MARKETPLACE_OFFER_TONE, rentalVehicle: RENTAL_VEHICLE_TONE, rentalDriver: RENTAL_DRIVER_TONE,
  booking: BOOKING_TONE, bookingPayment: BOOKING_PAYMENT_TONE, bookingDispute: BOOKING_DISPUTE_TONE,
  partnerWithdrawal: PARTNER_WITHDRAWAL_TONE,
};

const I18N_KEY_PREFIX: Record<StatusDomain, string> = {
  order: 'status.order', driverOp: 'status.driverOp', account: 'status.account', claim: 'status.claim',
  transaction: 'status.transaction', withdrawal: 'status.withdrawal', gravity: 'gravity',
  reconciliation: 'status.reconciliation', reconciliationItem: 'status.reconciliationItem',
  partner: 'status.partner', partnerDocument: 'status.partnerDocument', partnerChange: 'status.partnerChange',
  marketplaceOffer: 'status.marketplaceOffer', rentalVehicle: 'status.rentalVehicle', rentalDriver: 'status.rentalDriver',
  booking: 'status.booking', bookingPayment: 'status.bookingPayment', bookingDispute: 'status.bookingDispute',
  partnerWithdrawal: 'status.partnerWithdrawal',
};

export function toneFor(domain: StatusDomain, status: string): StatusTone {
  return DOMAIN_MAPS[domain]?.[status] ?? 'neutral';
}

export function i18nKeyFor(domain: StatusDomain, status: string): string {
  return `${I18N_KEY_PREFIX[domain]}.${status}`;
}
