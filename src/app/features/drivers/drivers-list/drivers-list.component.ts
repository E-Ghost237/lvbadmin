import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DriversService, KycDossierSummary } from '../../../core/services/drivers.service';
import { AdminUserSummary, ProblemDetails } from '../../../core/models';
import { formatDate } from '../../../core/utils/formatters';
import {
  BreadcrumbsComponent, ColumnDef, DataTableComponent, ForbiddenStateComponent, SearchInputComponent,
  StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-drivers-list',
  imports: [
    BreadcrumbsComponent, TabsComponent, DataTableComponent, SearchInputComponent, StatusBadgeComponent,
    ForbiddenStateComponent, TableCellDefDirective,
  ],
  templateUrl: './drivers-list.component.html',
})
export class DriversListComponent {
  private readonly drivers = inject(DriversService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly trackByUuid = (row: AdminUserSummary) => row.uuid;

  protected readonly tabs: TabDef[] = [{ id: 'all', label: 'Tous les livreurs' }, { id: 'kyc', label: 'Dossiers KYC' }];
  protected readonly activeTab = signal('all');

  protected readonly columns: ColumnDef<AdminUserSummary>[] = [
    { key: 'nom', label: 'Livreur', cell: (r) => `${r.prenom ?? ''} ${r.nom}`.trim() },
    { key: 'matricule', label: 'Matricule' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'statut', label: 'Statut' },
    { key: 'cree_le', label: 'Inscrit le', cell: (r) => formatDate(r.cree_le) },
  ];

  protected readonly rows = signal<AdminUserSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly search = signal('');
  protected readonly nextCursor = signal<number | null>(null);

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

  fetch(cursor?: number): void {
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

  openDriver(row: AdminUserSummary): void {
    this.router.navigate(['/drivers', row.uuid]);
  }

  openKyc(row: KycDossierSummary): void {
    this.router.navigate(['/drivers/kyc', row.uuid]);
  }
}
