import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PartnerContextService } from '../../core/services/partner-context.service';

interface StatusCopy { tone: 'info' | 'good' | 'warning' | 'critical'; title: string; body: string }

const COPY: Record<string, StatusCopy> = {
  EN_ATTENTE_VALIDATION: { tone: 'info', title: 'Dossier en cours de constitution', body: 'LVB validera votre partenariat dès que le dossier ci-dessous est complet et que chaque document a été vérifié.' },
  VALIDE: { tone: 'good', title: 'Dossier validé — activation en cours', body: 'Votre dossier est validé. LVB doit encore activer votre compte ; vous serez notifié dès que c’est fait.' },
  SUSPENDU: { tone: 'warning', title: 'Compte suspendu', body: 'L’accès aux services est suspendu par LVB. Contactez le support LVB pour connaître le motif et les étapes de réactivation.' },
  DESACTIVE: { tone: 'critical', title: 'Compte désactivé', body: 'Ce partenariat a été désactivé. Contactez LVB si vous pensez qu’il s’agit d’une erreur.' },
  ARCHIVE: { tone: 'critical', title: 'Compte archivé', body: 'Ce partenariat est archivé et n’est plus accessible.' },
};

/**
 * Landing screen for everything that can't use the full portal yet: a partner
 * still being onboarded (checklist of what LVB requires), a suspended/closed
 * one, or a signed-in account that isn't a member of any partner (→ accept an
 * invitation).
 */
@Component({
  selector: 'app-onboarding-page',
  imports: [RouterLink],
  template: `
    <div class="page max-w-2xl">
      <div>
        <p class="section-label">Activation du compte</p>
        <h1 class="page-title mt-1.5">Votre espace partenaire</h1>
        <p class="page-sub mt-1">Suivez l’avancement de votre dossier auprès de La Vie est Belle.</p>
      </div>

      @switch (ctx.state()) {
        @case ('loading') { <div class="skeleton h-40"></div> }
        @case ('idle') { <div class="skeleton h-40"></div> }
        @case ('error') {
          <section class="card">
            <div class="card-body flex flex-col items-start gap-1">
              <span class="icon-chip" style="background: var(--status-critical-bg); color: var(--status-critical)">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 8v4M12 16h.01" /><circle cx="12" cy="12" r="9" /></svg>
              </span>
              <p class="text-sm font-semibold mt-2">Impossible de charger votre dossier</p>
              <p class="text-xs" style="color: var(--text-muted)">Vérifiez votre connexion puis réessayez.</p>
              <button type="button" class="btn btn-secondary btn-sm mt-3" (click)="ctx.refresh()">Réessayer</button>
            </div>
          </section>
        }
        @case ('no-partner') {
          <section class="card">
            <div class="card-body flex flex-col items-start gap-1">
              <span class="icon-chip" style="background: var(--app-accent-soft); color: var(--app-accent-ink)">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></svg>
              </span>
              <p class="text-sm font-semibold mt-2">Ce compte n’est rattaché à aucun partenaire</p>
              <p class="text-xs leading-relaxed" style="color: var(--text-muted)">
                Un partenaire est créé par LVB. Pour rejoindre une équipe existante, demandez à votre responsable de vous inviter,
                puis saisissez le code reçu par email ou SMS.
              </p>
              <a routerLink="/accept-invitation" class="btn btn-primary btn-sm mt-3 inline-flex">J’ai un code d’invitation</a>
            </div>
          </section>
        }
        @default {
          @if (copy(); as c) {
            <section class="card" [style.border-left]="'4px solid var(--status-' + c.tone + ')'">
              <div class="card-body">
                <p class="text-sm font-semibold">{{ c.title }}</p>
                <p class="text-xs mt-1 leading-relaxed" style="color: var(--text-secondary)">{{ c.body }}</p>
              </div>
            </section>
          }
          @if (showChecklist()) {
            <section class="card">
              <div class="card-head">
                <div>
                  <h2 class="card-title">Pièces et informations exigées par LVB</h2>
                  <p class="card-sub">Complétez chaque ligne pour permettre la validation du dossier</p>
                </div>
              </div>
              <div class="card-body">
              <ul class="flex flex-col gap-2.5">
                @for (item of checklist(); track item.key) {
                  <li class="flex items-start gap-2.5 text-sm">
                    <span class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white"
                          [style.background]="item.ok ? 'var(--status-good)' : 'var(--status-warning)'">{{ item.ok ? '✓' : '!' }}</span>
                    <span>
                      {{ item.label }}
                      @if (!item.ok && item.detail) { <span class="text-xs" style="color: var(--text-muted)"> — {{ item.detail }}</span> }
                      @if (!item.ok && !item.detail) { <span class="text-xs" style="color: var(--text-muted)"> — à renseigner</span> }
                      @if (!item.ok) { <a class="text-xs ml-2 underline" style="color: var(--app-accent-ink)" routerLink="/profile" [queryParams]="params(item.key)">Compléter</a> }
                    </span>
                  </li>
                }
              </ul>
              @if (ctx.readiness().ready) {
                <p class="text-xs mt-4" style="color: var(--status-good)">Dossier complet. Il ne reste qu’à attendre la validation LVB.</p>
              } @else {
                <a routerLink="/profile" [queryParams]="firstMissingParams()" class="btn btn-primary btn-sm mt-4 inline-flex">Compléter mon dossier</a>
              }
              </div>
            </section>
          }
          <p class="text-xs" style="color: var(--text-muted)">
            Le tableau de bord, les commandes, la flotte, le marketplace et le portefeuille s’ouvrent dès que votre compte est actif.
          </p>
        }
      }
    </div>
  `,
})
export class OnboardingPageComponent {
  protected readonly ctx = inject(PartnerContextService);

  protected readonly copy = computed(() => COPY[this.ctx.status() ?? ''] ?? null);
  protected readonly showChecklist = computed(() => ['EN_ATTENTE_VALIDATION', 'VALIDE'].includes(this.ctx.status() ?? ''));
  protected readonly checklist = computed(() => [...this.ctx.readiness().documents, ...this.ctx.readiness().fields]);

  private static readonly DOC_KEYS = ['RCCM', 'FISCAL', 'ID_RESPONSABLE', 'CONTRAT_LVB'];

  /** Where the owner must go to fix one checklist item (a document upload, or the sensitive-field change request). */
  protected params(key: string): Record<string, string> {
    if (OnboardingPageComponent.DOC_KEYS.includes(key)) return { tab: 'documents', type: key };
    return { tab: 'profile', change: '1' };
  }

  protected firstMissingParams(): Record<string, string> {
    const first = this.checklist().find((i) => !i.ok);
    return first ? this.params(first.key) : {};
  }

  constructor() {
    // Always show fresh progress when landing here (documents may have just been verified).
    void this.ctx.refresh();
  }
}
