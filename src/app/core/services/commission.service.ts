import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { CreateCommissionRuleRequest, PartnerCommissionRule } from '../models';

/**
 * Commission rule management (PartnerLedger module, LVB-CDC-MKT-RENT-2026-V1.0)
 * — `/v1/admin/marketplace/commissions`. Gated by `pricing.manage` (not
 * `partner-wallet.*`) + `FEATURE_PARTNER_WALLET`. List has no query params
 * and is capped server-side at the 500 most recent rules; there is no
 * update/delete route — rules are immutable and append-only (see model
 * docblock).
 */
@Injectable({ providedIn: 'root' })
export class CommissionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<{ items: PartnerCommissionRule[] }> {
    return this.http.get<{ items: PartnerCommissionRule[] }>(`${this.baseUrl}/admin/marketplace/commissions`);
  }

  create(req: CreateCommissionRuleRequest): Observable<PartnerCommissionRule> {
    return this.http.post<PartnerCommissionRule>(`${this.baseUrl}/admin/marketplace/commissions`, req, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
