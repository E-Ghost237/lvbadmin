import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { RolesService } from '../../../core/services/roles.service';
import { UsersService } from '../../../core/services/users.service';
import {
  ClientUser, PermissionCode, Role, StaffRoleCode, StaffUser, UserActionLogEntry,
} from '../../../core/models';
import { e164Phone, integerAmount, requiredTrimmed } from '../../../core/utils/validators';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import { ROLE_LABELS } from '../../../core/auth/rbac';
import {
  AlertBannerComponent, AvatarComponent, BreadcrumbsComponent, ColumnDef, DataTableComponent,
  FormFieldComponent, ModalComponent, SearchInputComponent, StatusBadgeComponent, TabDef, TableCellDefDirective,
  TabsComponent, ToastService,
} from '../../../shared/ui';

const PERMISSION_GROUPS: { prefix: string; label: string }[] = [
  { prefix: 'order.', label: 'Commandes' }, { prefix: 'driver.', label: 'Livreurs' },
  { prefix: 'user.', label: 'Utilisateurs' }, { prefix: 'role.', label: 'Rôles' },
  { prefix: 'partner.', label: 'Partenaires' }, { prefix: 'tarif.', label: 'Tarification' },
  { prefix: 'zone.', label: 'Zones' }, { prefix: 'finance.', label: 'Finance' },
  { prefix: 'wallet.', label: 'Portefeuilles' }, { prefix: 'claim.', label: 'Réclamations' },
  { prefix: 'report.', label: 'Rapports' }, { prefix: 'settings.', label: 'Paramètres' },
  { prefix: 'audit.', label: 'Audit' }, { prefix: 'teleconseiller.', label: 'Téléconseiller' },
];
const EDITABLE_ROLES: StaffRoleCode[] = ['SUPERVISEUR', 'FINANCE', 'TELECONSEILLER'];

@Component({
  selector: 'app-users-page',
  imports: [
    ReactiveFormsModule, DataTableComponent, TableCellDefDirective, StatusBadgeComponent, SearchInputComponent,
    TabsComponent, BreadcrumbsComponent, ModalComponent, FormFieldComponent, AlertBannerComponent, AvatarComponent,
  ],
  templateUrl: './users-page.component.html',
})
export class UsersPageComponent {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly allRoles: StaffRoleCode[] = ['ADMINISTRATEUR', 'SUPERVISEUR', 'FINANCE', 'TELECONSEILLER'];
  protected readonly tabs = computed<TabDef[]>(() => {
    const t: TabDef[] = [{ id: 'clients', label: 'Clients' }, { id: 'staff', label: 'Personnel interne' }];
    if (this.auth.hasPermission('role.read')) t.push({ id: 'roles', label: 'Rôles & permissions' });
    return t;
  });
  protected readonly activeTab = signal('clients');

  // --- Clients -----------------------------------------------------------
  protected readonly clients = signal<ClientUser[]>([]);
  protected readonly clientsTotal = signal(0);
  protected readonly loadingClients = signal(true);
  protected readonly clientPage = signal(1);
  protected readonly clientStatut = signal('TOUS');
  protected readonly clientType = signal('TOUS');
  protected readonly clientSearch = signal('');

