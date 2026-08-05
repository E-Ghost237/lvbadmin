import { Injectable, computed, signal } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { PermissionCode, Session, StaffUser } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockFail, mockOk, uid } from '../mock/mock-utils';
import { hasAnyPermission, hasPermission } from './rbac';

const SESSION_KEY = 'lvb.session';
const ACCESS_TTL_MIN = 15;
const REFRESH_TTL_DAYS = 30;

interface StoredSession {
  userId: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export type LoginStep = 'CREDENTIALS' | 'MFA';

/** Demo credential — every seeded staff account shares it so the console can be clicked through end to end. */
export const DEMO_PASSWORD = 'LvbDemo#2026';
export const DEMO_MFA_CODE = '123456';

/**
 * UC-AUT-02 (connexion) / UC-AUT-04 (profil) / UC-AUT-05 (récupération) /
 * UC-AUT-06 (sessions). Session state lives entirely client-side against the
 * mock database; the public method surface (`login`, `verifyMfa`, `refresh`,
 * `logout`, `sessions`, `revokeSession`) is what an `HttpClient`-backed
 * implementation will expose identically once §9.2.1 endpoints exist.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser = signal<StaffUser | null>(null);
  private readonly _pendingMfaUserId = signal<string | null>(null);
  private readonly _loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly pendingMfa = computed(() => this._pendingMfaUserId() !== null);

  constructor(private readonly db: MockDbService) {
    this.restoreSession();
  }

  private restoreSession(): void {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const stored: StoredSession = JSON.parse(raw);
      if (stored.refreshExpiresAt < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return;
      }
      const user = this.db.staff().find((s) => s.id === stored.userId);
      if (user) this._currentUser.set(user);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private persistSession(user: StaffUser): void {
    const session: StoredSession = {
      userId: user.id,
      accessToken: uid('tok', Math.random),
      accessExpiresAt: Date.now() + ACCESS_TTL_MIN * 60_000,
      refreshToken: uid('rtok', Math.random),
      refreshExpiresAt: Date.now() + REFRESH_TTL_DAYS * 86_400_000,
    };
    if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  get accessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as StoredSession).accessToken;
    } catch {
      return null;
    }
  }

  /** SEC — E3: 5 attempts then progressive lockout (1 min, 5 min, 30 min). */
  login(email: string, password: string): Observable<{ step: LoginStep }> {
    const key = email.trim().toLowerCase();
    const attempt = this._loginAttempts.get(key);
    if (attempt && attempt.lockedUntil > Date.now()) {
      const seconds = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
      return mockFail('ERR-4291', `Compte temporairement verrouillé. Réessayez dans ${seconds}s.`);
    }

    const user = this.db.staff().find((s) => s.email?.toLowerCase() === key);
    const valid = !!user && password === DEMO_PASSWORD && user.statut === 'ACTIF';

    if (!valid) {
      const nextCount = (attempt?.count ?? 0) + 1;
      const lockMinutes = nextCount >= 5 ? 30 : nextCount >= 4 ? 5 : nextCount >= 3 ? 1 : 0;
      this._loginAttempts.set(key, { count: nextCount, lockedUntil: lockMinutes ? Date.now() + lockMinutes * 60_000 : 0 });
      if (user && user.statut !== 'ACTIF') return mockFail('ERR-4031');
      return mockFail('ERR-4010', 'Identifiants incorrects.');
    }

    this._loginAttempts.delete(key);

    if (user!.mfa_actif) {
      this._pendingMfaUserId.set(user!.id);
      return mockOk({ step: 'MFA' as const });
    }
    this.completeLogin(user!);
    return mockOk({ step: 'CREDENTIALS' as const });
  }

  /** UC-AUT-02 second factor — demo code is displayed on-screen for click-through testing. */
  verifyMfa(code: string): Observable<StaffUser> {
    const userId = this._pendingMfaUserId();
    if (!userId) return mockFail('ERR-4010', 'Aucune connexion en attente de vérification.');
    if (code.trim() !== DEMO_MFA_CODE) return mockFail('ERR-4020');
    const user = this.db.staff().find((s) => s.id === userId)!;
    this._pendingMfaUserId.set(null);
    this.completeLogin(user);
    return mockOk(user);
  }

  private completeLogin(user: StaffUser): void {
    this._currentUser.set(user);
    this.persistSession(user);
    this.db.mutate((s) => {
      const idx = s.staff.findIndex((u) => u.id === user.id);
      if (idx >= 0) s.staff[idx] = { ...s.staff[idx], derniere_connexion_le: new Date().toISOString() };
      return s;
    });
    this.db.logAudit({
      auteur_nom: `${user.prenom} ${user.nom}`, auteur_role: user.role, action: 'Connexion réussie',
      ressource: 'session', ip: '41.202.11.4', appareil: 'Navigateur web',
    });
  }

  logout(): void {
    const user = this._currentUser();
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
    this._currentUser.set(null);
    this._pendingMfaUserId.set(null);
    if (user) {
      this.db.logAudit({ auteur_nom: `${user.prenom} ${user.nom}`, auteur_role: user.role, action: 'Déconnexion', ressource: 'session', ip: '41.202.11.4', appareil: 'Navigateur web' });
    }
  }

  requestPasswordReset(email: string): Observable<{ sent: true }> {
    // Anti-enumeration (same posture as UC-AUT-01 E1): always resolve identically.
    return mockOk({ sent: true as const }, 700);
  }

  changePassword(current: string, next: string): Observable<{ ok: true }> {
    if (current !== DEMO_PASSWORD) return mockFail('ERR-4010', 'Mot de passe actuel incorrect.');
    return mockOk({ ok: true as const });
  }

  /** UC-AUT-04 — modification du profil (nom, langue, préférences). */
  updateOwnProfile(patch: { prenom: string; nom: string; langue: 'fr' | 'en' }): Observable<StaffUser> {
    const user = this._currentUser();
    if (!user) return mockFail('ERR-4010');
    const updated: StaffUser = { ...user, ...patch };
    this.db.mutate((s) => {
      const idx = s.staff.findIndex((u) => u.id === user.id);
      if (idx >= 0) s.staff[idx] = updated;
      return s;
    });
    this._currentUser.set(updated);
    return mockOk(updated, 300);
  }

  sessions(): Observable<Session[]> {
    const user = this._currentUser();
    if (!user) return of([]);
    return mockOk(this.db.sessions().filter((s) => s.utilisateur_id === user.id));
  }

  revokeSession(id: string): Observable<{ ok: true }> {
    this.db.mutate((s) => {
      s.sessions = s.sessions.filter((sess) => sess.id !== id);
      return s;
    });
    return mockOk({ ok: true as const }, 300);
  }

  hasPermission(code: PermissionCode | PermissionCode[]): boolean {
    const user = this._currentUser();
    if (!user) return false;
    return hasPermission(user.permissions, code);
  }

  hasAnyPermission(codes: PermissionCode[]): boolean {
    const user = this._currentUser();
    if (!user) return false;
    return hasAnyPermission(user.permissions, codes);
  }
}
