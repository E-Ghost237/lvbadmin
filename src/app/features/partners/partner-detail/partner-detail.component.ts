import { JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PartnersService } from '../../../core/services/partners.service';
import {
  AdminUpdatePartnerRequest, Partner, PartnerAuditEntry, PartnerCategory, PartnerChangeRequest, PartnerDocument,
  PartnerDocumentType, PartnerMember, PartnerRole, PartnerStatus, ProblemDetails,
} from '../../../core/models';
import { formatDate, formatDateTime, humanizeSlug } from '../../../core/utils/formatters';
import { computeReadiness } from '../../../core/utils/partner-access';
import { e164Phone, emailAddress, personName, xafAmount } from '../../../core/utils/validators';
import {
  CmPhoneDirective,
  ColumnDef,
  ConfirmService,
  DataTableComponent,
  FormFeedbackService,
  FormFieldComponent,
  ModalComponent,
  PageHeaderComponent,
  SegmentOption,
  SegmentedControlComponent,
  SelectComponent,
  SelectOption,
  StatusBadgeComponent,
  TabDef,
  TableCellDefDirective,
  TabsComponent,
  ToastService,
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

/** RG-PRT-005 "SENSITIVE" set — the only fields a change-request can touch. */
const SENSITIVE_FIELD_LABELS: Record<string, string> = {
  raison_sociale: 'Raison sociale', numero_contribuable: 'Numéro contribuable',
  rccm: 'RCCM', responsable_nom: 'Nom du responsable',
};

/** Fixed, closed role set (RG-PRT-010) — a partner can never grant a role outside this list. */
const PARTNER_ROLE_LABELS: Record<PartnerRole, string> = {
  RESPONSABLE_PARTENAIRE: 'Responsable', OPERATEUR_PARTENAIRE: 'Opérateur', LECTEUR_PARTENAIRE: 'Lecteur',
};
const PARTNER_ROLE_VALUES: PartnerRole[] = ['RESPONSABLE_PARTENAIRE', 'OPERATEUR_PARTENAIRE', 'LECTEUR_PARTENAIRE'];
const PARTNER_ROLE_OPTIONS: SelectOption[] = PARTNER_ROLE_VALUES.map((value) => ({ value, label: PARTNER_ROLE_LABELS[value] }));

const INVITE_CONTACT_OPTIONS: SegmentOption[] = [{ value: 'email', label: 'Email' }, { value: 'telephone', label: 'Téléphone' }];

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
  CmPhoneDirective,
  DataTableComponent,
  FormFieldComponent,
  JsonPipe,
  ModalComponent,
  PageHeaderComponent,
  ReactiveFormsModule,
  SegmentedControlComponent,
  SelectComponent,
  StatusBadgeComponent,
  TableCellDefDirective,
  TabsComponent,
],
  templateUrl: './partner-detail.component.html',
})
export class PartnerDetailComponent {
  private readonly partners = inject(PartnersService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);

  protected readonly uuid = this.route.snapshot.paramMap.get('uuid')!;
  protected readonly loading = signal(true);
  protected readonly partner = signal<Partner | null>(null);
  protected readonly categories = signal<PartnerCategory[]>([]);
  protected readonly categoryOptions = computed<SelectOption[]>(() =>
    this.categories().map((c) => ({ value: c.uuid, label: c.nom })));

  protected readonly transitions = computed(() => STATUS_TRANSITIONS[this.partner()?.statut_partenaire ?? 'ARCHIVE'] ?? []);
  protected readonly changingStatus = signal(false);

  protected readonly tabs: TabDef[] = [
    { id: 'profil', label: 'Profil' }, { id: 'documents', label: 'Documents' }, { id: 'changes', label: 'Demandes de modification' },
    { id: 'team', label: 'Équipe' }, { id: 'audit', label: 'Journal d’audit' },
  ];
  protected readonly activeTab = signal('profil');

