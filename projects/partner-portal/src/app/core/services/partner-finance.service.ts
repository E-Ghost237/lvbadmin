import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@lvb/http/api.config';
import { DashboardFinance } from '../models';

/**
 * `/v1/partner/finance/*` (Ordering + Payments modules, partner-as-client).
 * `ModularPartnerReporting::finance()` calls the exact same
 * `financialData()` private method that feeds the dashboard's `finance`
 * block, so this reuses `DashboardFinance` verbatim rather than a second
 * copy of the same 17-field shape.
 */
@Injectable({ providedIn: 'root' })
export class PartnerFinanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getSummary(opts: { from?: string; to?: string } = {}): Observable<DashboardFinance> {
    const params: Record<string, string> = {};
    if (opts.from) params['from'] = opts.from;
    if (opts.to) params['to'] = opts.to;
    return this.http.get<DashboardFinance>(`${this.baseUrl}/partner/finance/summary`, { params });
  }

  exportCsv(opts: { from?: string; to?: string } = {}): Observable<Blob> {
    const params: Record<string, string> = {};
    if (opts.from) params['from'] = opts.from;
    if (opts.to) params['to'] = opts.to;
    return this.http.get(`${this.baseUrl}/partner/finance/export`, { params, responseType: 'blob' });
  }
}
