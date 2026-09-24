import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@lvb/auth/auth.service';
import { PartnerRole, PartnerStatus } from '@lvb/models/enums';
import { Partner, PartnerDocument } from '@lvb/models/partner.model';
import { computeReadiness, partnerCan } from '@lvb/utils/partner-access';
import { PartnerProfileService } from './partner-profile.service';

export type PartnerContextState = 'idle' | 'loading' | 'ready' | 'no-partner' | 'error';

/**
 * Who the signed-in user is *inside the partner organisation*: which partner,
 * its lifecycle status, and their role. The backend has no "my role" endpoint,
 * so the role is found by matching `/me`.uuid against `GET /partner/users`
 * (only reachable once the partner is ACTIF — before that, only the dossier
 * screens are available and role-specific hiding isn't needed).
 *
 * Failure is never allowed to lock anybody out: when the state can't be
 * determined (`error`, or an ACTIF partner whose role could not be resolved)
 * `can()` answers true and the server's 403 remains the real gate.
 */
@Injectable({ providedIn: 'root' })
export class PartnerContextService {
  private readonly api = inject(PartnerProfileService);
  private readonly auth = inject(AuthService);

  readonly state = signal<PartnerContextState>('idle');
  readonly partner = signal<Partner | null>(null);
  readonly documents = signal<PartnerDocument[]>([]);
  readonly role = signal<PartnerRole | null>(null);

  readonly status = computed<PartnerStatus | null>(() => this.partner()?.statut_partenaire ?? null);
  readonly isActive = computed(() => this.status() === 'ACTIF');
  readonly readiness = computed(() => computeReadiness(this.partner(), this.documents()));

  private inflight: Promise<void> | null = null;
  private loadedFor: string | null = null;

  /** Loads once; later callers reuse the result. */
  ensureLoaded(): Promise<void> {
    // A different account may have signed in since the last load: never reuse another user's context.
    const who = this.auth.identity()?.email ?? null;
    if (this.loadedFor !== null && who !== this.loadedFor) this.reset();
    this.loadedFor = who;
    if (this.state() === 'ready' || this.state() === 'no-partner') return Promise.resolve();
    return this.refresh();
  }

  refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.state.set('loading');
    this.inflight = this.load().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  reset(): void {
    this.state.set('idle');
    this.partner.set(null);
    this.documents.set([]);
    this.role.set(null);
  }

  can(permission: string): boolean {
    switch (this.state()) {
      case 'no-partner': return false;
      case 'ready': break;
      default: return true; // idle/loading/error — never lock out on uncertainty
    }
    if (this.status() === 'ACTIF' && this.role() === null) return true;
    return partnerCan(this.role(), this.status(), permission);
  }

  private async load(): Promise<void> {
    try {
      this.partner.set(await firstValueFrom(this.api.getProfile()));
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        this.partner.set(null);
        this.state.set('no-partner');
      } else {
        this.state.set('error');
      }
      return;
    }
    // Best-effort extras — a failure here only means less detail.
    await Promise.allSettled([this.loadDocuments(), this.loadRole()]);
    this.state.set('ready');
  }

  private async loadDocuments(): Promise<void> {
    const page = await firstValueFrom(this.api.listDocuments({ limit: 100 }));
    this.documents.set(page.items);
  }

  private async loadRole(): Promise<void> {
    if (this.status() !== 'ACTIF') return;
    let me = this.auth.identity()?.uuid;
    if (!me) me = (await firstValueFrom(this.auth.loadCurrentUser())).uuid;
    const { items } = await firstValueFrom(this.api.listMembers());
    this.role.set(items.find((m) => m.actif && m.utilisateur?.uuid === me)?.role ?? null);
  }
}
