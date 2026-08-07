import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { AuthIdentity, DeviceSessionSummary } from '../models';

const SESSION_KEY = 'lvb.session';

interface StoredSession {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  email: string;
}

export type LoginStep = 'CREDENTIALS' | 'MFA';

/** A short "Browser on OS" label — well under any reasonable device-column limit. */
function shortBrowserLabel(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : /Android/.test(ua) ? 'Android' : /iOS|iPhone|iPad/.test(ua) ? 'iOS' : '';
  return os ? `${browser} sur ${os}` : browser;
}

interface LoginResponse {
  mfa_required: true;
  challenge_token: string;
}

interface AuthenticatedSessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/**
 * UC-AUT-02 (connexion) / UC-AUT-05 (récupération) / UC-AUT-06 (sessions).
 *
 * The backend never returns the caller's identity after auth — no user
 * object in the login response, no `GET /v1/profile`. So this service only
 * ever holds tokens plus the email the user typed at the login form (for
 * display purposes only). There is no client-side role/permission model:
 * every write the server rejects comes back as a real 403, which the UI
 * surfaces via ForbiddenStateComponent — nothing is gated speculatively.
 *
 * There is also no refresh-token endpoint on the backend, so an expired
 * 15-minute access token simply forces a fresh login (no silent refresh).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private readonly _identity = signal<AuthIdentity | null>(this.readStoredIdentity());
  private readonly _challengeToken = signal<string | null>(null);

  readonly identity = this._identity.asReadonly();
  readonly isAuthenticated = computed(() => this._identity() !== null);
  readonly pendingMfa = computed(() => this._challengeToken() !== null);

  get accessToken(): string | null {
    return this.readStoredSession()?.accessToken ?? null;
  }

  login(email: string, password: string): Observable<{ step: LoginStep }> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { email, password }).pipe(
      tap((res) => this._challengeToken.set(res.challenge_token)),
      map(() => ({ step: 'MFA' as const })),
    );
  }

  verifyMfa(email: string, code: string): Observable<AuthIdentity> {
    const challengeToken = this._challengeToken();
    const body = {
      challenge_token: challengeToken,
      code,
      appareil_nom: 'Navigateur web',
      // The API schema allows up to 150 chars, but a full user-agent string
      // overflows the backend's internal analytics device column (80 chars)
      // and crashes the request — send a short, sane label instead.
      appareil_modele: shortBrowserLabel(),
    };
    return this.http.post<AuthenticatedSessionResponse>(`${this.baseUrl}/auth/login/mfa/verify`, body).pipe(
      tap((res) => this.persistSession(res, email)),
      map(() => ({ email })),
    );
  }

  private persistSession(res: AuthenticatedSessionResponse, email: string): void {
    const session: StoredSession = {
      accessToken: res.access_token,
      accessExpiresAt: Date.now() + res.expires_in * 1000,
      refreshToken: res.refresh_token,
      email,
    };
    if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this._challengeToken.set(null);
    this._identity.set({ email });
  }

  logout(): void {
    // No server-side logout endpoint exists; clearing the local token is the
    // only available action (the token remains valid server-side until its
    // 15-minute expiry).
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
    this._identity.set(null);
    this._challengeToken.set(null);
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/password/request-reset`, { email });
  }

  resetPassword(token: string, password: string, passwordConfirmation: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/password/reset`, {
      token, password, password_confirmation: passwordConfirmation,
    });
  }

  sessions(): Observable<DeviceSessionSummary[]> {
    return this.http.get<{ data: DeviceSessionSummary[] }>(`${this.baseUrl}/profile/sessions`).pipe(map((r) => r.data));
  }

  revokeSession(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/profile/sessions/${id}`);
  }

  revokeAllSessions(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/profile/sessions`);
  }

  updateProfile(patch: { nom?: string; prenom?: string; langue?: 'fr' | 'en'; photo_url?: string }): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/profile`, patch);
  }

  private readStoredSession(): StoredSession | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const stored: StoredSession = JSON.parse(raw);
      if (stored.accessExpiresAt < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return stored;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private readStoredIdentity(): AuthIdentity | null {
    const session = this.readStoredSession();
    return session ? { email: session.email } : null;
  }
}
