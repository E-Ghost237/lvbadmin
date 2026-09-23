/**
 * `GET /v1/partner/wallet/movements` — a single ledger journal entry.
 * `entries` are the double-entry postings within that journal (e.g. a
 * booking credit debits `pending` and credits `available`). Not exposed on
 * the admin side at all — this is partner-only.
 */
export interface PartnerLedgerMovement {
  uuid: string;
  reference: string;
  kind: string;
  status: 'PENDING' | 'POSTED' | 'REVERSED';
  booking_uuid: string | null;
  withdrawal_uuid: string | null;
  created_at: string;
  entries: { account: string; amount_xaf: number }[];
}

export type PayoutProvider = 'MTN_MOMO' | 'ORANGE_MONEY' | 'BANK';

/**
 * `GET/POST /v1/partner/wallet/payout-accounts` — the raw account number is
 * never returned once stored (`account_encrypted` server-side); only the
 * last 4 digits and `verified` (set by an admin via
 * `POST /v1/admin/partner-wallet/payout-accounts/{uuid}/verify`) come back.
 * A withdrawal can only target a `verified: true` account.
 */
export interface PartnerPayoutAccount {
  uuid: string;
  provider: PayoutProvider;
  account_last_four: string;
  holder_name: string;
  verified: boolean;
  created_at: string;
}

export interface CreatePayoutAccountRequest {
  provider: PayoutProvider;
  account_number: string;
  holder_name: string;
}

/** `min:1000`/`max:1000000` XAF are enforced server-side (`assertWithdrawal`), not just documented here. */
export interface RequestWithdrawalRequest {
  payout_account_uuid: string;
  amount_xaf: number;
}
