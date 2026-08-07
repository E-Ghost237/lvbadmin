import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DriversService, KycDocumentType, KycDossier } from '../../../core/services/drivers.service';
import { ProblemDetails } from '../../../core/models';
import { BreadcrumbsComponent, StatusBadgeComponent, ToastService } from '../../../shared/ui';

const DOCUMENT_LABELS: Record<KycDocumentType, string> = {
  CNI_RECTO: 'CNI (recto)', CNI_VERSO: 'CNI (verso)', PERMIS_CONDUIRE: 'Permis de conduire',
  CARTE_GRISE: 'Carte grise', PHOTO_VEHICULE: 'Photo du véhicule', PHOTO_PROFIL: 'Photo de profil',
  ATTESTATION_ASSURANCE: 'Attestation d’assurance',
};

@Component({
  selector: 'app-kyc-review',
  imports: [BreadcrumbsComponent, StatusBadgeComponent],
  templateUrl: './kyc-review.component.html',
})
export class KycReviewComponent {
  private readonly drivers = inject(DriversService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly uuid = this.route.snapshot.paramMap.get('uuid')!;
  protected readonly loading = signal(true);
  protected readonly dossier = signal<KycDossier | null>(null);
  protected readonly decidingType = signal<KycDocumentType | null>(null);
  protected readonly documentLabels = DOCUMENT_LABELS;

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.drivers.kycDossier(this.uuid).subscribe({
      next: (d) => {
        this.loading.set(false);
        this.dossier.set(d);
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        this.toast.error('Dossier introuvable', err.detail);
      },
    });
  }

  validate(type: KycDocumentType): void {
    this.decide(type, true);
  }

  reject(type: KycDocumentType): void {
    const motif = window.prompt('Motif du rejet (obligatoire, 5 caractères minimum) :');
    if (!motif || motif.trim().length < 5) return;
    this.decide(type, false, motif);
  }

  private decide(type: KycDocumentType, accepte: boolean, motif?: string): void {
    this.decidingType.set(type);
    this.drivers.reviewKycDocument(this.uuid, type, accepte, motif).subscribe({
      next: (res) => {
        this.decidingType.set(null);
        this.toast.success(res.message);
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.decidingType.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  goToDriver(): void {
    this.router.navigate(['/drivers', this.uuid]);
  }
}
