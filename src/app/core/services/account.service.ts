import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { NotificationCategory, NotificationPreference } from '../models/notification-preference.model';

export type ConsentType = 'MARKETING' | 'PARTAGE_POSITION';

/** UC-AUT-04/08/09 — /v1/profile/*, /v1/notification-preferences (Identity + Notifications modules). */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  notificationPreferences(): Observable<{ preferences: NotificationPreference[] }> {
    return this.http.get<{ preferences: NotificationPreference[] }>(`${this.baseUrl}/notification-preferences`);
  }

  updateNotificationPreference(categorie: NotificationCategory, enabled: boolean): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/notification-preferences/${categorie}`, { enabled });
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
