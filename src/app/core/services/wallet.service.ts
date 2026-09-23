import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import {
  PartnerWalletReconciliation, PartnerWalletSummary, PartnerWithdrawal, PartnerWithdrawalStatus,
  WalletAdjustmentKind, WithdrawalDecisionAction,
} from '../models';

/**
 * Admin side of the Partner Wallet / Ledger module (PartnerLedger,
 * LVB-CDC-MKT-RENT-2026-V1.0) — `/v1/admin/partner-wallet/*`. Gated by
 * `partner-wallet.view`/`.manage` + `FEATURE_PARTNER_WALLET`.
 *
 * There is no admin route to view a specific partner's live balance or
 * movement history — those exist only on the partner's own self-service API
 * (`/v1/partner/wallet/summary`, `.../movements`). The only balance an admin
 * ever sees here is the post-adjustment `PartnerWalletSummary` returned by
 * `adjust()`. The withdrawals list is capped server-side at the 100 most
 * recent rows, with no cursor and no partner filter.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listWithdrawals(status?: PartnerWithdrawalStatus): Observable<{ items: PartnerWithdrawal[] }> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<{ items: PartnerWithdrawal[] }>(`${this.baseUrl}/admin/partner-wallet/withdrawals`, { params });
  }

  /** `operatorReference` is only accepted (and required by the backend) for the `confirm` action. */
  decideWithdrawal(uuid: string, action: WithdrawalDecisionAction, reason: string, operatorReference?: string): Observable<PartnerWithdrawal> {
    const body: Record<string, unknown> = { action, reason };
    if (operatorReference) body['operator_reference'] = operatorReference;
    return this.http.post<PartnerWithdrawal>(`${this.baseUrl}/admin/partner-wallet/withdrawals/${uuid}/decision`, body, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  /** Four-eyes enforced server-side: the verifier must differ from whoever created the payout account. */
  verifyPayoutAccount(uuid: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/partner-wallet/payout-accounts/${uuid}/verify`, {}, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  /** Stateless, computed live from the ledger on every call — not a persisted batch run. */
  reconciliation(): Observable<PartnerWalletReconciliation> {
    return this.http.get<PartnerWalletReconciliation>(`${this.baseUrl}/admin/partner-wallet/reconciliation`);
  }

  /** `kind: 'penalty'` requires a negative `amountXaf` — enforced server-side (ERR-4742 otherwise). */
  adjust(partnerUuid: string, amountXaf: number, kind: WalletAdjustmentKind, reason: string): Observable<PartnerWalletSummary> {
    return this.http.post<PartnerWalletSummary>(`${this.baseUrl}/admin/partner-wallet/${partnerUuid}/adjustments`, {
      amount_xaf: amountXaf, kind, reason,
    }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
