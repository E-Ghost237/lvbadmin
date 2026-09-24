import { KeyValuePipe } from '@angular/common';
import { emailAddress, e164Phone, personName, webUrl } from '@lvb/utils/validators';
import { analyzeCmPhone, analyzeEmail } from '@lvb/utils/cameroon';
import { CmPhoneDirective } from '@lvb/ui/cm-phone/cm-phone.directive';
import { PartnerContextService } from '../../../core/services/partner-context.service';
import { I18nService } from '@lvb/i18n/i18n.service';
import { FormFeedbackService } from '@lvb/ui/form-feedback/form-feedback.service';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PartnerProfileService } from '../../../core/services/partner-profile.service';
import { InvitePartnerUserRequest, RequestPartnerProfileChangeRequest } from '../../../core/models';
import { Partner, PartnerChangeRequest, PartnerDocument, PartnerInvitation, PartnerMember } from '@lvb/models/partner.model';
import { PartnerDocumentType, PartnerRole } from '@lvb/models/enums';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatDate, formatDateTime } from '@lvb/utils/formatters';
import { BreadcrumbsComponent } from '@lvb/ui/breadcrumbs/breadcrumbs.component';
import { TabDef, TabsComponent } from '@lvb/ui/tabs/tabs.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatusBadgeComponent } from '@lvb/ui/status-badge/status-badge.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ColumnDef, DataTableComponent } from '@lvb/ui/table/data-table.component';
import { TableCellDefDirective } from '@lvb/ui/table/table-cell-def.directive';
import { FileDropComponent } from '@lvb/ui/file-drop/file-drop.component';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { ConfirmService } from '@lvb/ui/confirm/confirm.service';
import { ToastService } from '@lvb/ui/toast/toast.service';

const DOCUMENT_TYPE_LABELS: Record<PartnerDocumentType, string> = {
  RCCM: 'RCCM', FISCAL: 'Attestation fiscale', ID_RESPONSABLE: 'Pièce d’identité du responsable',
  CONTRAT_LVB: 'Contrat LVB', AUTRE: 'Autre',
};
const DOCUMENT_TYPE_OPTIONS: SelectOption[] = (Object.keys(DOCUMENT_TYPE_LABELS) as PartnerDocumentType[])
  .map((value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }));

const ROLE_LABELS: Record<PartnerRole, string> = {
  RESPONSABLE_PARTENAIRE: 'Responsable', OPERATEUR_PARTENAIRE: 'Opérateur', LECTEUR_PARTENAIRE: 'Lecteur',
};
const ROLE_OPTIONS: SelectOption[] = (Object.keys(ROLE_LABELS) as PartnerRole[]).map((value) => ({ value, label: ROLE_LABELS[value] }));

/**
 * Org self-service — `/v1/partner/{profile,documents,users}*`
 * (LVB-CDC-PART-2026-V1.0). Only RESPONSABLE_PARTENAIRE has `profile.write`/
 * `documents.write`/`users.manage`; other roles see read-only views or a 403
 * on the write actions, surfaced via ForbiddenStateComponent per action.
 */
@Component({
  selector: 'app-profile-page',
  imports: [
    ReactiveFormsModule, KeyValuePipe, BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent,
    SelectComponent, DataTableComponent, TableCellDefDirective, FileDropComponent, FormFieldComponent, CmPhoneDirective,
  ],
  templateUrl: './profile-page.component.html',
})
export class ProfilePageComponent {
  private readonly profileSvc = inject(PartnerProfileService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  protected readonly ctx = inject(PartnerContextService);
  protected readonly canWrite = computed(() => this.ctx.can('profile.write'));
  protected readonly canUpload = computed(() => this.ctx.can('documents.write'));
  protected readonly canManageUsers = computed(() => this.ctx.can('users.manage'));
  private readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [
    { id: 'profile', label: 'Profil' }, { id: 'documents', label: 'Documents' }, { id: 'team', label: 'Équipe' },
  ];
  protected readonly activeTab = signal('profile');
  protected readonly documentTypeOptions = DOCUMENT_TYPE_OPTIONS;
  protected readonly documentTypeLabel = DOCUMENT_TYPE_LABELS;
  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly roleLabel = ROLE_LABELS;

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  date(iso: string | null): string {
    return formatDate(iso);
  }

  constructor() {
    effect(() => {
      // Read-only roles see the data but can't edit it.
      if (this.canWrite()) { this.profileForm.enable({ emitEvent: false }); this.changeForm.enable({ emitEvent: false }); }
      else { this.profileForm.disable({ emitEvent: false }); this.changeForm.disable({ emitEvent: false }); }
    });
    this.fetchProfile();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'documents' && this.documents().length === 0 && !this.loadingDocuments()) this.fetchDocuments();
    if (id === 'team' && this.members().length === 0 && !this.loadingMembers()) this.fetchMembers();
  }

