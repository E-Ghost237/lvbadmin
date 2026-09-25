import { Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AdminDriverSummary, DriversService, KycDossierSummary } from '../../../core/services/drivers.service';
import { CreateCourierRequest } from '../../../core/models/courier.model';
import { DriverOperationalStatus, ProblemDetails } from '../../../core/models';
import { formatDate, formatPercent, formatXaf } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ColumnDef, CourierFormComponent, ModalComponent, DataTableComponent, ForbiddenStateComponent, SearchInputComponent,
  StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService, i18nKeyFor,
} from '../../../shared/ui';

@Component({
  selector: 'app-drivers-list',
  imports: [
    BreadcrumbsComponent, TabsComponent, DataTableComponent, SearchInputComponent, StatusBadgeComponent,
    ForbiddenStateComponent, TableCellDefDirective, CourierFormComponent, ModalComponent,
  ],
  templateUrl: './drivers-list.component.html',
})
export class DriversListComponent {
  private readonly drivers = inject(DriversService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly newCourierOpen = signal(false);
  protected readonly creatingCourier = signal(false);
  private readonly courierForm = viewChild(CourierFormComponent);

  createCourier(req: CreateCourierRequest): void {
    this.creatingCourier.set(true);
    this.drivers.createCourier(req).subscribe({
      next: (c) => {
        this.creatingCourier.set(false);
        this.newCourierOpen.set(false);
        this.toast.success('Livreur créé', `${c.matricule} — un mot de passe temporaire a été envoyé par email.`);
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.creatingCourier.set(false);
        this.courierForm()?.showServerError('Création impossible', err);
      },
    });
  }

  protected readonly trackByUuid = (row: AdminDriverSummary) => row.uuid;

  protected readonly tabs: TabDef[] = [{ id: 'all', label: 'Tous les livreurs' }, { id: 'kyc', label: 'Dossiers KYC' }];
  protected readonly activeTab = signal('all');

  protected readonly columns: ColumnDef<AdminDriverSummary>[] = [
    { key: 'nom', label: 'Livreur', cell: (r) => `${r.prenom ?? ''} ${r.nom}`.trim() },
    { key: 'matricule', label: 'Matricule' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'statut_compte', label: 'Statut' },
    { key: 'statut_operationnel', label: 'En service', cell: (r) => this.driverOpLabel(r.statut_operationnel) },
    { key: 'encours_cod_xaf', label: 'Encours COD', align: 'right', cell: (r) => `${formatXaf(r.encours_cod_xaf)} / ${formatXaf(r.plafond_cod_xaf)}` },
    { key: 'note_moyenne', label: 'Note', align: 'right', cell: (r) => (r.note_moyenne === null ? '—' : r.note_moyenne.toFixed(1)) },
    { key: 'taux_acceptation_7j', label: 'Accept. 7j', align: 'right', cell: (r) => (r.taux_acceptation_7j === null ? '—' : formatPercent(r.taux_acceptation_7j)) },
    { key: 'cree_le', label: 'Inscrit le', cell: (r) => formatDate(r.cree_le) },
  ];

  protected readonly rows = signal<AdminDriverSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly search = signal('');
  protected readonly nextCursor = signal<string | null>(null);

  protected readonly kycRows = signal<KycDossierSummary[]>([]);
  protected readonly loadingKyc = signal(true);
  protected readonly kycNextCursor = signal<number | null>(null);

  constructor() {
    this.fetch();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'kyc' && this.kycRows().length === 0) this.fetchKyc();
  }

  fetch(cursor?: string): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.drivers.list({ q: this.search() || undefined, cursor }).subscribe({
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

  fetchKyc(cursor?: number): void {
    this.loadingKyc.set(true);
    this.drivers.kycQueue(undefined, cursor).subscribe({
      next: (page) => {
        this.loadingKyc.set(false);
        this.kycRows.set(cursor ? [...this.kycRows(), ...page.items] : page.items);
        this.kycNextCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingKyc.set(false);
        if (err.status !== 403) this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onSearch(q: string): void {
    this.search.set(q);
    this.fetch();
  }

  openDriver(row: AdminDriverSummary): void {
    this.router.navigate(['/drivers', row.uuid]);
  }

  driverOpLabel(status: DriverOperationalStatus | null): string {
    return status ? this.i18n.t(i18nKeyFor('driverOp', status)) : '—';
  }

  openKyc(row: KycDossierSummary): void {
    this.router.navigate(['/drivers/kyc', row.uuid]);
  }
}
