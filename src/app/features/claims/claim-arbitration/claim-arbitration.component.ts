import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ClaimsService } from '../../../core/services/claims.service';
import { ArbitrationDossier, ClaimMessage, ProblemDetails } from '../../../core/models';
import { integerAmount, requiredTrimmed } from '../../../core/utils/validators';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, EmptyStateComponent, FormFieldComponent, ModalComponent,
  StatusBadgeComponent, ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-claim-arbitration',
  imports: [ReactiveFormsModule, RouterLink, StatusBadgeComponent, BreadcrumbsComponent, ModalComponent, FormFieldComponent, AlertBannerComponent, EmptyStateComponent],
  templateUrl: './claim-arbitration.component.html',
})
export class ClaimArbitrationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly claimsService = inject(ClaimsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly dossier = signal<ArbitrationDossier | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly messages = signal<ClaimMessage[]>([]);
  protected readonly newMessage = signal('');
  protected readonly sendingMessage = signal(false);

  protected readonly Infinity = Infinity;

  protected readonly gestureCeiling = computed(() => {
    const role = this.auth.currentUser()?.role;
    return role ? this.claimsService.gestureCeilingFor(role) : 0;
  });

  protected readonly showResolveModal = signal(false);
  protected readonly resolveForm = this.fb.nonNullable.group({
    resolution: ['', [requiredTrimmed()]],
    geste_commercial: [0, [integerAmount(0)]],
  });
  protected readonly resolving = signal(false);

  protected readonly showEscalateModal = signal(false);
  protected readonly escalateMotif = signal('');
  protected readonly escalating = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.claimsService.arbitrationDossier(id).subscribe({
      next: (d) => {
        this.dossier.set(d);
        this.loading.set(false);
        this.claimsService.messages(id).subscribe((m) => this.messages.set(m));
      },
      error: () => { this.notFound.set(true); this.loading.set(false); },
    });
  }

  sendMessage(): void {
    const claim = this.dossier()?.claim;
    if (!claim || !this.newMessage().trim()) return;
    this.sendingMessage.set(true);
    this.claimsService.addMessage(claim.id, this.newMessage()).subscribe(() => {
      this.sendingMessage.set(false);
      this.newMessage.set('');
      this.claimsService.messages(claim.id).subscribe((m) => this.messages.set(m));
    });
  }

  openResolve(): void {
    this.resolveForm.reset({ resolution: '', geste_commercial: 0 });
    this.showResolveModal.set(true);
  }

  confirmResolve(): void {
    if (this.resolveForm.invalid) { this.resolveForm.markAllAsTouched(); return; }
    const claim = this.dossier()?.claim;
    if (!claim) return;
    const { resolution, geste_commercial } = this.resolveForm.getRawValue();
    this.resolving.set(true);
    this.claimsService.resolve(claim.id, resolution, geste_commercial).subscribe({
      next: () => {
        this.resolving.set(false);
        this.showResolveModal.set(false);
        this.load(claim.id);
        this.toast.success('Réclamation résolue');
      },
      error: (err: ProblemDetails) => { this.resolving.set(false); this.toast.error('Action refusée', err.detail); },
    });
  }

  openEscalate(): void {
    this.escalateMotif.set('');
    this.showEscalateModal.set(true);
  }

  confirmEscalate(): void {
    const claim = this.dossier()?.claim;
    if (!claim || !this.escalateMotif().trim()) return;
    this.escalating.set(true);
    this.claimsService.escalate(claim.id, this.escalateMotif()).subscribe(() => {
      this.escalating.set(false);
      this.showEscalateModal.set(false);
      this.load(claim.id);
      this.toast.info('Dossier escaladé');
    });
  }

  closeClaim(): void {
    const claim = this.dossier()?.claim;
    if (!claim) return;
    this.claimsService.close(claim.id).subscribe(() => {
      this.load(claim.id);
      this.toast.success('Dossier fermé');
    });
  }

  formatDateTime(v: string): string { return formatDateTime(v); }
  formatXaf(v: number): string { return formatXaf(v); }
}
