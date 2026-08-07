import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ArbitrationDecision, ArbitrationDossier, ClaimsService } from '../../../core/services/claims.service';
import { ProblemDetails } from '../../../core/models';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import { AlertBannerComponent, BreadcrumbsComponent, FormFieldComponent, ToastService } from '../../../shared/ui';

@Component({
  selector: 'app-claim-lookup',
  imports: [JsonPipe, ReactiveFormsModule, BreadcrumbsComponent, FormFieldComponent, AlertBannerComponent],
  templateUrl: './claim-lookup.component.html',
})
export class ClaimLookupComponent {
  private readonly claims = inject(ClaimsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly uuid = signal(this.route.snapshot.queryParamMap.get('uuid') ?? '');
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly dossier = signal<ArbitrationDossier | null>(null);

  protected readonly decisionForm = this.fb.nonNullable.group({
    decision: ['AUCUNE_FAUTE' as ArbitrationDecision, [Validators.required]],
    motif_decision: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    geste_commercial_xaf: [0, [Validators.min(0)]],
  });
  protected readonly deciding = signal(false);

  constructor() {
    if (this.uuid()) this.lookup();
  }

  onUuidInput(value: string): void {
    this.uuid.set(value);
  }

  lookup(): void {
    if (!this.uuid().trim()) return;
    this.loading.set(true);
    this.notFound.set(false);
    this.dossier.set(null);
    this.router.navigate([], { queryParams: { uuid: this.uuid() }, relativeTo: this.route });
    this.claims.dossier(this.uuid().trim()).subscribe({
      next: (d) => {
        this.loading.set(false);
        this.dossier.set(d);
        this.decisionForm.reset({ decision: 'AUCUNE_FAUTE', motif_decision: '', geste_commercial_xaf: 0 });
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 404) this.notFound.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  decide(): void {
    if (this.decisionForm.invalid || !this.dossier()) {
      this.decisionForm.markAllAsTouched();
      return;
    }
    const v = this.decisionForm.getRawValue();
    this.deciding.set(true);
    this.claims.decide(this.dossier()!.complaint.uuid, v.decision, v.motif_decision, v.geste_commercial_xaf).subscribe({
      next: () => {
        this.deciding.set(false);
        this.toast.success('Décision enregistrée', 'Le dossier est résolu.');
        this.lookup();
      },
      error: (err: ProblemDetails) => {
        this.deciding.set(false);
        this.toast.error('Échec de la décision', err.detail);
      },
    });
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number): string {
    return formatXaf(amount);
  }
}
