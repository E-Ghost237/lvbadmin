import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@lvb/http/api.config';
import { NotificationCategory, NotificationPreference } from '../models';

export type ConsentType = 'MARKETING' | 'PARTAGE_POSITION';

/**
 * `/v1/profile/*` + `/v1/notification-preferences` (Identity + Notifications
 * modules) — generic per-user account settings, distinct from
 * `/v1/partner/profile` (the partner ORG's profile, see PartnerProfileService).
 * Session management, password reset and the name/language patch already
 * live on the shared `AuthService` (`@lvb/auth/auth.service`) since they're
 * identical for every app; this service only covers what AuthService
 * doesn't.
 *
 * `GetNotificationPreferencesUseCase::handle()` returns a list of named
 * categories (`{category, enabled, can_disable}[]`), confirmed by reading
 * the current backend source directly — not a bare `Record<string, boolean>`.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  notificationPreferences(): Observable<{ preferences: NotificationPreference[] }> {
    return this.http.get<{ preferences: NotificationPreference[] }>(`${this.baseUrl}/notification-preferences`);
  }

  updateNotificationPreference(category: NotificationCategory, enabled: boolean): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/notification-preferences/${category}`, { enabled });
  }

  updateConsent(type: ConsentType, accepte: boolean): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/profile/consent`, { type, accepte });
  }

  exportData(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/profile/export`);
  }

  requestDeletion(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/profile/delete`, {});
  }
}
