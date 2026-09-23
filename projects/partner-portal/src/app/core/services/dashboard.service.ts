import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@lvb/http/api.config';
import { PartnerDashboard } from '../models';

/**
 * `GET /v1/partner/dashboard` — gated by `dashboard.read` (every partner
 * role has it, see PartnerRole::allows()). `from`/`to` are both optional
 * (`YYYY-MM-DD`); the backend defaults to a trailing 30-day window.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getDashboard(opts: { from?: string; to?: string } = {}): Observable<PartnerDashboard> {
    const params: Record<string, string> = {};
    if (opts.from) params['from'] = opts.from;
    if (opts.to) params['to'] = opts.to;
    return this.http.get<PartnerDashboard>(`${this.baseUrl}/partner/dashboard`, { params });
  }
}
