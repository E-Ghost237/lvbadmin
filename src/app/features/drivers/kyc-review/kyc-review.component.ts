import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DriversService } from '../../../core/services/drivers.service';
import { DriverKycDossier, KycPiece, ProblemDetails } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import { AlertBannerComponent, BreadcrumbsComponent, EmptyStateComponent, FormFieldComponent, ModalComponent, ToastService } from '../../../shared/ui';

@Component({
  selector: 'app-kyc-review',
  imports: [ReactiveFormsModule, RouterLink, BreadcrumbsComponent, ModalComponent, FormFieldComponent, AlertBannerComponent, EmptyStateComponent],
  templateUrl: './kyc-review.component.html',
})
export class KycReviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly driversService = inject(DriversService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly i18n = inject(I18nService);

  protected readonly dossier = signal<DriverKycDossier | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);

  protected readonly allValidated = computed(() => this.dossier()?.pieces.every((p) => p.statut === 'VALIDEE') ?? false);
  protected readonly rejectTarget = signal<KycPiece | null>(null);
  protected readonly rejectForm = this.fb.nonNullable.group({ motif: ['', [Validators.required]] });

  protected readonly showGlobalReject = signal(false);
  protected readonly globalRejectForm = this.fb.nonNullable.group({ motif: ['', [Validators.required]] });

  protected readonly approving = signal(false);
  protected readonly rejecting = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.driversService.kycDossier(id).subscribe({
      next: (d) => { this.dossier.set(d); this.loading.set(false); },
      error: () => { this.notFound.set(true); this.loading.set(false); },
    });
  }

  validatePiece(piece: KycPiece): void {
    const d = this.dossier();
    if (!d) return;
    this.driversService.decidePiece(d.id, piece.type, 'VALIDEE').subscribe((updated) => this.dossier.set(updated));
  }

  openReject(piece: KycPiece): void {
    this.rejectForm.reset({ motif: '' });
    this.rejectTarget.set(piece);
  }

  confirmRejectPiece(): void {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    const d = this.dossier();
    const piece = this.rejectTarget();
    if (!d || !piece) return;
    this.driversService.decidePiece(d.id, piece.type, 'REJETEE', this.rejectForm.getRawValue().motif).subscribe((updated) => {
      this.dossier.set(updated);
      this.rejectTarget.set(null);
    });
  }

  approveDossier(): void {
    const d = this.dossier();
    if (!d) return;
    this.approving.set(true);
    this.driversService.approveDossier(d.id).subscribe({
      next: () => {
        this.approving.set(false);
        this.toast.success('Dossier validé', 'Le livreur peut désormais se rendre disponible.');
        this.router.navigate(['/drivers', d.livreur_id]);
      },
      error: (err: ProblemDetails) => { this.approving.set(false); this.toast.error('Validation impossible', err.detail); },
    });
  }

  confirmGlobalReject(): void {
    if (this.globalRejectForm.invalid) {
      this.globalRejectForm.markAllAsTouched();
      return;
    }
    const d = this.dossier();
    if (!d) return;
    this.rejecting.set(true);
    this.driversService.rejectDossier(d.id, this.globalRejectForm.getRawValue().motif).subscribe((updated) => {
      this.rejecting.set(false);
      this.showGlobalReject.set(false);
      this.dossier.set(updated);
      this.toast.info('Dossier rejeté', 'Le candidat a été notifié du motif.');
    });
  }

  formatDateTime(v: string): string { return formatDateTime(v); }
}
