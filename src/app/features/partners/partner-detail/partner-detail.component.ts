import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PartnersService } from '../../../core/services/partners.service';
import {
  AdminUpdatePartnerRequest, Partner, PartnerCategory, PartnerDocument, PartnerDocumentType, PartnerStatus,
  ProblemDetails,
} from '../../../core/models';
import { formatDate, formatDateTime } from '../../../core/utils/formatters';
import { e164Phone } from '../../../core/utils/validators';
import {
  BreadcrumbsComponent, ColumnDef, ConfirmService, DataTableComponent, FormFieldComponent, ModalComponent,
  StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService,
} from '../../../shared/ui';

interface StatusTransition {
  target: PartnerStatus;
  label: string;
  danger: boolean;
}

const DOCUMENT_TYPE_LABELS: Record<PartnerDocumentType, string> = {
  RCCM: 'RCCM', FISCAL: 'Attestation fiscale', ID_RESPONSABLE: 'Pièce d’identité du responsable',
  CONTRAT_LVB: 'Contrat LVB', AUTRE: 'Autre justificatif',
};

/** RG-PRT-003 — every transition other than validation (its own dedicated endpoint). */
const STATUS_TRANSITIONS: Record<PartnerStatus, StatusTransition[]> = {
  EN_ATTENTE_VALIDATION: [{ target: 'SUSPENDU', label: 'Suspendre', danger: true }],
  VALIDE: [{ target: 'ACTIF', label: 'Activer', danger: false }],
  ACTIF: [
    { target: 'SUSPENDU', label: 'Suspendre', danger: true },
    { target: 'DESACTIVE', label: 'Désactiver', danger: true },
  ],
  SUSPENDU: [
    { target: 'ACTIF', label: 'Réactiver', danger: false },
    { target: 'DESACTIVE', label: 'Désactiver', danger: true },
  ],
  DESACTIVE: [{ target: 'ARCHIVE', label: 'Archiver', danger: false }],
  ARCHIVE: [],
};

/** UC-PRT-01/02, UC-ADM-PRT-01/02 — GET/PATCH /v1/admin/partners/{uuid}, .../status, .../validate. */
@Component({
  selector: 'app-partner-detail',
  imports: [
    ReactiveFormsModule, BreadcrumbsComponent, StatusBadgeComponent, ModalComponent, FormFieldComponent, TabsComponent,
    DataTableComponent, TableCellDefDirective,
  ],
  templateUrl: './partner-detail.component.html',
})
export class PartnerDetailComponent {
  private readonly partners = inject(PartnersService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly uuid = this.route.snapshot.paramMap.get('uuid')!;
  protected readonly loading = signal(true);
  protected readonly partner = signal<Partner | null>(null);
  protected readonly categories = signal<PartnerCategory[]>([]);

  protected readonly transitions = computed(() => STATUS_TRANSITIONS[this.partner()?.statut_partenaire ?? 'ARCHIVE'] ?? []);
  protected readonly changingStatus = signal(false);

  protected readonly tabs: TabDef[] = [{ id: 'profil', label: 'Profil' }, { id: 'documents', label: 'Documents' }];
  protected readonly activeTab = signal('profil');

  constructor() {
    this.fetch();
    this.partners.listCategories().subscribe({ next: (page) => this.categories.set(page.items), error: () => {} });
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'documents' && this.documents().length === 0) this.fetchDocuments();
  }