  // --- Profile --------------------------------------------------------

  protected readonly profile = signal<Partner | null>(null);
  protected readonly loadingProfile = signal(true);
  protected readonly forbiddenProfile = signal(false);
  protected readonly savingProfile = signal(false);

  protected readonly profileForm = this.fb.nonNullable.group({
    nom_commercial: ['', [Validators.required, Validators.maxLength(200)]],
    telephone: ['', [Validators.required, e164Phone()]],
    email: ['', [emailAddress(), Validators.maxLength(255)]],
    adresse_physique: ['', [Validators.required, Validators.maxLength(2000)]],
    ville: ['', [Validators.required, Validators.maxLength(50)]],
    secteur_activite: ['', [Validators.maxLength(100)]],
    site_web: ['', [webUrl(), Validators.maxLength(2048)]],
    logo_url: ['', [webUrl(true), Validators.maxLength(2048)]],
    responsable_telephone: ['', [Validators.required, e164Phone()]],
    responsable_email: ['', [emailAddress(), Validators.maxLength(255)]],
    zones_desservies: [''],
  });

  protected readonly changeForm = this.fb.nonNullable.group({
    raison_sociale: ['', [Validators.maxLength(200)]],
    numero_contribuable: ['', [Validators.maxLength(50)]],
    rccm: ['', [Validators.maxLength(100)]],
    responsable_nom: ['', [personName(), Validators.maxLength(200)]],
  });
  protected readonly showChangeForm = signal(false);
  protected readonly submittingChange = signal(false);
  protected readonly changeRequests = signal<PartnerChangeRequest[]>([]);
  protected readonly loadingChangeRequests = signal(false);

