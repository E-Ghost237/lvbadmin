import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupervisionAlert, SupervisionAlertType, SupervisionDashboard, SupervisionService } from '../../../core/services/supervision.service';
import { GeoPoint, ProblemDetails } from '../../../core/models';
import { formatRelative, formatXaf } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ForbiddenStateComponent, FormFieldComponent, MapMarker,
  MapPanelComponent, ModalComponent, StatTileComponent, ToastService, i18nKeyFor,
} from '../../../shared/ui';

const ALERT_TYPE_LABELS: Record<SupervisionAlertType, string> = {
  COMMANDE_NON_AFFECTEE: 'Sans affectation',
  SLA_DEPASSE: 'Retard SLA',
  ECART_PROXIMITE: 'Écart de proximité',
  PLAFOND_COD_PROCHE: 'Plafond COD proche',
  PAIEMENT_EN_ATTENTE: 'Paiement en attente',
  INCIDENT_CRITIQUE: 'Incident critique',
};

const OPERATIONAL_TONE: Record<string, MapMarker['tone']> = {
  DISPONIBLE: 'good', EN_MISSION: 'info', PAUSE: 'warning', HORS_LIGNE: 'neutral',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [
    ReactiveFormsModule, BreadcrumbsComponent, StatTileComponent, MapPanelComponent,
    ForbiddenStateComponent, ModalComponent, FormFieldComponent,
  ],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly supervision = inject(SupervisionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly dashboard = signal<SupervisionDashboard | null>(null);
  protected readonly typeFilter = signal<SupervisionAlertType | 'TOUTES'>('TOUTES');
  protected readonly ackTarget = signal<SupervisionAlert | null>(null);
  protected readonly acking = signal(false);

  protected readonly ackForm = this.fb.nonNullable.group({
    motif: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  protected readonly alertTypes = Object.keys(ALERT_TYPE_LABELS) as SupervisionAlertType[];
  protected readonly alertTypeLabel = ALERT_TYPE_LABELS;

  protected readonly filteredAlerts = computed(() => {
    const d = this.dashboard();
    if (!d) return [];
    const filter = this.typeFilter();
    return filter === 'TOUTES' ? d.alerts : d.alerts.filter((a) => a.type === filter);
  });

  protected readonly alertCountByType = computed(() => {
    const d = this.dashboard();
    const counts: Partial<Record<SupervisionAlertType, number>> = {};
    if (!d) return counts;
    for (const a of d.alerts) counts[a.type] = (counts[a.type] ?? 0) + 1;
    return counts;
  });

  protected readonly activeDriversCount = computed(() => {
    const d = this.dashboard();
    return d ? d.drivers.filter((drv) => drv.operational_status !== 'HORS_LIGNE').length : 0;
  });

  protected readonly driverMarkers = computed<MapMarker[]>(() => {
    const d = this.dashboard();
    if (!d) return [];
    return d.drivers
      .filter((drv): drv is typeof drv & { lat: number; lng: number } => drv.lat !== null && drv.lng !== null)
      .map((drv) => ({
        id: drv.user_uuid,
        point: { lat: drv.lat, lng: drv.lng },
        tone: OPERATIONAL_TONE[drv.operational_status] ?? 'neutral',
        label: `${drv.matricule} — ${this.i18n.t(i18nKeyFor('driverOp', drv.operational_status))}`,
      }));
  });

  protected readonly bbox = computed(() => {
    const points: GeoPoint[] = this.driverMarkers().map((m) => m.point);
    if (points.length === 0) return { latMin: 3.6, latMax: 4.3, lngMin: 9.5, lngMax: 11.7 };
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const pad = 0.03;
    return {
      latMin: Math.min(...lats) - pad, latMax: Math.max(...lats) + pad,
      lngMin: Math.min(...lngs) - pad, lngMax: Math.max(...lngs) + pad,
    };
  });

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.supervision.dashboard().subscribe({
      next: (d) => {
        this.dashboard.set(d);
        this.loading.set(false);
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 403) this.forbidden.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  selectType(type: SupervisionAlertType | 'TOUTES'): void {
    this.typeFilter.set(type);
  }

  openAck(alert: SupervisionAlert): void {
    this.ackForm.reset();
    this.ackTarget.set(alert);
  }

  confirmAck(): void {
    if (this.ackForm.invalid) {
      this.ackForm.markAllAsTouched();
      return;
    }
    const alert = this.ackTarget();
    if (!alert) return;
    this.acking.set(true);
    this.supervision.acknowledgeAlert(alert.id, this.ackForm.getRawValue().motif).subscribe({
      next: () => {
        this.acking.set(false);
        this.ackTarget.set(null);
        this.toast.success('Alerte acquittée');
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.acking.set(false);
        this.toast.error('Échec de l’acquittement', err.detail);
      },
    });
  }

  relative(iso: string | null): string {
    return formatRelative(iso);
  }

  xaf(amount: number): string {
    return formatXaf(amount);
  }
}
