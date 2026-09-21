import { SlicePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersService } from '../../../core/services/users.service';
import { RolesService } from '../../../core/services/roles.service';
import { AdminUserSummary, CursorPage, ProblemDetails, RbacCatalog, RbacRole, UserProfile } from '../../../core/models';
import { formatDate, humanizeSlug } from '../../../core/utils/formatters';
import { e164Phone, matchControls, passwordPolicy } from '../../../core/utils/validators';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ColumnDef, ConfirmService, DataTableComponent, ForbiddenStateComponent, FormFieldComponent,
  ModalComponent, SearchInputComponent, StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-users-page',
  imports: [
    SlicePipe, ReactiveFormsModule, BreadcrumbsComponent, TabsComponent, DataTableComponent, SearchInputComponent,
    StatusBadgeComponent, ForbiddenStateComponent, TableCellDefDirective, ModalComponent, FormFieldComponent,
  ],
  templateUrl: './users-page.component.html',
})
export class UsersPageComponent {
  private readonly users = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [
    { id: 'clients', label: 'Clients' }, { id: 'internal', label: 'Personnel interne' }, { id: 'roles', label: 'Rôles & permissions' },
  ];
  protected readonly activeTab = signal('clients');

  protected readonly columns: ColumnDef<AdminUserSummary>[] = [
    { key: 'nom', label: 'Nom', cell: (r) => `${r.prenom ?? ''} ${r.nom}`.trim() },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'statut', label: 'Statut' },
    { key: 'cree_le', label: 'Inscrit le', cell: (r) => formatDate(r.cree_le) },
  ];

  protected readonly trackByUuid = (row: AdminUserSummary) => row.uuid;

  // --- Clients ------------------------------------------------------------
  protected readonly clientRows = signal<AdminUserSummary[]>([]);
  protected readonly loadingClients = signal(true);
  protected readonly forbiddenClients = signal(false);
  protected readonly clientCursor = signal<number | null>(null);
  protected readonly clientSearch = signal('');

  // --- Internal staff -------------------------------------------------
  protected readonly internalRows = signal<AdminUserSummary[]>([]);
  protected readonly loadingInternal = signal(true);
  protected readonly forbiddenInternal = signal(false);
  protected readonly internalCursor = signal<number | null>(null);

  // --- New internal account -----------------------------------------------
  // A staff account gets exactly one role (a single-select, not a multi-role
  // picker) — the backend contract's `roles` field still takes an array, so
  // this sends a one-element array rather than dropping down to a scalar.
  protected readonly newInternalOpen = signal(false);
  protected readonly creatingInternal = signal(false);
  protected readonly newInternalForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    prenom: [''],
    telephone: ['', [Validators.required, e164Phone()]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    langue: ['fr' as 'fr' | 'en', [Validators.required]],
    role: ['', [Validators.required]],
    password: ['', [Validators.required, passwordPolicy()]],
    password_confirmation: ['', [Validators.required]],
  }, { validators: [matchControls('password', 'password_confirmation')] });

  // --- Role assignment --------------------------------------------------
  // Same one-role-per-account rule as account creation — this replaces a
  // user's whole role set, so it takes exactly one value, sent as a
  // one-element array to match the backend's `roles: string[]` contract.
  protected readonly assignTarget = signal<AdminUserSummary | null>(null);
  protected readonly assignRole = signal('');
  protected readonly assigning = signal(false);

  // --- Roles & permissions ------------------------------------------------
  protected readonly catalog = signal<RbacCatalog | null>(null);
  protected readonly loadingCatalog = signal(true);
  protected readonly forbiddenCatalog = signal(false);
  protected readonly newRoleOpen = signal(false);
  protected readonly newRoleForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]{2,49}$/)]],
  });
  protected readonly newRolePermissions = signal<Set<string>>(new Set());
  protected readonly savingRole = signal(false);

  constructor() {
    this.fetchClients();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'internal' && this.internalRows().length === 0) this.fetchInternal();
    if (id === 'roles' && !this.catalog()) this.fetchCatalog();
  }

  private fetchList(profil: UserProfile, q: string | undefined, cursor: number | undefined, onOk: (page: CursorPage<AdminUserSummary>) => void, onForbidden: () => void, onDone: () => void): void {
    this.users.list({ profil, q, cursor }).subscribe({
      next: (page) => { onOk(page); onDone(); },
      error: (err: ProblemDetails) => {
        onDone();
        if (err.status === 403) onForbidden();
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  fetchClients(cursor?: number): void {
    this.loadingClients.set(true);
    this.forbiddenClients.set(false);
    this.fetchList('CLIENT', this.clientSearch() || undefined, cursor,
      (page) => { this.clientRows.set(cursor ? [...this.clientRows(), ...page.items] : page.items); this.clientCursor.set(page.next_cursor); },
      () => this.forbiddenClients.set(true),
      () => this.loadingClients.set(false));
  }

  onClientSearch(q: string): void {
    this.clientSearch.set(q);
    this.fetchClients();
  }

  fetchInternal(cursor?: number): void {
    this.loadingInternal.set(true);
    this.forbiddenInternal.set(false);
    this.fetchList('INTERNE', undefined, cursor,
      (page) => { this.internalRows.set(cursor ? [...this.internalRows(), ...page.items] : page.items); this.internalCursor.set(page.next_cursor); },
      () => this.forbiddenInternal.set(true),
      () => this.loadingInternal.set(false));
  }

  async suspend(row: AdminUserSummary, refresh: () => void): Promise<void> {
    const motif = await this.confirm.askReason({
      title: 'Suspendre ce compte ?', message: `${row.prenom} ${row.nom} ne pourra plus se connecter.`,
      label: 'Motif de suspension', minLength: 5, danger: true, confirmLabel: 'Suspendre',
    });
    if (!motif) return;
    this.users.suspend(row.uuid, motif).subscribe({
      next: () => { this.toast.success('Compte suspendu'); refresh(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  reactivate(row: AdminUserSummary, refresh: () => void): void {
    this.users.reactivate(row.uuid).subscribe({
      next: () => { this.toast.success('Compte réactivé'); refresh(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  async remove(row: AdminUserSummary, refresh: () => void): Promise<void> {
    const motif = await this.confirm.askReason({
      title: 'Supprimer ce compte ?', message: 'Anonymisation conforme à la politique de rétention.',
      label: 'Motif de suppression', minLength: 5, danger: true, confirmLabel: 'Supprimer',
    });
    if (!motif) return;
    this.users.delete(row.uuid, motif).subscribe({
      next: () => { this.toast.success('Compte supprimé'); refresh(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  openNewInternal(): void {
    this.newInternalForm.reset({ nom: '', prenom: '', telephone: '', email: '', langue: 'fr', role: '', password: '', password_confirmation: '' });
    this.newInternalOpen.set(true);
    if (!this.catalog()) this.fetchCatalog();
  }

  createInternalAccount(): void {
    if (this.newInternalForm.invalid) {
      this.newInternalForm.markAllAsTouched();
      return;
    }
    const v = this.newInternalForm.getRawValue();
    this.creatingInternal.set(true);
    this.users.createInternal({
      telephone: v.telephone, email: v.email, nom: v.nom, prenom: v.prenom || null, langue: v.langue,
      password: v.password, password_confirmation: v.password_confirmation, roles: [v.role],
    }).subscribe({
      next: () => {
        this.creatingInternal.set(false);
        this.newInternalOpen.set(false);
        this.toast.success('Compte interne créé');
        this.fetchInternal();
      },
      error: (err: ProblemDetails) => {
        this.creatingInternal.set(false);
        this.toast.error('Échec de la création', err.detail);
      },
    });
  }

  openAssignRoles(row: AdminUserSummary): void {
    this.assignTarget.set(row);
    this.assignRole.set('');
    if (!this.catalog()) this.fetchCatalog();
  }

  onAssignRoleChange(value: string): void {
    this.assignRole.set(value);
  }

  confirmAssignRoles(): void {
    const target = this.assignTarget();
    if (!target || !this.assignRole()) return;
    this.assigning.set(true);
    this.rolesService.assignUserRoles(target.uuid, [this.assignRole()]).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignTarget.set(null);
        this.toast.success('Rôles affectés');
      },
      error: (err: ProblemDetails) => {
        this.assigning.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  /** Curated label for a raw RBAC permission slug (e.g. `drivers.kyc.review`); falls back to a humanized slug for any permission the backend adds before a translation exists for it. */
  permissionLabel(permission: string): string {
    const key = `permission.${permission}`;
    const label = this.i18n.t(key);
    return label === key ? humanizeSlug(permission) : label;
  }

  fetchCatalog(): void {
    this.loadingCatalog.set(true);
    this.forbiddenCatalog.set(false);
    this.rolesService.catalog().subscribe({
      next: (c) => { this.loadingCatalog.set(false); this.catalog.set(c); },
      error: (err: ProblemDetails) => {
        this.loadingCatalog.set(false);
        if (err.status === 403) this.forbiddenCatalog.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  toggleRolePermission(role: RbacRole, permission: string): void {
    const has = role.permissions.includes(permission);
    const nextPermissions = has ? role.permissions.filter((p) => p !== permission) : [...role.permissions, permission];
    this.rolesService.updateRole(role.name, nextPermissions).subscribe({
      next: () => {
        this.toast.success(`Rôle ${role.name} mis à jour`);
        this.fetchCatalog();
      },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  async deleteRole(role: RbacRole): Promise<void> {
    const ok = await this.confirm.ask({ title: `Supprimer le rôle ${role.name} ?`, message: 'Impossible si des comptes y sont encore affectés.', danger: true });
    if (!ok) return;
    this.rolesService.deleteRole(role.name).subscribe({
      next: () => { this.toast.success('Rôle supprimé'); this.fetchCatalog(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  openNewRole(): void {
    this.newRoleForm.reset({ name: '' });
    this.newRolePermissions.set(new Set());
    this.newRoleOpen.set(true);
  }

  toggleNewRolePermission(permission: string): void {
    const next = new Set(this.newRolePermissions());
    if (next.has(permission)) next.delete(permission); else next.add(permission);
    this.newRolePermissions.set(next);
  }

  createRole(): void {
    if (this.newRoleForm.invalid || this.newRolePermissions().size === 0) {
      this.newRoleForm.markAllAsTouched();
      return;
    }
    this.savingRole.set(true);
    this.rolesService.createRole(this.newRoleForm.getRawValue().name, Array.from(this.newRolePermissions())).subscribe({
      next: () => {
        this.savingRole.set(false);
        this.newRoleOpen.set(false);
        this.toast.success('Rôle créé');
        this.fetchCatalog();
      },
      error: (err: ProblemDetails) => {
        this.savingRole.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }
}