  constructor() {
    this.fetch();
    this.partners.listCategories().subscribe({ next: (page) => this.categories.set(page.items), error: () => {} });
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'documents') {
      if (this.documents().length === 0) this.fetchDocuments();
      this.fetchChangeRequests(); // lets the Numéro column show a value waiting for approval
    }
    if (id === 'changes' && this.changeRequests().length === 0) this.fetchChangeRequests();
    if (id === 'team' && this.members().length === 0) this.fetchMembers();
    if (id === 'audit' && this.auditEntries().length === 0) this.fetchAudit();
  }

  // What LVB requires before VALIDE / ACTIF (mirrors ManagePartnerProfile::transition on the backend).
  // Loaded separately from the paged Documents tab so the check always sees every document.
  private readonly readinessDocs = signal<PartnerDocument[] | null>(null);
  protected readonly readiness = computed(() => computeReadiness(this.partner(), this.readinessDocs() ?? []));
  protected readonly showReadiness = computed(() => ['EN_ATTENTE_VALIDATION', 'VALIDE'].includes(this.partner()?.statut_partenaire ?? ''));

  private loadReadinessDocs(): void {
    this.partners.listDocuments(this.uuid, { limit: 100 }).subscribe({
      next: (page) => this.readinessDocs.set(page.items),
      error: () => this.readinessDocs.set(null),
    });
  }

  /** Blocks (with the exact list of what's missing) instead of letting the API answer ERR-4229/4097. */
  private assertReady(): boolean {
    if (this.readinessDocs() === null) return true; // couldn't load — let the server decide
    const r = this.readiness();
    if (r.ready) return true;
    this.feedback.blocked(`Dossier incomplet — il manque : ${r.missing.join(' ; ')}.`, 'Validation impossible');
    return false;
  }

  fetch(): void {
    this.loading.set(true);
    this.loadReadinessDocs();
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
    if (transition.target === 'ACTIF' && this.partner()?.statut_partenaire === 'VALIDE' && !this.assertReady()) return;
    this.changingStatus.set(true);
    this.partners.changeStatus(this.uuid, transition.target, motif).subscribe({
      next: (p) => { this.changingStatus.set(false); this.partner.set(p); this.toast.success('Statut mis à jour'); },
      error: (err: ProblemDetails) => { this.changingStatus.set(false); this.feedback.serverError(null, 'Échec', err); },
    });
  }

  // --- Validation (UC-ADM-PRT-01 step 2) -------------------------------

  protected readonly validateOpen = signal(false);
  protected readonly validateForm = this.fb.nonNullable.group({
    encours_autorise_xaf: [500000, [Validators.required, xafAmount(0)]],
  });
  protected readonly validating = signal(false);

  openValidate(): void {
    if (!this.assertReady()) return;
    this.validateForm.reset({ encours_autorise_xaf: 500000 });
    this.validateOpen.set(true);
  }

  confirmValidate(): void {
    if (this.validateForm.invalid) {
      this.feedback.invalid(this.validateForm);
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
        this.feedback.serverError(this.validateForm, 'Échec', err);
      },
    });
  }

  // --- Profile edit (RG-PRT-005 "DIRECT" fields only) ------------------

  protected readonly editOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editForm = this.fb.nonNullable.group({
    nom_commercial: ['', [Validators.required, Validators.maxLength(200)]],
    telephone: ['', [Validators.required, e164Phone()]],
    email: ['', [emailAddress(), Validators.maxLength(255)]],
    secteur_activite: ['', [Validators.maxLength(100)]],
    adresse_physique: ['', [Validators.required, Validators.maxLength(2000)]],
    ville: ['', [Validators.required, Validators.maxLength(50)]],
    site_web: ['', [Validators.maxLength(2048)]],
    responsable_telephone: ['', [Validators.required, e164Phone()]],
    responsable_email: ['', [emailAddress(), Validators.maxLength(255)]],
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
      this.feedback.invalid(this.editForm);
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

  /**
   * RCCM and FISCAL documents carry a registration number that lives on the profile
   * (set only through an approved change request). Show it beside the file so the reviewer
   * can compare them — or the pending value waiting for approval.
   */
  protected declaredNumber(doc: PartnerDocument): string {
    const field = doc.type_document === 'RCCM' ? 'rccm' : doc.type_document === 'FISCAL' ? 'numero_contribuable' : null;
    if (!field) return '—';
    const current = (this.partner() as unknown as Record<string, string | null> | null)?.[field];
    if (current) return current;
    const pending = this.changeRequests().find((c) => c.statut === 'EN_ATTENTE' && c.valeurs_apres[field]);
    return pending ? `${pending.valeurs_apres[field]} — à approuver (onglet Demandes)` : 'Non renseigné';
  }

  protected readonly documentColumns: ColumnDef<PartnerDocument>[] = [
    { key: 'type_document', label: 'Type', cell: (r) => DOCUMENT_TYPE_LABELS[r.type_document] },
    { key: 'numero', label: 'Numéro déclaré', cell: (r) => this.declaredNumber(r) },
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
        this.loadReadinessDocs();
      },
      error: (err: ProblemDetails) => {
        this.reviewingDocument.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Sensitive-field change requests (RG-PRT-005) --------------------

  protected readonly changeRequests = signal<PartnerChangeRequest[]>([]);
  protected readonly loadingChanges = signal(true);
  protected readonly decidingChange = signal<string | null>(null);

  fetchChangeRequests(): void {
    this.loadingChanges.set(true);
    this.partners.listChangeRequests(this.uuid).subscribe({
      next: (res) => { this.loadingChanges.set(false); this.changeRequests.set(res.items); },
      error: (err: ProblemDetails) => { this.loadingChanges.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  changedFields(change: PartnerChangeRequest): { label: string; before: string; after: string }[] {
    return Object.entries(change.valeurs_apres)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([field, after]) => ({
        label: SENSITIVE_FIELD_LABELS[field] ?? field,
        before: String(change.valeurs_avant[field] ?? '—'),
        after,
      }));
  }

  async decideChange(change: PartnerChangeRequest, accepte: boolean): Promise<void> {
    const motif = await this.confirm.askReason({
      title: accepte ? 'Approuver cette demande ?' : 'Rejeter cette demande ?',
      label: accepte ? 'Motif de la décision' : 'Motif du rejet', minLength: 3, danger: !accepte,
      confirmLabel: accepte ? 'Approuver' : 'Rejeter',
    });
    if (!motif) return;
    this.decidingChange.set(change.uuid);
    this.partners.decideChangeRequest(this.uuid, change.uuid, accepte, motif).subscribe({
      next: () => {
        this.decidingChange.set(null);
        this.toast.success(accepte ? 'Modification approuvée' : 'Modification rejetée');
        this.fetchChangeRequests();
        if (accepte) this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.decidingChange.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Team (PRT-M04, RG-PRT-010) ---------------------------------------

  protected readonly roleLabel = PARTNER_ROLE_LABELS;
  protected readonly roleValues = PARTNER_ROLE_VALUES;
  protected readonly roleOptions = PARTNER_ROLE_OPTIONS;
  protected readonly inviteContactOptions = INVITE_CONTACT_OPTIONS;
  protected readonly memberColumns: ColumnDef<PartnerMember>[] = [
    { key: 'nom', label: 'Membre' },
    { key: 'role', label: 'Rôle' },
    { key: 'actif', label: 'Statut' },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByMemberUuid = (row: PartnerMember) => row.uuid;

  protected readonly members = signal<PartnerMember[]>([]);
  protected readonly loadingMembers = signal(true);
  protected readonly changingMemberRole = signal<string | null>(null);
  protected readonly revokingMember = signal<string | null>(null);

  fetchMembers(): void {
    this.loadingMembers.set(true);
    this.partners.listMembers(this.uuid).subscribe({
      next: (res) => { this.loadingMembers.set(false); this.members.set(res.items); },
      error: (err: ProblemDetails) => { this.loadingMembers.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  onMemberRoleChange(member: PartnerMember, role: string): void {
    if (role === member.role) return;
    this.changingMemberRole.set(member.uuid);
    this.partners.changeMemberRole(this.uuid, member.uuid, role as PartnerRole).subscribe({
      next: () => {
        this.changingMemberRole.set(null);
        this.toast.success('Rôle mis à jour');
        this.fetchMembers();
      },
      error: (err: ProblemDetails) => {
        this.changingMemberRole.set(null);
        this.toast.error('Échec', err.detail);
        this.fetchMembers();
      },
    });
  }

  async revokeMember(member: PartnerMember): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Révoquer ce membre ?',
      message: `${member.utilisateur?.prenom ?? ''} ${member.utilisateur?.nom ?? ''} perdra l’accès au périmètre partenaire.`.trim(),
      danger: true, confirmLabel: 'Révoquer',
    });
    if (!ok) return;
    this.revokingMember.set(member.uuid);
    this.partners.revokeMember(this.uuid, member.uuid).subscribe({
      next: () => {
        this.revokingMember.set(null);
        this.toast.success('Membre révoqué');
        this.fetchMembers();
      },
      error: (err: ProblemDetails) => {
        this.revokingMember.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Invitation ---------------------------------------------------

  protected readonly inviteOpen = signal(false);
  protected readonly inviting = signal(false);
  protected readonly inviteContactType = signal<'email' | 'telephone'>('email');
  protected readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [emailAddress(), Validators.maxLength(254)]],
    telephone: ['', [e164Phone()]],
    role: ['LECTEUR_PARTENAIRE' as PartnerRole, [Validators.required]],
  });

  openInvite(): void {
    this.inviteForm.reset({ email: '', telephone: '', role: 'LECTEUR_PARTENAIRE' });
    this.inviteContactType.set('email');
    this.inviteOpen.set(true);
  }

  setInviteContactType(type: string): void {
    this.inviteContactType.set(type as 'email' | 'telephone');
  }

  submitInvite(): void {
    const type = this.inviteContactType();
    const control = this.inviteForm.controls[type];
    const contact = control.value.trim();
    if (!contact) control.setErrors({ required: true });
    if (!contact || control.invalid) {
      control.markAsTouched();
      this.feedback.invalid(this.inviteForm);
      return;
    }
    const role = this.inviteForm.getRawValue().role;
    this.inviting.set(true);
    this.partners.inviteMember(this.uuid, type === 'email' ? { email: contact, role } : { telephone: contact, role }).subscribe({
      next: (inv) => {
        this.inviting.set(false);
        this.inviteOpen.set(false);
        this.toast.success(`Invitation envoyée — expire le ${this.dateTime(inv.expire_le)}`);
      },
      error: (err: ProblemDetails) => {
        this.inviting.set(false);
        this.toast.error('Échec de l’invitation', err.detail);
      },
    });
  }

  // --- Audit (P-C10) -----------------------------------------------

  protected readonly auditColumns: ColumnDef<PartnerAuditEntry>[] = [
    { key: 'cree_le', label: 'Horodatage', cell: (r) => formatDateTime(r.cree_le) },
    { key: 'action', label: 'Action', cell: (r) => humanizeSlug(r.action) },
    { key: 'ressource_type', label: 'Ressource', cell: (r) => humanizeSlug(r.ressource_type) },
    { key: 'acteur_type', label: 'Acteur', cell: (r) => humanizeSlug(r.acteur_type) },
    { key: 'ip', label: 'IP', cell: (r) => r.ip ?? '—' },
  ];
  /** Exposed for the raw-value detail modal — the table itself always shows the humanized form. */
  protected readonly humanize = humanizeSlug;
  protected readonly trackByAuditId = (row: PartnerAuditEntry) => row.id;

  protected readonly auditEntries = signal<PartnerAuditEntry[]>([]);
  protected readonly loadingAudit = signal(true);
  protected readonly auditCursor = signal<number | null>(null);
  protected readonly auditDetail = signal<PartnerAuditEntry | null>(null);

  fetchAudit(cursor?: number): void {
    this.loadingAudit.set(true);
    this.partners.audit(this.uuid, { cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingAudit.set(false);
        this.auditEntries.set(cursor ? [...this.auditEntries(), ...page.items] : page.items);
        this.auditCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingAudit.set(false);
        this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  openAuditDetail(entry: PartnerAuditEntry): void {
    this.auditDetail.set(entry);
  }
}
