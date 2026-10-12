import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { KpiDashboard, KpiMeasurement, SupervisionService } from '../../../core/services/supervision.service';
import { AdminExportStatus, ExportFormat, ExportResource, ReportsService } from '../../../core/services/reports.service';
import { ProblemDetails } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import {
  ForbiddenStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  TabDef,
  TabsComponent,
  ToastService,
} from '../../../shared/ui';

const STATUS_TONE: Record<KpiMeasurement['status'], string> = {
  OK: 'var(--status-good)', MEASURED: 'var(--status-good)', WARNING: 'var(--status-warning)',
  ALERT: 'var(--status-critical)', NO_DATA: 'var(--text-muted)',
};

const RESOURCE_OPTIONS: SelectOption[] = [
  { value: 'commandes', label: 'Commandes' }, { value: 'paiements', label: 'Paiements' }, { value: 'livreurs', label: 'Livreurs' },
];
const FORMAT_OPTIONS: SelectOption[] = [{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'XLSX' }];

@Component({
  selector: 'app-reports-page',
  imports: [
  ForbiddenStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  ReactiveFormsModule,
  SelectComponent,
  TabsComponent,
],
  templateUrl: './reports-page.component.html',
})
export class ReportsPageComponent {
  private readonly supervision = inject(SupervisionService);
  private readonly reports = inject(ReportsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly tabs: TabDef[] = [{ id: 'kpi', label: 'Catalogue KPI' }, { id: 'exports', label: 'Exports' }];
  protected readonly activeTab = signal('kpi');

  protected readonly statusTone = STATUS_TONE;
  protected readonly catalog = signal<KpiDashboard | null>(null);
  protected readonly loadingCatalog = signal(true);
  protected readonly forbiddenCatalog = signal(false);
  protected readonly categoryFilter = signal<string>('TOUTES');

  protected readonly categories = computed(() => {
    const c = this.catalog();
    if (!c) return [];
    return Array.from(new Set(c.measurements.map((m) => m.category)));
  });

  protected readonly filteredMeasurements = computed(() => {
    const c = this.catalog();
    if (!c) return [];
    const filter = this.categoryFilter();
    return filter === 'TOUTES' ? c.measurements : c.measurements.filter((m) => m.category === filter);
  });

  // --- Exports --------------------------------------------------------
  protected readonly resourceOptions = RESOURCE_OPTIONS;
  protected readonly formatOptions = FORMAT_OPTIONS;
  protected readonly exportForm = this.fb.nonNullable.group({
    ressource: ['commandes' as ExportResource, [Validators.required]],
    format: ['csv' as ExportFormat, [Validators.required]],
  });
  protected readonly requestingExport = signal(false);
  protected readonly jobs = signal<AdminExportStatus[]>([]);

  constructor() {
    this.fetchCatalog();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
  }

  fetchCatalog(): void {
    this.loadingCatalog.set(true);
    this.forbiddenCatalog.set(false);
    this.supervision.kpiDashboard().subscribe({
      next: (c) => { this.loadingCatalog.set(false); this.catalog.set(c); },
      error: (err: ProblemDetails) => {
        this.loadingCatalog.set(false);
        if (err.status === 403) this.forbiddenCatalog.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  requestExport(): void {
    if (this.exportForm.invalid) return;
    const v = this.exportForm.getRawValue();
    this.requestingExport.set(true);
    this.reports.requestExport(v.ressource, v.format).subscribe({
      next: (res) => {
        this.requestingExport.set(false);
        this.toast.success('Export demandé', 'Le fichier est en préparation.');
        this.pollExport(res.export_id);
      },
      error: (err: ProblemDetails) => {
        this.requestingExport.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  private pollExport(uuid: string): void {
    this.reports.exportStatus(uuid).subscribe({
      next: (status) => {
        this.jobs.update((list) => [status, ...list.filter((j) => j.uuid !== uuid)]);
        if (status.status === 'EN_ATTENTE' || status.status === 'EN_COURS') {
          setTimeout(() => this.pollExport(uuid), 2000);
        }
      },
      error: () => {},
    });
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }
}
