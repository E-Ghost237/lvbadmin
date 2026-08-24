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

export type StatusDomain =
  | 'order' | 'driverOp' | 'account' | 'claim' | 'transaction' | 'withdrawal' | 'gravity'
  | 'reconciliation' | 'reconciliationItem';

const DOMAIN_MAPS: Record<StatusDomain, Record<string, StatusTone>> = {
  order: ORDER_TONE, driverOp: DRIVER_OP_TONE, account: ACCOUNT_TONE, claim: CLAIM_TONE,
  transaction: TRANSACTION_TONE, withdrawal: WITHDRAWAL_TONE, gravity: GRAVITY_TONE,
  reconciliation: RECONCILIATION_TONE, reconciliationItem: RECONCILIATION_ITEM_TONE,
};

const I18N_KEY_PREFIX: Record<StatusDomain, string> = {
  order: 'status.order', driverOp: 'status.driverOp', account: 'status.account', claim: 'status.claim',
  transaction: 'status.transaction', withdrawal: 'status.withdrawal', gravity: 'gravity',
  reconciliation: 'status.reconciliation', reconciliationItem: 'status.reconciliationItem',
};

export function toneFor(domain: StatusDomain, status: string): StatusTone {
  return DOMAIN_MAPS[domain]?.[status] ?? 'neutral';
}

export function i18nKeyFor(domain: StatusDomain, status: string): string {
  return `${I18N_KEY_PREFIX[domain]}.${status}`;
}
