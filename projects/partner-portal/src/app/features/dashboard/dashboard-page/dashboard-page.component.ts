import { Component, inject, signal } from '@angular/core';
import { DashboardService } from '../../../core/services/dashboard.service';
import { DashboardAlert, PartnerDashboard } from '../../../core/models';
import { formatDate } from '@lvb/utils/formatters';
import { ProblemDetails } from '@lvb/models/common.model';
import { PageHeaderComponent } from '@lvb/ui/page-header/page-header.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatTileComponent } from '@lvb/ui/stat-tile/stat-tile.component';
import { PartnerFleetMapComponent } from './partner-fleet-map.component';
import { ToastService } from '@lvb/ui/toast/toast.service';

const ALERT_LABEL: Record<DashboardAlert['type'], string> = {
  DOCUMENT_EXPIRANT: 'Document bientôt expiré',
  DOCUMENT_EXPIRE: 'Document expiré',
  DOCUMENT_REJETE: 'Document rejeté',
  RECLAMATION_OUVERTE: 'Réclamation(s) ouverte(s)',
  PAIEMENT_ECHOUE: 'Paiement(s) échoué(s)',
};

const ALERT_DANGER: Partial<Record<DashboardAlert['type'], boolean>> = {
  DOCUMENT_EXPIRE: true, DOCUMENT_REJETE: true, PAIEMENT_ECHOUE: true,
};

/** UC-PRT-DASH — GET /v1/partner/dashboard, the single aggregate home-page endpoint. */
@Component({
  selector: 'app-dashboard-page',
  imports: [
  ForbiddenStateComponent,
  PageHeaderComponent,
  PartnerFleetMapComponent,
  StatTileComponent,
],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly dashboardSvc = inject(DashboardService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly dashboard = signal<PartnerDashboard | null>(null);

  protected readonly alertLabel = ALERT_LABEL;
  protected readonly alertDanger = ALERT_DANGER;

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.dashboardSvc.getDashboard().subscribe({
      next: (d) => { this.loading.set(false); this.dashboard.set(d); },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 403) this.forbidden.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  date(iso: string): string {
    return formatDate(iso);
  }

  alertDetail(alert: DashboardAlert): string {
    if (alert.type === 'RECLAMATION_OUVERTE' || alert.type === 'PAIEMENT_ECHOUE') return `${alert.nombre}`;
    return alert.expire_le ? this.date(alert.expire_le) : alert.type_document;
  }
}
