import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PartnersService } from '../../../core/services/partners.service';
import { UsersService } from '../../../core/services/users.service';
import {
  AdminUserSummary, CreatePartnerRequest, Partner, PartnerCategory, PartnerStatus, ProblemDetails,
} from '../../../core/models';
import { formatDate } from '../../../core/utils/formatters';
import { e164Phone } from '../../../core/utils/validators';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ColumnDef, DataTableComponent, ForbiddenStateComponent, FormFieldComponent, ModalComponent,
  SearchInputComponent, SelectComponent, SelectOption, StatusBadgeComponent, TableCellDefDirective, ToastService,
  ToggleComponent,
} from '../../../shared/ui';

const PARTNER_STATUS_VALUES: PartnerStatus[] = [
  'EN_ATTENTE_VALIDATION', 'VALIDE', 'ACTIF', 'SUSPENDU', 'DESACTIVE', 'ARCHIVE',
];

/** UC-ADM-PRT-01 — /v1/admin/partners (Partner module, LVB-CDC-PART-2026-V1.0). */
@Component({
  selector: 'app-partners-page',
  imports: [
    ReactiveFormsModule, BreadcrumbsComponent, ForbiddenStateComponent, StatusBadgeComponent, SearchInputComponent,
    ModalComponent, FormFieldComponent, DataTableComponent, TableCellDefDirective, ToggleComponent, SelectComponent,
  ],
  templateUrl: './partners-page.component.html',
})
export class PartnersPageComponent {
  private readonly partners = inject(PartnersService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly statusValues = PARTNER_STATUS_VALUES;
  protected readonly statusOptions = computed<SelectOption[]>(() =>
    this.statusValues.map((s) => ({ value: s, label: this.i18n.t('status.partner.' + s) })));

  protected readonly columns: ColumnDef<Partner>[] = [
    { key: 'nom_commercial', label: 'Partenaire' },
    { key: 'responsable_nom', label: 'Responsable' },
    { key: 'ville', label: 'Ville' },
    { key: 'statut_partenaire', label: 'Statut' },
    { key: 'cree_le', label: 'Créé le', cell: (r) => formatDate(r.cree_le) },
    { key: 'actions', label: '' },
  ];

  protected readonly trackByUuid = (row: Partner) => row.uuid;

  protected readonly rows = signal<Partner[]>([]);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly nextCursor = signal<number | null>(null);
  protected readonly statusFilter = signal<PartnerStatus | ''>('');

  constructor() {
    this.fetch();
  }

  fetch(cursor?: number): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.partners.list({ statut: this.statusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.rows.set(cursor ? [...this.rows(), ...page.items] : page.items);
        this.nextCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 403) this.forbidden.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as PartnerStatus | '');
    this.fetch();
  }

  openPartner(row: Partner): void {
    this.router.navigate(['/partners', row.uuid]);
  }

  // --- Create partner -------------------------------------------------

