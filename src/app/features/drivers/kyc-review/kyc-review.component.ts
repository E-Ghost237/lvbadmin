import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DriversService, KycDocumentType, KycDossier } from '../../../core/services/drivers.service';
import { ProblemDetails } from '../../../core/models';
import {
  ConfirmService,
  PageHeaderComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../shared/ui';

const DOCUMENT_LABELS: Record<KycDocumentType, string> = {
  CNI_RECTO: 'CNI (recto)', CNI_VERSO: 'CNI (verso)', PERMIS_CONDUIRE: 'Permis de conduire',
  CARTE_GRISE: 'Carte grise', PHOTO_VEHICULE: 'Photo du véhicule', PHOTO_PROFIL: 'Photo de profil',
  ATTESTATION_ASSURANCE: 'Attestation d’assurance',
};

@Component({
  selector: 'app-kyc-review',
  imports: [
  PageHeaderComponent,
  StatusBadgeComponent,
],
  templateUrl: './kyc-review.component.html',
})
export class KycReviewComponent {
  private readonly drivers = inject(DriversService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly uuid = this.route.snapshot.paramMap.get('uuid')!;
  protected readonly loading = signal(true);
  protected readonly dossier = signal<KycDossier | null>(null);
  protected readonly decidingType = signal<KycDocumentType | null>(null);
  protected readonly documentLabels = DOCUMENT_LABELS;
  protected readonly approving = signal(false);

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

  async reject(type: KycDocumentType): Promise<void> {
    const motif = await this.confirm.askReason({
      title: 'Rejeter ce document ?', label: 'Motif du rejet', minLength: 5, danger: true, confirmLabel: 'Rejeter',
    });
    if (!motif) return;
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

  protected readonly openingType = signal<KycDocumentType | null>(null);

  /** Opens (or downloads) the file the driver submitted, so the reviewer sees it before validating. */
  viewDocument(type: KycDocumentType, download = false): void {
    // Open the tab synchronously (inside the click) so pop-up blockers allow it, then point it at the file.
    const tab = download ? null : window.open('', '_blank');
    this.openingType.set(type);
    this.drivers.kycDocumentFile(this.uuid, type).subscribe({
      next: (blob) => {
        this.openingType.set(null);
        const url = URL.createObjectURL(blob);
        if (download) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.documentLabels[type]}-${this.uuid.slice(0, 8)}`;
          a.click();
        } else if (tab) {
          tab.location.href = url;
        } else {
          window.open(url, '_blank');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err: ProblemDetails) => {
        tab?.close();
        this.openingType.set(null);
        if (err.status === 404) this.toast.warning('Fichier introuvable', 'Ce document n’a pas de fichier enregistré : le livreur ne l’a pas encore envoyé ou l’envoi a échoué.');
        else this.toast.error('Ouverture impossible', err.detail);
      },
    });
  }

  goToDriver(): void {
    this.router.navigate(['/drivers', this.uuid]);
  }

  allDocumentsValidated(d: KycDossier): boolean {
    return d.documents.length > 0 && d.documents.every((doc) => doc.statut === 'VALIDE');
  }

  async approveDriver(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Approuver ce livreur ?', message: 'Le compte passera au statut actif et pourra prendre des missions.',
    });
    if (!ok) return;
    this.approving.set(true);
    this.drivers.approve(this.uuid).subscribe({
      next: () => {
        this.approving.set(false);
        this.toast.success('Livreur approuvé');
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.approving.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }
}
