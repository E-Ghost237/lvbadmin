import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ExportJob, ReportsService } from '../../../core/services/reports.service';
import { FinalRecetteChecklist, KpiCardValue, KpiSeries } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import {
  BarChartComponent, BreadcrumbsComponent, EmptyStateComponent, StatTileComponent, TabDef, TabsComponent,
  ToastService,
} from '../../../shared/ui';

type DashboardId = 'pilotage' | 'finance' | 'qualite' | 'technique' | 'direction';

@Component({
  selector: 'app-reports-page',
  imports: [StatTileComponent, TabsComponent, BarChartComponent, EmptyStateComponent, BreadcrumbsComponent],
  templateUrl: './reports-page.component.html',
})
export class ReportsPageComponent {
  private readonly reports = inject(ReportsService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [
    { id: 'pilotage', label: 'Pilotage quotidien' }, { id: 'finance', label: 'Finance' },
    { id: 'qualite', label: 'Qualité' }, { id: 'technique', label: 'Technique' }, { id: 'direction', label: 'Direction' },
    { id: 'exports', label: 'Exports' }, { id: 'recette', label: 'Recette finale' },
  ];
  protected readonly activeTab = signal<string>('pilotage');

  protected readonly cards = signal<KpiCardValue[]>([]);
  protected readonly loadingCards = signal(true);
  protected readonly ordersSeries = signal<KpiSeries | null>(null);
  protected readonly onTimeSeries = signal<KpiSeries | null>(null);
  protected readonly caSeries = signal<KpiSeries | null>(null);

  protected readonly exportType = signal('commandes');
  protected readonly exportFilters = signal('');
  protected readonly exports = this.reports.exports;
  protected readonly requestingExport = signal(false);

  protected readonly checklist = signal<FinalRecetteChecklist[]>([]);
  protected readonly loadingChecklist = signal(false);

  constructor() {
    this.loadDashboard('pilotage');
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (['pilotage', 'finance', 'qualite', 'technique', 'direction'].includes(id)) this.loadDashboard(id as DashboardId);
    if (id === 'recette' && this.checklist().length === 0) this.loadChecklist();
  }

  private loadDashboard(id: DashboardId): void {
    this.loadingCards.set(true);
    this.reports.kpiCards(id).subscribe((cards) => {
      this.cards.set(cards);
      this.loadingCards.set(false);
    });
    if (id === 'pilotage') {
      this.reports.kpiSeries('commandes_7j').subscribe((s) => this.ordersSeries.set(s));
      this.reports.kpiSeries('livraisons_heure_7j').subscribe((s) => this.onTimeSeries.set(s));
    }
    if (id === 'finance' || id === 'direction') {
      this.reports.kpiSeries('ca_30j').subscribe((s) => this.caSeries.set(s));
    }
  }

  requestExport(): void {
    this.requestingExport.set(true);
    this.reports.requestExport(this.exportType(), this.exportFilters() || 'Aucun filtre').subscribe(() => {
      this.requestingExport.set(false);
      this.toast.info('Export en cours de génération…');
    });
  }

  private loadChecklist(): void {
    this.loadingChecklist.set(true);
    this.reports.finalRecetteChecklist().subscribe((rows) => {
      this.checklist.set(rows);
      this.loadingChecklist.set(false);
    });
  }

  jobStatusLabel(job: ExportJob): string {
    return job.statut === 'EN_COURS' ? 'Génération en cours…' : job.statut === 'PRET' ? 'Prêt au téléchargement' : 'Expiré';
  }

  formatDateTime(v?: string): string { return formatDateTime(v); }
}
