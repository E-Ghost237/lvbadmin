import { Injectable, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { AppNotification, SupervisionAlert } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk } from '../mock/mock-utils';
import { AuthService } from '../auth/auth.service';

/** UC-ADM-01 (files d'alerte, acquittement tracé) + centre de notifications personnel. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  readonly alerts = computed<SupervisionAlert[]>(() => this.db.alerts());
  readonly criticalUnacknowledgedCount = computed(() => this.alerts().filter((a) => !a.acquittee && a.gravite === 'CRITIQUE').length);

  readonly notifications = computed<AppNotification[]>(() => this.db.notifications());
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.lue).length);

  constructor(private readonly db: MockDbService, private readonly auth: AuthService) {}

  /** "Chaque alerte DOIT être acquittable avec un motif" (§5.7.1). */
  acknowledgeAlert(alertId: string, motif: string): Observable<{ ok: true }> {
    if (!motif.trim()) return mockFail('ERR-4001', 'Un motif d’acquittement est obligatoire.');
    const actor = this.auth.currentUser();
    this.db.mutate((s) => {
      s.acknowledgedAlerts[alertId] = { par: actor ? `${actor.prenom} ${actor.nom}` : 'Agent', motif, le: new Date().toISOString() };
      return s;
    });
    return mockOk({ ok: true as const }, 250);
  }

  markNotificationRead(id: string): void {
    this.db.mutate((s) => {
      s.notifications = s.notifications.map((n) => (n.id === id ? { ...n, lue: true } : n));
      return s;
    });
  }

  markAllNotificationsRead(): void {
    this.db.mutate((s) => {
      s.notifications = s.notifications.map((n) => ({ ...n, lue: true }));
      return s;
    });
  }
}
