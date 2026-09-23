import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '@lvb/http/api.config';
import { PartnerWalletSummary, PartnerWithdrawal } from '@lvb/models/wallet.model';
import { CreatePayoutAccountRequest, PartnerLedgerMovement, PartnerPayoutAccount, RequestWithdrawalRequest } from '../models';

/**
 * Partner self-service side of the Partner Wallet / Ledger module
 * (PartnerLedger, LVB-CDC-MKT-RENT-2026-V1.0) — `/v1/partner/wallet*`.
 * Gated by `wallet.read`/`wallet.withdraw` — RESPONSABLE_PARTENAIRE only,
 * nobody else in the org can see this section at all. `summary()` and the
 * withdrawal resource shape (`withdrawalView()`) are the exact same methods
 * the admin wallet screen reads, so `PartnerWalletSummary`/`PartnerWithdrawal`
 * are reused verbatim from `@lvb/models/wallet.model`. Movements and payout
 * accounts have no admin-side equivalent at all — new models here.
 *
 * `POST .../withdrawals` requires a non-empty `Idempotency-Key` as a hard
 * business rule (not just the generic idempotent middleware) — always sent
 * via `withIdempotencyKey()`.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getSummary(): Observable<PartnerWalletSummary> {
    return this.http.get<PartnerWalletSummary>(`${this.baseUrl}/partner/wallet`);
  }

  listMovements(opts: { cursor?: number; limit?: number } = {}): Observable<{ items: PartnerLedgerMovement[]; next_cursor: number | null }> {
    const params: Record<string, string> = {};
    if (opts.cursor) params['cursor'] = String(opts.cursor);
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<{ items: PartnerLedgerMovement[]; next_cursor: number | null }>(`${this.baseUrl}/partner/wallet/movements`, { params });
  }

  listPayoutAccounts(): Observable<{ items: PartnerPayoutAccount[] }> {
    return this.http.get<{ items: PartnerPayoutAccount[] }>(`${this.baseUrl}/partner/wallet/payout-accounts`);
  }

  createPayoutAccount(req: CreatePayoutAccountRequest): Observable<PartnerPayoutAccount> {
    return this.http.post<PartnerPayoutAccount>(`${this.baseUrl}/partner/wallet/payout-accounts`, req, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  listWithdrawals(): Observable<{ items: PartnerWithdrawal[] }> {
    return this.http.get<{ items: PartnerWithdrawal[] }>(`${this.baseUrl}/partner/wallet/withdrawals`);
  }

  requestWithdrawal(req: RequestWithdrawalRequest): Observable<PartnerWithdrawal> {
    return this.http.post<PartnerWithdrawal>(`${this.baseUrl}/partner/wallet/withdrawals`, req, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