  protected readonly clientColumns: ColumnDef<ClientUser>[] = [
    { key: 'nom', label: 'Client', cell: (c) => c.raison_sociale || `${c.prenom} ${c.nom}` },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'type_client', label: 'Type' },
    { key: 'statut', label: 'Statut' },
    { key: 'nb_commandes', label: 'Commandes', align: 'right' },
    { key: 'partenaire_verifie', label: 'Partenaire', cell: (c) => (c.type_client === 'ENTREPRISE' ? (c.partenaire_verifie ? 'Validé' : 'En attente') : '—') },
  ];

  protected readonly selectedClient = signal<ClientUser | null>(null);
  protected readonly clientHistory = signal<UserActionLogEntry[]>([]);
  protected readonly suspendMotif = this.fb.nonNullable.group({ motif: ['', [Validators.required]] });
  protected readonly showSuspendClient = signal(false);
  protected readonly partnerForm = this.fb.nonNullable.group({ encours_autorise: [200000, [integerAmount(0)]] });
  protected readonly showValidatePartner = signal(false);

  // --- Staff ---------------------------------------------------------------
  protected readonly staff = signal<StaffUser[]>([]);
  protected readonly staffTotal = signal(0);
  protected readonly loadingStaff = signal(true);
  protected readonly staffRole = signal('TOUS');
  protected readonly staffSearch = signal('');

  protected readonly staffColumns: ColumnDef<StaffUser>[] = [
    { key: 'nom', label: 'Nom', cell: (s) => `${s.prenom} ${s.nom}` },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Rôle', cell: (s) => this.roleLabels[s.role] },
    { key: 'statut', label: 'Statut' },
    { key: 'mfa_actif', label: '2FA', cell: (s) => (s.mfa_actif ? 'Activée' : 'Inactive') },
  ];

  protected readonly selectedStaff = signal<StaffUser | null>(null);
  protected readonly showSuspendStaff = signal(false);
  protected readonly showCreateStaff = signal(false);
  protected readonly createStaffForm = this.fb.nonNullable.group({
    prenom: ['', [requiredTrimmed()]], nom: ['', [requiredTrimmed()]],
    email: ['', [Validators.required, Validators.email]], role: ['TELECONSEILLER' as StaffRoleCode, [Validators.required]],
  });
  protected readonly creatingStaff = signal(false);

  // --- Roles ---------------------------------------------------------------
  protected readonly roles = signal<Role[]>([]);
  protected readonly editableRoles = EDITABLE_ROLES;
  protected readonly permissionGroups = PERMISSION_GROUPS;
  protected readonly allPermissions = this.rolesService.allPermissions;
  protected readonly draftPermissions = signal<Record<StaffRoleCode, Set<PermissionCode>>>({} as Record<StaffRoleCode, Set<PermissionCode>>);
  protected readonly savingRoles = signal(false);

  constructor() {
    this.fetchClients();
    this.fetchStaff();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'roles' && this.roles().length === 0) this.fetchRoles();
  }

  groupPermissions(prefix: string): PermissionCode[] {
    return this.allPermissions.filter((p) => p.startsWith(prefix));
  }

  // --- Clients ------------------------------------------------------------
  private fetchClients(): void {
    this.loadingClients.set(true);
    this.usersService.listClients({
      page: this.clientPage(), page_size: 20, statut: this.clientStatut(), type_client: this.clientType(), search: this.clientSearch() || undefined,
    }).subscribe((res) => {
      this.clients.set(res.items);
      this.clientsTotal.set(res.total);
      this.loadingClients.set(false);
    });
  }

  applyClientFilters(): void { this.clientPage.set(1); this.fetchClients(); }
  onClientSearch(v: string): void { this.clientSearch.set(v); this.applyClientFilters(); }

  openClient(client: ClientUser): void {
    this.selectedClient.set(client);
    this.usersService.actionHistory(client.id).subscribe((h) => this.clientHistory.set(h));
  }

  openSuspendClient(): void {
    this.suspendMotif.reset({ motif: '' });
    this.showSuspendClient.set(true);
  }

  confirmSuspendClient(): void {
    if (this.suspendMotif.invalid) { this.suspendMotif.markAllAsTouched(); return; }
    const c = this.selectedClient();
    if (!c) return;
    this.usersService.suspendClient(c.id, this.suspendMotif.getRawValue().motif).subscribe((updated) => {
      this.selectedClient.set(updated);
      this.showSuspendClient.set(false);
      this.fetchClients();
      this.toast.success('Client suspendu');
    });
  }

  reactivateClient(): void {
    const c = this.selectedClient();
    if (!c) return;
    this.usersService.reactivateClient(c.id).subscribe((updated) => {
      this.selectedClient.set(updated);
      this.fetchClients();
      this.toast.success('Client réactivé');
    });
  }

  openValidatePartner(): void {
    this.partnerForm.reset({ encours_autorise: 200000 });
    this.showValidatePartner.set(true);
  }

  confirmValidatePartner(): void {
    if (this.partnerForm.invalid) { this.partnerForm.markAllAsTouched(); return; }
    const c = this.selectedClient();
    if (!c) return;
    this.usersService.validatePartner(c.id, this.partnerForm.getRawValue().encours_autorise ?? 0).subscribe((updated) => {
      this.selectedClient.set(updated);
      this.showValidatePartner.set(false);
      this.fetchClients();
      this.toast.success('Compte partenaire validé');
    });
  }

  // --- Staff --------------------------------------------------------------
  private fetchStaff(): void {
    this.loadingStaff.set(true);
    this.usersService.listStaff({ role: this.staffRole(), search: this.staffSearch() || undefined, page_size: 50 }).subscribe((res) => {
      this.staff.set(res.items);
      this.staffTotal.set(res.total);
      this.loadingStaff.set(false);
    });
  }

  applyStaffFilters(): void { this.fetchStaff(); }
  onStaffSearch(v: string): void { this.staffSearch.set(v); this.applyStaffFilters(); }

  openStaff(user: StaffUser): void { this.selectedStaff.set(user); }

  openSuspendStaff(): void {
    this.suspendMotif.reset({ motif: '' });
    this.showSuspendStaff.set(true);
  }

  confirmSuspendStaff(): void {
    if (this.suspendMotif.invalid) { this.suspendMotif.markAllAsTouched(); return; }
    const s = this.selectedStaff();
    if (!s) return;
    this.usersService.suspendStaff(s.id, this.suspendMotif.getRawValue().motif).subscribe((updated) => {
      this.selectedStaff.set(updated);
      this.showSuspendStaff.set(false);
      this.fetchStaff();
      this.toast.success('Compte suspendu');
    });
  }

  reactivateStaff(): void {
    const s = this.selectedStaff();
    if (!s) return;
    this.usersService.reactivateStaff(s.id).subscribe((updated) => {
      this.selectedStaff.set(updated);
      this.fetchStaff();
      this.toast.success('Compte réactivé');
    });
  }

  openCreateStaff(): void {
    this.createStaffForm.reset({ prenom: '', nom: '', email: '', role: 'TELECONSEILLER' });
    this.showCreateStaff.set(true);
  }

  confirmCreateStaff(): void {
    if (this.createStaffForm.invalid) { this.createStaffForm.markAllAsTouched(); return; }
    this.creatingStaff.set(true);
    this.usersService.createStaff(this.createStaffForm.getRawValue()).subscribe({
      next: () => {
        this.creatingStaff.set(false);
        this.showCreateStaff.set(false);
        this.fetchStaff();
        this.toast.success('Compte interne créé');
      },
      error: (err) => { this.creatingStaff.set(false); this.toast.error('Création impossible', err.detail); },
    });
  }

  // --- Roles ----------------------------------------------------------------
  private fetchRoles(): void {
    this.rolesService.list().subscribe((roles) => {
      this.roles.set(roles);
      const draft: Record<StaffRoleCode, Set<PermissionCode>> = {} as Record<StaffRoleCode, Set<PermissionCode>>;
      for (const r of roles) draft[r.code] = new Set(r.permissions as PermissionCode[]);
      this.draftPermissions.set(draft);
    });
  }

  hasDraftPermission(role: StaffRoleCode, code: PermissionCode): boolean {
    return this.draftPermissions()[role]?.has(code) ?? false;
  }

  togglePermission(role: StaffRoleCode, code: PermissionCode): void {
    const draft = this.draftPermissions();
    const set = new Set(draft[role] ?? []);
    if (set.has(code)) set.delete(code); else set.add(code);
    this.draftPermissions.set({ ...draft, [role]: set });
  }

  saveRole(role: StaffRoleCode): void {
    this.savingRoles.set(true);
    const permissions = Array.from(this.draftPermissions()[role] ?? []);
    this.rolesService.updatePermissions(role, permissions).subscribe({
      next: () => { this.savingRoles.set(false); this.toast.success(`Permissions mises à jour — ${this.roleLabels[role]}`); },
      error: () => this.savingRoles.set(false),
    });
  }

  formatDateTime(v: string): string { return formatDateTime(v); }
  formatXaf(v: number): string { return formatXaf(v); }
}
