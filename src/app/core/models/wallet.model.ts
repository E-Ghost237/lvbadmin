export type PartnerWithdrawalStatus =
  | 'DEMANDEE' | 'EN_VALIDATION' | 'APPROUVEE' | 'EN_PAIEMENT' | 'PAYEE' | 'REJETEE' | 'ECHEC_PAIEMENT' | 'ANNULEE';

export const PARTNER_WITHDRAWAL_STATUS_VALUES: PartnerWithdrawalStatus[] = [
  'DEMANDEE', 'EN_VALIDATION', 'APPROUVEE', 'EN_PAIEMENT', 'PAYEE', 'REJETEE', 'ECHEC_PAIEMENT', 'ANNULEE',
];

export type WithdrawalDecisionAction = 'review' | 'approve' | 'processing' | 'confirm' | 'reject' | 'cancel' | 'fail';

/**
 * WithdrawalStateMachine::transition() (PartnerLedger module,
 * LVB-CDC-MKT-RENT-2026-V1.0) — each action's target status is fixed by the
 * backend match expression; only the current status gates which actions are
 * legal to offer. `confirm` additionally requires `operator_reference` and a
 * four-eyes check (confirmer ≠ requester ≠ approver) enforced server-side.
 */
export const WITHDRAWAL_ACTIONS: Record<PartnerWithdrawalStatus, WithdrawalDecisionAction[]> = {
  DEMANDEE: ['review', 'reject', 'cancel'],
  EN_VALIDATION: ['approve', 'reject', 'cancel'],
  APPROUVEE: ['processing', 'reject'],
  EN_PAIEMENT: ['confirm', 'fail'],
  PAYEE: [],
  REJETEE: [],
  ANNULEE: [],
  ECHEC_PAIEMENT: [],
};

/**
 * Admin oversight view of a partner's withdrawal request — GET/POST
 * `/v1/admin/partner-wallet/withdrawals*`. The list has no partner filter
 * and no cursor server-side (capped at the 100 most recent).
 */
export interface PartnerWithdrawal {
  uuid: string;
  payout_account_uuid: string;
  amount_xaf: number;
  status: PartnerWithdrawalStatus;
  operator_reference: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export type WalletAdjustmentKind = 'adjustment' | 'penalty';

/**
 * Only ever seen by an admin as the response of a manual adjustment — there
 * is no admin route to fetch a partner's live balance on demand.
 */
export interface PartnerWalletSummary {
  currency: 'XAF';
  solde_en_attente: number;
  solde_disponible: number;
  solde_bloque: number;
  retraits_en_cours: number;
  total_gagne: number;
  total_retire: number;
}

export interface PartnerWalletSettlement {
  booking_uuid: string;
  payment_uuid: string | null;
  amount_xaf: number;
  commission_xaf: number;
  payment_fee_xaf: number;
  partner_income_xaf: number;
  bucket: 'pending' | 'available' | 'blocked' | 'reversed';
}

export interface PartnerWalletSettlementMismatch {
  booking_uuid: string;
  expected_xaf: number;
  actual_xaf: number;
}

/**
 * A stateless, on-demand report (`GET .../reconciliation`) computed live
 * from the ledger each call — not the OUVERTE/CLOTUREE batch + OUVERT/QUALIFIE
 * item pattern used by the base Finance reconciliation module; there's no
 * persisted run history here.
 */
export interface PartnerWalletReconciliation {
  balanced: boolean;
  unbalanced_journals: number[];
  settlement_mismatches: PartnerWalletSettlementMismatch[];
  missing_payout_journals: string[];
  settlements: PartnerWalletSettlement[];
  generated_at: string;
}
