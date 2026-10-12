import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormFeedbackService } from '@lvb/ui/form-feedback/form-feedback.service';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { ToastService } from '@lvb/ui/toast/toast.service';
import { ProblemDetails } from '@lvb/models/common.model';
import { PartnerProfileService } from '../../core/services/partner-profile.service';
import { PartnerContextService } from '../../core/services/partner-context.service';

function invitationToken(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '').trim();
  if (!v) return null;
  if (/[^a-fA-F0-9]/.test(v)) return { token: { reason: 'chars' } };
  if (v.length !== 64) return { token: { reason: 'length', have: v.length } };
  return null;
}

/**
 * Invitee side of the partner team invitation. The person signs in with their
 * own client account (the one whose verified email/phone was invited), then
 * pastes the 64-character code from the invitation message.
 */
@Component({
  selector: 'app-accept-invitation',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent],
  template: `
    <div class="page max-w-lg">
      <div>
        <p class="section-label">Équipe partenaire</p>
        <h1 class="page-title mt-1.5">Rejoindre une équipe partenaire</h1>
        <p class="page-sub mt-1">
          Saisissez le code reçu par email ou SMS. L’invitation doit correspondre à l’email ou au téléphone vérifié de votre compte, et expire après 72 h.
        </p>
      </div>
      <section class="card">
        <div class="card-head">
          <span class="icon-chip" style="background: var(--app-accent-soft); color: var(--app-accent-ink)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7a4 4 0 1 0 0 8" /><path d="M11 11h9l2 2-2 2h-2v2h-2" /></svg>
          </span>
          <div>
            <h2 class="card-title">Code d’invitation</h2>
            <p class="card-sub">Copiez le code exactement tel qu’il figure dans le message reçu</p>
          </div>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()" class="card-body flex flex-col gap-4">
          <app-field label="Code d’invitation" [control]="form.controls.token" required hint="64 caractères (chiffres et lettres a–f).">
            <input class="input font-mono text-xs" formControlName="token" autocomplete="off" spellcheck="false" />
          </app-field>
          <div class="flex gap-2">
            <button type="submit" class="btn btn-primary" [disabled]="accepting()">Accepter l’invitation</button>
            <a routerLink="/onboarding" class="btn btn-ghost">Annuler</a>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class AcceptInvitationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PartnerProfileService);
  private readonly ctx = inject(PartnerContextService);
  private readonly toast = inject(ToastService);
  private readonly feedback = inject(FormFeedbackService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly accepting = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    token: [this.route.snapshot.queryParamMap.get('token') ?? '', [Validators.required, invitationToken]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.feedback.invalid(this.form);
      return;
    }
    this.accepting.set(true);
    this.api.acceptInvitation(this.form.controls.token.value).subscribe({
      next: async () => {
        this.accepting.set(false);
        this.toast.success('Invitation acceptée', 'Vous faites désormais partie de l’équipe partenaire.');
        this.ctx.reset();
        await this.ctx.refresh();
        void this.router.navigateByUrl('/dashboard');
      },
      error: (err: ProblemDetails) => {
        this.accepting.set(false);
        this.feedback.serverError(this.form, 'Invitation refusée', err);
      },
    });
  }
}
