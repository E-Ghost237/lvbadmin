import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import {
  ReconciliationItemStatus, ReconciliationResolutionAction, ReconciliationStatus, UuidCursorPage, WithdrawalStatus,
} from '../models';

export interface AdminWithdrawal {
  uuid: string;
  livreur_id: number;
  montant_xaf: number;
  numero_momo: string;
  statut: WithdrawalStatus;
  demandee_le: string | null;
  traitee_le: string | null;
  motif_decision: string | null;
}

export interface ReconciliationPeriod {
  uuid: string;
  status: ReconciliationStatus;
  from: string;
  to: string;
  expected_amount_xaf: number;
  statement_amount_xaf: number;
  gap_xaf: number;
  gap_rate: number;
  alert: boolean;
  report_sha256: string | null;
  report_signature: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ReconciliationItem {
  uuid: string;
  channel: string;
  reference: string;
  platform_amount_xaf: number | null;
  statement_amount_xaf: number | null;
  gap_xaf: number;
  nature: string;
  suggested_action: string | null;
  status: ReconciliationItemStatus;
  action: string | null;
  resolution_reason: string | null;
}

export interface ReconciliationDetail extends ReconciliationPeriod {
  discrepancies: ReconciliationItem[];
  next_cursor: string | null;
}

/** UC-ADM-15/16 — /v1/admin/withdrawals, /v1/admin/reconciliation (Ledger module). */
@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listWithdrawals(opts: { status?: WithdrawalStatus; cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<AdminWithdrawal>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<AdminWithdrawal>>(`${this.baseUrl}/admin/withdrawals`, { params });
  }

  approveWithdrawal(uuid: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/withdrawals/${uuid}/approve`, {}, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  rejectWithdrawal(uuid: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/withdrawals/${uuid}/reject`, { reason }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  listReconciliationPeriods(opts: { status?: ReconciliationStatus; cursor?: string; limit?: number } = {}): Observable<UuidCursorPage<ReconciliationPeriod>> {
    const params: Record<string, string> = {};
    if (opts.status) params['status'] = opts.status;
    if (opts.cursor) params['cursor'] = opts.cursor;
    if (opts.limit) params['limit'] = String(opts.limit);
    return this.http.get<UuidCursorPage<ReconciliationPeriod>>(`${this.baseUrl}/admin/reconciliation`, { params });
  }

  getReconciliationPeriod(uuid: string, cursor?: string): Observable<ReconciliationDetail> {
    const params: Record<string, string> = cursor ? { cursor } : {};
    return this.http.get<ReconciliationDetail>(`${this.baseUrl}/admin/reconciliation/${uuid}`, { params });
  }

  resolveReconciliationItem(periodUuid: string, itemUuid: string, action: ReconciliationResolutionAction, reason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/reconciliation/${periodUuid}/items/${itemUuid}/resolve`, { action, reason }, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }

  closeReconciliationPeriod(uuid: string): Observable<ReconciliationPeriod> {
    return this.http.post<ReconciliationPeriod>(`${this.baseUrl}/admin/reconciliation/${uuid}/close`, {}, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
