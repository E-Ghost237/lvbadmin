import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DriversService } from '../../../core/services/drivers.service';
import { Driver, DriverKycDossier, DriverSanction, SanctionType } from '../../../core/models';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, ColumnDef, DataTableComponent, EmptyStateComponent, FormFieldComponent,
  ModalComponent, SearchInputComponent, StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-drivers-list',
  imports: [
    ReactiveFormsModule, DataTableComponent, TableCellDefDirective, StatusBadgeComponent, SearchInputComponent,
    TabsComponent, EmptyStateComponent, BreadcrumbsComponent, ModalComponent, FormFieldComponent, AlertBannerComponent,
  ],
  templateUrl: './drivers-list.component.html',
})
export class DriversListComponent {
  private readonly driversService = inject(DriversService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs = computed<TabDef[]>(() => {
    const base: TabDef[] = [{ id: 'all', label: 'Tous les livreurs', count: this.total() }];
    if (this.auth.hasPermission('driver.validate')) base.push({ id: 'kyc', label: 'Dossiers KYC', count: this.kycDossiers().length });
    base.push({ id: 'quality', label: 'Qualité & sanctions' });
    return base;
  });
  protected readonly activeTab = signal('all');

  // --- Liste générale ---------------------------------------------------
  protected readonly rows = signal<Driver[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly statut = signal<'TOUS' | Driver['statut']>('TOUS');
  protected readonly ville = signal<'TOUS' | 'Douala' | 'Yaoundé'>('TOUS');
  protected readonly search = signal('');

  protected readonly columns: ColumnDef<Driver>[] = [
    { key: 'nom', label: 'Livreur', cell: (d) => `${d.prenom} ${d.nom}` },
    { key: 'matricule', label: 'Matricule' },
    { key: 'statut', label: 'Compte' },
    { key: 'statut_operationnel', label: 'Disponibilité' },
    { key: 'note_moyenne', label: 'Note', align: 'right', cell: (d) => `${d.note_moyenne.toFixed(2)} / 5` },
    { key: 'encours_cod', label: 'Encours COD', align: 'right', cell: (d) => `${formatXaf(d.encours_cod)} / ${formatXaf(d.plafond_cod)}` },
    { key: 'courses_du_jour', label: 'Courses du jour', align: 'right' },
  ];

  // --- KYC ---------------------------------------------------------------
  protected readonly kycDossiers = signal<DriverKycDossier[]>([]);
  protected readonly loadingKyc = signal(false);

  // --- Qualité & sanctions ------------------------------------------------
  protected readonly qualityRanking = signal<Driver[]>([]);
  protected readonly sanctions = signal<DriverSanction[]>([]);
  protected readonly loadingQuality = signal(false);
  protected readonly sanctionTarget = signal<Driver | null>(null);
  protected readonly sanctionForm = this.fb.nonNullable.group({
    type: ['AVERTISSEMENT' as SanctionType, [Validators.required]],
    motif: ['', [Validators.required]],
    duree_jours: [3, []],
  });
  protected readonly savingSanction = signal(false);

  constructor() {
    this.fetchDrivers();
    this.fetchKyc();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'kyc') this.fetchKyc();
    if (id === 'quality') this.fetchQuality();
  }

  private fetchDrivers(): void {
    this.loading.set(true);
    this.driversService.list({
      page: this.page(), page_size: this.pageSize(),
      statut: this.statut(), ville: this.ville() === 'TOUS' ? undefined : this.ville(), search: this.search() || undefined,
    }).subscribe((res) => {
      this.rows.set(res.items);
      this.total.set(res.total);
      this.loading.set(false);
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.fetchDrivers();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.fetchDrivers();
  }

  openDriver(driver: Driver): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  private fetchKyc(): void {
    this.loadingKyc.set(true);
    this.driversService.kycQueue().subscribe((res) => {
      this.kycDossiers.set(res);
      this.loadingKyc.set(false);
    });
  }

  reviewDossier(dossier: DriverKycDossier): void {
    this.router.navigate(['/drivers/kyc', dossier.id]);
  }

  private fetchQuality(): void {
    this.loadingQuality.set(true);
    this.driversService.qualityRanking().subscribe((drivers) => this.qualityRanking.set(drivers));
    this.driversService.allSanctions().subscribe((sanctions) => {
      this.sanctions.set(sanctions);
      this.loadingQuality.set(false);
    });
  }

  driverName(driverId: string): string {
    const d = this.qualityRanking().find((x) => x.id === driverId) ?? this.rows().find((x) => x.id === driverId);
    return d ? `${d.prenom} ${d.nom}` : driverId;
  }

  openSanctionModal(driver: Driver): void {
    this.sanctionForm.reset({ type: 'AVERTISSEMENT', motif: '', duree_jours: 3 });
    this.sanctionTarget.set(driver);
  }

  submitSanction(): void {
    if (this.sanctionForm.invalid) {
      this.sanctionForm.markAllAsTouched();
      return;
    }
    const driver = this.sanctionTarget();
    if (!driver) return;
    const { type, motif, duree_jours } = this.sanctionForm.getRawValue();
    this.savingSanction.set(true);
    this.driversService.proposeSanction(driver.id, type, motif, type === 'SUSPENSION_TEMPORAIRE' ? duree_jours : undefined).subscribe(() => {
      this.savingSanction.set(false);
      this.sanctionTarget.set(null);
      this.toast.success('Sanction proposée', 'Une validation humaine est requise avant application.');
      this.fetchQuality();
    });
  }

  confirmSanction(sanction: DriverSanction): void {
    this.driversService.confirmSanction(sanction.id).subscribe(() => {
      this.toast.success('Sanction confirmée et appliquée');
      this.fetchQuality();
      this.fetchDrivers();
    });
  }

  cancelSanction(sanction: DriverSanction): void {
    this.driversService.cancelSanction(sanction.id).subscribe(() => {
      this.toast.info('Sanction annulée');
      this.fetchQuality();
    });
  }

  formatDateTime(v: string): string { return formatDateTime(v); }
}