  fetchProfile(): void {
    this.loadingProfile.set(true);
    this.forbiddenProfile.set(false);
    this.profileSvc.getProfile().subscribe({
      next: (p) => {
        this.loadingProfile.set(false);
        this.profile.set(p);
        this.profileForm.reset({
          nom_commercial: p.nom_commercial, telephone: p.telephone, email: p.email ?? '',
          adresse_physique: p.adresse_physique, ville: p.ville, secteur_activite: p.secteur_activite ?? '',
          site_web: p.site_web ?? '', logo_url: p.logo_url ?? '', responsable_telephone: p.responsable_telephone,
          responsable_email: p.responsable_email ?? '', zones_desservies: p.zones_desservies.join(', '),
        });
      },
      error: (err: ProblemDetails) => {
        this.loadingProfile.set(false);
        if (err.status === 403) this.forbiddenProfile.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
    this.fetchChangeRequests();
  }

  fetchChangeRequests(): void {
    this.loadingChangeRequests.set(true);
    this.profileSvc.listChangeRequests().subscribe({
      next: (page) => { this.loadingChangeRequests.set(false); this.changeRequests.set(page.items); },
      error: () => this.loadingChangeRequests.set(false),
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.feedback.invalid(this.profileForm);
      return;
    }
    const v = this.profileForm.getRawValue();
    this.savingProfile.set(true);
    this.profileSvc.updateProfile({
      nom_commercial: v.nom_commercial, telephone: v.telephone, email: v.email || null,
      adresse_physique: v.adresse_physique, ville: v.ville, secteur_activite: v.secteur_activite || null,
      site_web: v.site_web || null, logo_url: v.logo_url || null, responsable_telephone: v.responsable_telephone,
      responsable_email: v.responsable_email || null,
      zones_desservies: v.zones_desservies.split(',').map((z) => z.trim()).filter(Boolean),
    }).subscribe({
      next: (p) => { this.savingProfile.set(false); this.profile.set(p); this.toast.success('Profil mis à jour'); },
      error: (err: ProblemDetails) => { this.savingProfile.set(false); this.feedback.serverError(this.profileForm, 'Échec', err); },
    });
  }

  openChangeForm(): void {
    const p = this.profile();
    this.changeForm.reset({
      raison_sociale: p?.raison_sociale ?? '', numero_contribuable: p?.numero_contribuable ?? '',
      rccm: p?.rccm ?? '', responsable_nom: p?.responsable_nom ?? '',
    });
    this.showChangeForm.set(true);
  }

  submitChangeRequest(): void {
    const v = this.changeForm.getRawValue();
    const patch: RequestPartnerProfileChangeRequest = {};
    if (v.raison_sociale.trim()) patch.raison_sociale = v.raison_sociale.trim();
    if (v.numero_contribuable.trim()) patch.numero_contribuable = v.numero_contribuable.trim();
    if (v.rccm.trim()) patch.rccm = v.rccm.trim();
    if (v.responsable_nom.trim()) patch.responsable_nom = v.responsable_nom.trim();
    if (Object.keys(patch).length === 0) return;
    this.submittingChange.set(true);
    this.profileSvc.requestProfileChange(patch).subscribe({
      next: () => {
        this.submittingChange.set(false);
        this.showChangeForm.set(false);
        this.toast.success('Demande envoyée — en attente de validation par un administrateur');
        this.fetchChangeRequests();
      },
      error: (err: ProblemDetails) => { this.submittingChange.set(false); this.feedback.serverError(this.changeForm, 'Échec', err); },
    });
  }

  // --- Documents --------------------------------------------------------

  protected readonly documentColumns: ColumnDef<PartnerDocument>[] = [
    { key: 'type_document', label: 'Type', cell: (r) => this.documentTypeLabel[r.type_document] },
    { key: 'version', label: 'Version' },
    { key: 'statut_verification', label: 'Statut' },
    { key: 'expire_le', label: 'Expire le', cell: (r) => (r.expire_le ? this.date(r.expire_le) : '—') },
    { key: 'cree_le', label: 'Déposé le', cell: (r) => this.dateTime(r.cree_le) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByDocumentUuid = (row: PartnerDocument) => row.uuid;

  protected readonly documents = signal<PartnerDocument[]>([]);
  protected readonly loadingDocuments = signal(false);
  protected readonly forbiddenDocuments = signal(false);
  protected readonly documentsCursor = signal<string | null>(null);
  protected readonly downloadingDocument = signal<string | null>(null);

  protected readonly uploadType = signal<PartnerDocumentType | ''>('');
  protected readonly uploadExpiry = signal('');
  protected readonly uploadFile = signal<File | null>(null);
  protected readonly uploading = signal(false);

  fetchDocuments(cursor?: string): void {
    this.loadingDocuments.set(true);
    this.forbiddenDocuments.set(false);
    this.profileSvc.listDocuments({ cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingDocuments.set(false);
        this.documents.set(cursor ? [...this.documents(), ...page.items] : page.items);
        this.documentsCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingDocuments.set(false);
        if (err.status === 403) this.forbiddenDocuments.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onUploadTypeChange(value: string): void {
    this.uploadType.set(value as PartnerDocumentType | '');
  }

  onUploadExpiryInput(value: string): void {
    this.uploadExpiry.set(value);
  }

  onUploadFileSelected(file: File): void {
    this.uploadFile.set(file);
  }

  submitUpload(): void {
    const type = this.uploadType();
    const file = this.uploadFile();
    if (!type || !file) return;
    this.uploading.set(true);
    this.profileSvc.uploadDocument(type, file, this.uploadExpiry() || undefined).subscribe({
      next: () => {
        this.uploading.set(false);
        this.uploadType.set('');
        this.uploadExpiry.set('');
        this.uploadFile.set(null);
        this.toast.success('Document déposé');
        this.fetchDocuments();
        void this.ctx.refresh();
      },
      error: (err: ProblemDetails) => { this.uploading.set(false); this.toast.error('Échec du dépôt', err.detail); },
    });
  }

  downloadDocument(doc: PartnerDocument): void {
    this.downloadingDocument.set(doc.uuid);
    this.profileSvc.downloadDocument(doc.uuid).subscribe({
      next: (res) => {
        this.downloadingDocument.set(null);
        if (typeof window !== 'undefined') window.open(res.url, '_blank', 'noopener');
      },
      error: (err: ProblemDetails) => { this.downloadingDocument.set(null); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Team ---------------------------------------------------------------

  protected readonly memberColumns: ColumnDef<PartnerMember>[] = [
    { key: 'nom', label: 'Nom', cell: (r) => (r.utilisateur ? `${r.utilisateur.prenom ?? ''} ${r.utilisateur.nom}`.trim() : '—') },
    { key: 'role', label: 'Rôle' },
    { key: 'actif', label: 'Statut', cell: (r) => (r.actif ? 'Actif' : 'Révoqué') },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByMemberUuid = (row: PartnerMember) => row.uuid;

  protected readonly members = signal<PartnerMember[]>([]);
  protected readonly loadingMembers = signal(false);
  protected readonly forbiddenMembers = signal(false);
  protected readonly updatingMember = signal<string | null>(null);

  protected readonly inviteContact = signal('');
  protected readonly inviteRole = signal<PartnerRole>('OPERATEUR_PARTENAIRE');
  protected readonly inviting = signal(false);

  fetchMembers(): void {
    this.loadingMembers.set(true);
    this.forbiddenMembers.set(false);
    this.profileSvc.listMembers().subscribe({
      next: (page) => { this.loadingMembers.set(false); this.members.set(page.items); },
      error: (err: ProblemDetails) => {
        this.loadingMembers.set(false);
        if (err.status === 403) this.forbiddenMembers.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onInviteContactInput(value: string): void {
    this.inviteContact.set(value);
  }

  onInviteRoleChange(value: string): void {
    this.inviteRole.set(value as PartnerRole);
  }

  private emailIssue(v: string): string | null {
    const a = analyzeEmail(v);
    return a.ok ? null : this.i18n.t('validation.email.' + a.issue);
  }

  private phoneIssue(v: string): string | null {
    const a = analyzeCmPhone(v);
    return a.ok ? null : this.i18n.t('validation.phone.' + a.issue, { delta: a.delta ?? 0 });
  }

  submitInvite(): void {
    const contact = this.inviteContact().trim();
    if (!contact) {
      this.feedback.blocked('Saisissez l’email ou le numéro de téléphone de la personne à inviter.', 'Invitation incomplète');
      return;
    }
    const reason = contact.includes('@') ? this.emailIssue(contact) : this.phoneIssue(contact);
    if (reason) {
      this.feedback.blocked(reason, 'Invitation impossible');
      return;
    }
    const invite: InvitePartnerUserRequest = contact.includes('@')
      ? { email: contact.toLowerCase(), role: this.inviteRole() }
      : { telephone: analyzeCmPhone(contact).e164 ?? contact, role: this.inviteRole() };
    this.inviting.set(true);
    this.profileSvc.inviteMember(invite).subscribe({
      next: () => {
        this.inviting.set(false);
        this.inviteContact.set('');
        this.toast.success('Invitation envoyée');
      },
      error: (err: ProblemDetails) => { this.inviting.set(false); this.feedback.serverError(null, 'Échec de l’invitation', err); },
    });
  }

  async changeMemberRole(member: PartnerMember, role: string): Promise<void> {
    const target = role as PartnerRole;
    if (target === member.role) return;
    const ok = await this.confirm.ask({
      title: `Changer le rôle ?`, message: `${this.roleLabel[member.role]} → ${this.roleLabel[target]}. La session de ce membre sera révoquée.`,
    });
    if (!ok) return;
    this.updatingMember.set(member.uuid);
    this.profileSvc.changeMemberRole(member.uuid, target).subscribe({
      next: () => { this.updatingMember.set(null); this.toast.success('Rôle mis à jour'); this.fetchMembers(); },
      error: (err: ProblemDetails) => { this.updatingMember.set(null); this.toast.error('Échec', err.detail); },
    });
  }

  async revokeMember(member: PartnerMember): Promise<void> {
    const name = member.utilisateur ? `${member.utilisateur.prenom ?? ''} ${member.utilisateur.nom}`.trim() : member.uuid;
    const ok = await this.confirm.ask({
      title: `Révoquer l’accès de ${name} ?`, message: 'Cette personne perdra immédiatement l’accès au portail partenaire.', danger: true,
    });
    if (!ok) return;
    this.updatingMember.set(member.uuid);
    this.profileSvc.revokeMember(member.uuid).subscribe({
      next: () => { this.updatingMember.set(null); this.toast.success('Accès révoqué'); this.fetchMembers(); },
      error: (err: ProblemDetails) => { this.updatingMember.set(null); this.toast.error('Échec', err.detail); },
    });
  }
}