  fetch(): void {
    this.loading.set(true);
    this.partners.get(this.uuid).subscribe({
      next: (p) => { this.loading.set(false); this.partner.set(p); },
      error: (err: ProblemDetails) => { this.loading.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  async changeStatus(transition: StatusTransition): Promise<void> {
    const motif = await this.confirm.askReason({
      title: `${transition.label} ce partenaire ?`,
      message: this.partner()?.nom_commercial,
      label: 'Motif du changement de statut', minLength: 3, danger: transition.danger, confirmLabel: transition.label,
    });
    if (!motif) return;
    this.changingStatus.set(true);
    this.partners.changeStatus(this.uuid, transition.target, motif).subscribe({
      next: (p) => { this.changingStatus.set(false); this.partner.set(p); this.toast.success('Statut mis à jour'); },
      error: (err: ProblemDetails) => { this.changingStatus.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Validation (UC-ADM-PRT-01 step 2) -------------------------------

  protected readonly validateOpen = signal(false);
  protected readonly validateForm = this.fb.nonNullable.group({
    encours_autorise_xaf: [500000, [Validators.required, Validators.min(0)]],
  });
  protected readonly validating = signal(false);

  openValidate(): void {
    this.validateForm.reset({ encours_autorise_xaf: 500000 });
    this.validateOpen.set(true);
  }

  confirmValidate(): void {
    if (this.validateForm.invalid) {
      this.validateForm.markAllAsTouched();
      return;
    }
    this.validating.set(true);
    this.partners.validate(this.uuid, this.validateForm.getRawValue().encours_autorise_xaf).subscribe({
      next: () => {
        this.validating.set(false);
        this.validateOpen.set(false);
        this.toast.success('Partenaire validé');
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.validating.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Profile edit (RG-PRT-005 "DIRECT" fields only) ------------------

  protected readonly editOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editForm = this.fb.nonNullable.group({
    nom_commercial: ['', [Validators.required, Validators.maxLength(200)]],
    telephone: ['', [Validators.required, e164Phone()]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    secteur_activite: ['', [Validators.maxLength(100)]],
    adresse_physique: ['', [Validators.required, Validators.maxLength(2000)]],
    ville: ['', [Validators.required, Validators.maxLength(50)]],
    site_web: ['', [Validators.maxLength(2048)]],
    responsable_telephone: ['', [Validators.required, e164Phone()]],
    responsable_email: ['', [Validators.email, Validators.maxLength(255)]],
    categorie_uuid: [''],
  });

  openEdit(): void {
    const p = this.partner();
    if (!p) return;
    this.editForm.reset({
      nom_commercial: p.nom_commercial, telephone: p.telephone, email: p.email ?? '',
      secteur_activite: p.secteur_activite ?? '', adresse_physique: p.adresse_physique, ville: p.ville,
      site_web: p.site_web ?? '', responsable_telephone: p.responsable_telephone, responsable_email: p.responsable_email ?? '',
      categorie_uuid: p.categorie?.uuid ?? '',
    });
    this.editOpen.set(true);
  }

  saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const v = this.editForm.getRawValue();
    const req: AdminUpdatePartnerRequest = {
      nom_commercial: v.nom_commercial,
      telephone: v.telephone,
      email: v.email || null,
      secteur_activite: v.secteur_activite || null,
      adresse_physique: v.adresse_physique,
      ville: v.ville,
      site_web: v.site_web || null,
      responsable_telephone: v.responsable_telephone,
      responsable_email: v.responsable_email || null,
      categorie_uuid: v.categorie_uuid || null,
    };
    this.saving.set(true);
    this.partners.update(this.uuid, req).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.partner.set(p);
        this.toast.success('Profil mis à jour');
      },
      error: (err: ProblemDetails) => {
        this.saving.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  date(iso: string | null): string {
    return formatDate(iso);
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  // --- Documents (PRT-M02) ---------------------------------------------

  protected readonly documentColumns: ColumnDef<PartnerDocument>[] = [
    { key: 'type_document', label: 'Type', cell: (r) => DOCUMENT_TYPE_LABELS[r.type_document] },
    { key: 'version', label: 'Version', align: 'right' },
    { key: 'statut_verification', label: 'Statut' },
    { key: 'expire_le', label: 'Expire le', cell: (r) => formatDate(r.expire_le) },
    { key: 'cree_le', label: 'Déposé le', cell: (r) => formatDate(r.cree_le) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByDocumentUuid = (row: PartnerDocument) => row.uuid;

  typeLabel(row: PartnerDocument): string {
    return DOCUMENT_TYPE_LABELS[row.type_document];
  }

  protected readonly documents = signal<PartnerDocument[]>([]);
  protected readonly loadingDocuments = signal(true);
  protected readonly documentsCursor = signal<string | null>(null);
  protected readonly reviewingDocument = signal<string | null>(null);

  fetchDocuments(cursor?: string): void {
    this.loadingDocuments.set(true);
    this.partners.listDocuments(this.uuid, { cursor, limit: 20 }).subscribe({
      next: (page) => {
        this.loadingDocuments.set(false);
        this.documents.set(cursor ? [...this.documents(), ...page.items] : page.items);
        this.documentsCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingDocuments.set(false);
        this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  downloadDocument(doc: PartnerDocument): void {
    this.partners.downloadDocumentUrl(this.uuid, doc.uuid).subscribe({
      next: (res) => window.open(res.url, '_blank', 'noopener'),
      error: (err: ProblemDetails) => this.toast.error('Échec du téléchargement', err.detail),
    });
  }

  validateDocument(doc: PartnerDocument): void {
    this.decideDocument(doc, true);
  }

  async rejectDocument(doc: PartnerDocument): Promise<void> {
    const motif = await this.confirm.askReason({
      title: 'Rejeter ce document ?', label: 'Motif du rejet', minLength: 3, danger: true, confirmLabel: 'Rejeter',
    });
    if (!motif) return;
    this.decideDocument(doc, false, motif);
  }

  private decideDocument(doc: PartnerDocument, accepte: boolean, motif?: string): void {
    this.reviewingDocument.set(doc.uuid);
    this.partners.reviewDocument(this.uuid, doc.uuid, accepte, motif).subscribe({
      next: () => {
        this.reviewingDocument.set(null);
        this.toast.success(accepte ? 'Document validé' : 'Document rejeté');
        this.fetchDocuments();
      },
      error: (err: ProblemDetails) => {
        this.reviewingDocument.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }
}
