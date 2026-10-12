import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import { AuthIdentity, CurrentUser, DeviceSessionSummary, ProblemDetails } from '../models';

const SESSION_KEY = 'lvb.session';
/** sessionStorage, not localStorage: this token is single-use and should die with the tab, but
 *  must survive an in-page reload (e.g. a dev-server HMR reload) between the credentials step and
 *  the MFA step — otherwise `verifyMfa()` silently sends `challenge_token: null` and the backend's
 *  "champ obligatoire" validation error (not a wrong-code error) is confusing. */
const CHALLENGE_KEY = 'lvb.mfa_challenge';

interface StoredSession {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  email: string;
}

export type LoginStep = 'CREDENTIALS' | 'MFA';

/** Outcome of `POST /auth/login`: `MFA` needs the emailed code next, `DONE` means the session is already open. */
export type LoginOutcome = 'MFA' | 'DONE';

/** A short "Browser on OS" label — well under any reasonable device-column limit. */
function shortBrowserLabel(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : /Android/.test(ua) ? 'Android' : /iOS|iPhone|iPad/.test(ua) ? 'iOS' : '';
  return os ? `${browser} sur ${os}` : browser;
}

interface MfaChallengeResponse {
  mfa_required: true;
  challenge_token: string;
}

interface AuthenticatedSessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  /** Mobile profile computed server-side (CHAUFFEUR / LIVREUR / CLIENT) — null for accounts with none, e.g. staff or partner members. */
  role?: string | null;
  roles?: string[];
}

/** `POST /auth/login` answers with EITHER a full session (mobile-type accounts) OR an MFA challenge (internal accounts). */
type LoginResponse = MfaChallengeResponse | AuthenticatedSessionResponse;

function isMfaChallenge(res: LoginResponse): res is MfaChallengeResponse {
  return (res as MfaChallengeResponse).mfa_required === true;
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
 * `POST /v1/auth/refresh` rotates the 15-minute access token using the
 * (single-use) refresh token — `authInterceptor` calls `refreshSession()`
 * on a 401 and retries the original request once. `refreshSession()` itself
 * is a single-flight call (`shareReplay`) so concurrent 401s share one
 * rotation instead of each burning the one-time refresh token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private readonly _identity = signal<AuthIdentity | null>(this.readStoredIdentity());
  private readonly _challengeToken = signal<string | null>(this.readStoredChallenge());
  private refreshInFlight$: Observable<void> | null = null;

  readonly identity = this._identity.asReadonly();
  readonly isAuthenticated = computed(() => this._identity() !== null);
  readonly pendingMfa = computed(() => this._challengeToken() !== null);

  get accessToken(): string | null {
    return this.readStoredSession()?.accessToken ?? null;
  }

  login(email: string, password: string): Observable<{ outcome: LoginOutcome }> {
    const normalisedEmail = email.trim().toLowerCase();
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { email: normalisedEmail, password }).pipe(
      map((res): { outcome: LoginOutcome } => {
        if (isMfaChallenge(res)) {
          this._challengeToken.set(res.challenge_token);
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(CHALLENGE_KEY, res.challenge_token);
          return { outcome: 'MFA' };
        }
        this.persistSession(res, normalisedEmail);
        return { outcome: 'DONE' };
      }),
    );
  }

  /**
   * `GET /v1/me` — the account's own name, language and status. Best-effort:
   * a failure never blocks the session (the app works with the email alone).
   */
  loadCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.baseUrl}/me`).pipe(
      tap((me) => {
        const current = this._identity();
        if (current) this._identity.set({ ...current, uuid: me.uuid, nom: me.nom, prenom: me.prenom, langue: me.langue, role: me.role, roles: me.roles });
      }),
    );
  }

  verifyMfa(email: string, code: string): Observable<AuthIdentity> {
    const challengeToken = this._challengeToken();
    if (!challengeToken) {
      // Never send a request we know the backend will bounce as "challenge_token obligatoire" —
      // that reads like a bug report, not an expired-session message. This is also the only
      // correct recovery: the one-time challenge is gone, so only a fresh login can produce a new one.
      return throwError((): ProblemDetails => ({
        type: 'about:blank', title: 'Session de vérification expirée', status: 440, code: 'ERR-CLIENT-4001',
        detail: 'Votre session de vérification a expiré. Reconnectez-vous pour recevoir un nouveau code.',
        request_id: '',
      }));
    }
    const body = {
      challenge_token: challengeToken,
      code: code.trim(),
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
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(CHALLENGE_KEY);
    // Keep the name/role already loaded from /me across token rotations.
    this._identity.set({ ...(this._identity() ?? {}), email });
  }

  logout(): void {
    // Best-effort server-side revocation — the local session is cleared
    // regardless of whether this call succeeds (e.g. token already expired).
    this.http.post<void>(`${this.baseUrl}/auth/logout`, {}).subscribe({ error: () => undefined });
    this.clearLocalSession();
  }

  /**
   * Rotates the access/refresh token pair. Single-flight: a second caller
   * while a rotation is already in progress gets the same in-flight
   * Observable rather than issuing its own request against the (single-use)
   * refresh token.
   */
  refreshSession(): Observable<void> {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    const stored = this.readStoredSession();
    if (!stored?.refreshToken) return throwError(() => new Error('Aucun jeton de rafraîchissement disponible.'));

    const body = {
      refresh_token: stored.refreshToken,
      appareil_nom: 'Navigateur web',
      appareil_modele: shortBrowserLabel(),
    };
    this.refreshInFlight$ = this.http.post<AuthenticatedSessionResponse>(`${this.baseUrl}/auth/refresh`, body).pipe(
      tap((res) => this.persistSession(res, stored.email)),
      map(() => undefined),
      catchError((err) => {
        this.clearLocalSession();
        return throwError(() => err);
      }),
      shareReplay(1),
      finalize(() => { this.refreshInFlight$ = null; }),
    );
    return this.refreshInFlight$;
  }

  private clearLocalSession(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(CHALLENGE_KEY);
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

  /**
   * Deliberately does not evict the session once `accessExpiresAt` has
   * passed: the refresh token can still be good, and `refreshSession()`
   * needs it. The server's own 401 is the authority on whether the access
   * token still works — the interceptor refreshes and retries on that,
   * rather than this client-side clock pre-empting a still-valid session.
   */
  private readStoredSession(): StoredSession | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private readStoredIdentity(): AuthIdentity | null {
    const session = this.readStoredSession();
    return session ? { email: session.email } : null;
  }

  private readStoredChallenge(): string | null {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(CHALLENGE_KEY);
  }
}