  protected readonly newPartnerOpen = signal(false);
  protected readonly creatingPartner = signal(false);
  protected readonly newPartnerForm = this.fb.nonNullable.group({
    nom_commercial: ['', [Validators.required, Validators.maxLength(200)]],
    telephone: ['', [Validators.required, e164Phone()]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    adresse_physique: ['', [Validators.required, Validators.maxLength(2000)]],
    ville: ['', [Validators.required, Validators.maxLength(50)]],
    secteur_activite: ['', [Validators.maxLength(100)]],
    rccm: ['', [Validators.maxLength(100)]],
    responsable_nom: ['', [Validators.required, Validators.maxLength(200)]],
    responsable_telephone: ['', [Validators.required, e164Phone()]],
    responsable_email: ['', [Validators.email, Validators.maxLength(255)]],
  });

  // Owner picker — searches ENTREPRISE clients only; the backend has no
  // `type_client` filter on /admin/users, so results are filtered here.
  protected readonly ownerQuery = signal('');
  protected readonly ownerCandidates = signal<AdminUserSummary[]>([]);
  protected readonly loadingOwners = signal(false);
  protected readonly selectedOwner = signal<AdminUserSummary | null>(null);

  openNewPartner(): void {
    this.newPartnerForm.reset({
      nom_commercial: '', telephone: '', email: '', adresse_physique: '', ville: '',
      secteur_activite: '', rccm: '', responsable_nom: '', responsable_telephone: '', responsable_email: '',
    });
    this.ownerQuery.set('');
    this.ownerCandidates.set([]);
    this.selectedOwner.set(null);
    this.newPartnerOpen.set(true);
  }

  searchOwners(q: string): void {
    this.ownerQuery.set(q);
    if (!q.trim()) {
      this.ownerCandidates.set([]);
      return;
    }
    this.loadingOwners.set(true);
    this.users.list({ profil: 'CLIENT', q, limit: 20 }).subscribe({
      next: (page) => {
        this.loadingOwners.set(false);
        this.ownerCandidates.set(page.items.filter((c) => c.type_client === 'ENTREPRISE'));
      },
      error: () => this.loadingOwners.set(false),
    });
  }

  selectOwner(client: AdminUserSummary): void {
    this.selectedOwner.set(client);
    if (!this.newPartnerForm.controls.telephone.value) {
      this.newPartnerForm.controls.telephone.setValue(client.telephone);
    }
  }

  clearOwner(): void {
    this.selectedOwner.set(null);
  }

  createPartner(): void {
    const owner = this.selectedOwner();
    if (!owner || this.newPartnerForm.invalid) {
      this.newPartnerForm.markAllAsTouched();
      return;
    }
    const v = this.newPartnerForm.getRawValue();
    const req: CreatePartnerRequest = {
      owner_uuid: owner.uuid,
      nom_commercial: v.nom_commercial,
      telephone: v.telephone,
      adresse_physique: v.adresse_physique,
      ville: v.ville,
      responsable_nom: v.responsable_nom,
      responsable_telephone: v.responsable_telephone,
      email: v.email || null,
      secteur_activite: v.secteur_activite || null,
      rccm: v.rccm || null,
      responsable_email: v.responsable_email || null,
    };
    this.creatingPartner.set(true);
    this.partners.create(req).subscribe({
      next: () => {
        this.creatingPartner.set(false);
        this.newPartnerOpen.set(false);
        this.toast.success('Partenaire créé — en attente de validation');
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.creatingPartner.set(false);
        this.toast.error('Échec de la création', err.detail);
      },
    });
  }

  // --- Quick validation (UC-ADM-PRT-01 step 2) -----------------------

  protected readonly validateTarget = signal<Partner | null>(null);
  protected readonly validateForm = this.fb.nonNullable.group({
    encours_autorise_xaf: [500000, [Validators.required, Validators.min(0)]],
  });
  protected readonly validating = signal(false);

  openValidate(row: Partner): void {
    this.validateForm.reset({ encours_autorise_xaf: 500000 });
    this.validateTarget.set(row);
  }

  confirmValidate(): void {
    const target = this.validateTarget();
    if (!target || this.validateForm.invalid) {
      this.validateForm.markAllAsTouched();
      return;
    }
    this.validating.set(true);
    this.partners.validate(target.uuid, this.validateForm.getRawValue().encours_autorise_xaf).subscribe({
      next: () => {
        this.validating.set(false);
        this.validateTarget.set(null);
        this.toast.success('Partenaire validé');
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.validating.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Categories (reference data feeding the create/edit forms) ---------

  protected readonly categoriesOpen = signal(false);
  protected readonly categories = signal<PartnerCategory[]>([]);
  protected readonly loadingCategories = signal(false);
  protected readonly savingCategory = signal<string | null>(null);
  protected readonly newCategoryName = signal('');
  protected readonly creatingCategory = signal(false);

  openCategories(): void {
    this.categoriesOpen.set(true);
    this.newCategoryName.set('');
    this.fetchCategories();
  }

  fetchCategories(): void {
    this.loadingCategories.set(true);
    this.partners.listCategories().subscribe({
      next: (page) => { this.loadingCategories.set(false); this.categories.set(page.items); },
      error: (err: ProblemDetails) => { this.loadingCategories.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  renameCategory(category: PartnerCategory, nom: string): void {
    const trimmed = nom.trim();
    if (!trimmed || trimmed === category.nom) return;
    this.savingCategory.set(category.uuid);
    this.partners.updateCategory(category.uuid, trimmed, category.actif).subscribe({
      next: () => {
        this.savingCategory.set(null);
        this.toast.success('Catégorie mise à jour');
        this.fetchCategories();
      },
      error: (err: ProblemDetails) => {
        this.savingCategory.set(null);
        this.toast.error('Échec', err.detail);
        this.fetchCategories();
      },
    });
  }

  toggleCategoryActive(category: PartnerCategory): void {
    this.savingCategory.set(category.uuid);
    this.partners.updateCategory(category.uuid, category.nom, !category.actif).subscribe({
      next: () => { this.savingCategory.set(null); this.fetchCategories(); },
      error: (err: ProblemDetails) => {
        this.savingCategory.set(null);
        this.toast.error('Échec', err.detail);
        this.fetchCategories();
      },
    });
  }

  onNewCategoryNameInput(value: string): void {
    this.newCategoryName.set(value);
  }

  createCategory(): void {
    const nom = this.newCategoryName().trim();
    if (!nom) return;
    this.creatingCategory.set(true);
    this.partners.createCategory(nom).subscribe({
      next: () => {
        this.creatingCategory.set(false);
        this.newCategoryName.set('');
        this.toast.success('Catégorie créée');
        this.fetchCategories();
      },
      error: (err: ProblemDetails) => {
        this.creatingCategory.set(false);
        this.toast.error('Échec de la création', err.detail);
      },
    });
  }
}
