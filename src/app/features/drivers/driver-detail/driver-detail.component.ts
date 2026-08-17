import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DriversService, DriverQuality, SanctionType } from '../../../core/services/drivers.service';
import { AdminUserDetail, ProblemDetails } from '../../../core/models';
import { formatDate, formatDateTime, formatPercent } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, ConfirmService, FormFieldComponent, ModalComponent,
  StatusBadgeComponent, ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-driver-detail',
  imports: [DecimalPipe, ReactiveFormsModule, BreadcrumbsComponent, StatusBadgeComponent, AlertBannerComponent, ModalComponent, FormFieldComponent],
  templateUrl: './driver-detail.component.html',
})
export class DriverDetailComponent {
  private readonly driversService = inject(DriversService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly uuid = this.route.snapshot.paramMap.get('uuid')!;
  protected readonly loading = signal(true);
  protected readonly driver = signal<AdminUserDetail | null>(null);
  protected readonly quality = signal<DriverQuality | null>(null);
  protected readonly loadingQuality = signal(true);
  protected readonly qualityError = signal('');

  protected readonly sanctionOpen = signal(false);
  protected readonly proposedSanction = signal<{ sanction_id: string; statut: string; delai_contradiction_jours: number } | null>(null);
  protected readonly proposing = signal(false);
  protected readonly deciding = signal(false);

  protected readonly sanctionForm = this.fb.nonNullable.group({
    type: ['AVERTISSEMENT' as SanctionType, [Validators.required]],
    motif: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  protected readonly decisionForm = this.fb.nonNullable.group({
    motif_decision: ['', [Validators.required]],
    duree_jours: [7],
  });

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.driversService.get(this.uuid).subscribe({
      next: (d) => {
        this.loading.set(false);
        this.driver.set(d);
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        this.toast.error('Chargement impossible', err.detail);
      },
    });

    this.loadingQuality.set(true);
    this.driversService.quality(this.uuid).subscribe({
      next: (q) => {
        this.loadingQuality.set(false);
        this.quality.set(q);
      },
      error: (err: ProblemDetails) => {
        this.loadingQuality.set(false);
        this.qualityError.set(err.detail);
      },
    });
  }

  async suspend(): Promise<void> {
    const motif = await this.confirm.askReason({
      title: 'Suspendre ce livreur ?', message: 'Le compte sera immédiatement suspendu.',
      label: 'Motif de suspension', minLength: 5, danger: true, confirmLabel: 'Suspendre',
    });
    if (!motif) return;
    this.driversService.suspend(this.uuid, motif).subscribe({
      next: () => { this.toast.success('Compte suspendu'); this.fetch(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  reactivate(): void {
    this.driversService.reactivate(this.uuid).subscribe({
      next: () => { this.toast.success('Compte réactivé'); this.fetch(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  openSanction(): void {
    this.sanctionForm.reset({ type: 'AVERTISSEMENT', motif: '' });
    this.proposedSanction.set(null);
    this.sanctionOpen.set(true);
  }

  proposeSanction(): void {
    if (this.sanctionForm.invalid) {
      this.sanctionForm.markAllAsTouched();
      return;
    }
    const v = this.sanctionForm.getRawValue();
    this.proposing.set(true);
    this.driversService.proposeSanction(this.uuid, v.type, v.motif).subscribe({
      next: (res) => {
        this.proposing.set(false);
        this.proposedSanction.set(res);
        this.decisionForm.reset({ motif_decision: '', duree_jours: 7 });
      },
      error: (err: ProblemDetails) => {
        this.proposing.set(false);
        this.toast.error('Échec de la proposition', err.detail);
      },
    });
  }

  confirmSanction(): void {
    const sanction = this.proposedSanction();
    if (!sanction || this.decisionForm.invalid) {
      this.decisionForm.markAllAsTouched();
      return;
    }
    const v = this.decisionForm.getRawValue();
    this.deciding.set(true);
    this.driversService.confirmSanction(sanction.sanction_id, v.motif_decision, true, v.duree_jours).subscribe({
      next: () => {
        this.deciding.set(false);
        this.sanctionOpen.set(false);
        this.toast.success('Sanction confirmée et appliquée');
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.deciding.set(false);
        this.toast.error('Échec de la confirmation', err.detail);
      },
    });
  }

  cancelSanction(): void {
    const sanction = this.proposedSanction();
    if (!sanction || this.decisionForm.controls.motif_decision.invalid) {
      this.decisionForm.controls.motif_decision.markAsTouched();
      return;
    }
    this.deciding.set(true);
    this.driversService.cancelSanction(sanction.sanction_id, this.decisionForm.getRawValue().motif_decision).subscribe({
      next: () => {
        this.deciding.set(false);
        this.sanctionOpen.set(false);
        this.toast.info('Sanction annulée');
      },
      error: (err: ProblemDetails) => {
        this.deciding.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  goToKyc(): void {
    this.router.navigate(['/drivers/kyc', this.uuid]);
  }

  date(iso: string | null): string {
    return formatDate(iso);
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  pct(v: number): string {
    return formatPercent(v);
  }
}
