import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DriversService } from '../../../core/services/drivers.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { OrdersService } from '../../../core/services/orders.service';
import { ReportsService } from '../../../core/services/reports.service';
import { AlertKind, OperationsSnapshot, SupervisionAlert } from '../../../core/models';
import { formatRelative } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, EmptyStateComponent, FormFieldComponent, MapMarker,
  MapPanelComponent, MapZoneShape, ModalComponent, StatTileComponent, ToastService,
} from '../../../shared/ui';

const ALERT_LABELS: Record<AlertKind, string> = {
  SANS_AFFECTATION: 'Sans affectation', RETARD_SLA: 'Retard SLA', INCIDENT_CRITIQUE: 'Incident critique',
  PAIEMENT_EN_ATTENTE: 'Paiement en attente', PLAFOND_COD: 'Plafond COD', ECART_PROXIMITE: 'Écart de proximité',
};

const DOUALA_BBOX = { latMin: 3.95, latMax: 4.15, lngMin: 9.6, lngMax: 9.85 };
const YAOUNDE_BBOX = { latMin: 3.8, latMax: 3.95, lngMin: 11.44, lngMax: 11.6 };

@Component({
  selector: 'app-dashboard-page',
  imports: [
    ReactiveFormsModule, RouterLink, StatTileComponent, MapPanelComponent, EmptyStateComponent,
    ModalComponent, FormFieldComponent, AlertBannerComponent, BreadcrumbsComponent,
  ],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly reports = inject(ReportsService);
  private readonly driversService = inject(DriversService);
  private readonly ordersService = inject(OrdersService);
  protected readonly notifications = inject(NotificationsService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly city = signal<'Douala' | 'Yaoundé'>('Douala');
  protected readonly bbox = computed(() => (this.city() === 'Douala' ? DOUALA_BBOX : YAOUNDE_BBOX));
  protected readonly snapshot = signal<OperationsSnapshot | null>(null);
  protected readonly loadingSnapshot = signal(true);

  protected readonly typeFilter = signal<AlertKind | 'TOUS'>('TOUS');
  protected readonly alertLabels = ALERT_LABELS;
  protected readonly alertKinds: AlertKind[] = ['SANS_AFFECTATION', 'RETARD_SLA', 'INCIDENT_CRITIQUE', 'PAIEMENT_EN_ATTENTE', 'PLAFOND_COD', 'ECART_PROXIMITE'];

  protected readonly filteredAlerts = computed(() => {
    const filter = this.typeFilter();
    return this.notifications.alerts().filter((a) => filter === 'TOUS' || a.type === filter);
  });

  protected readonly alertCountsByType = computed(() => {
    const counts = new Map<AlertKind, number>();
    for (const a of this.notifications.alerts()) {
      if (!a.acquittee) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly acknowledgeTarget = signal<SupervisionAlert | null>(null);
  protected readonly acknowledgeForm = this.fb.nonNullable.group({ motif: ['', [Validators.required]] });
  protected readonly acknowledging = signal(false);

  private allDrivers = signal<import('../../../core/models').Driver[]>([]);
  private allActiveOrders = signal<import('../../../core/models').Order[]>([]);

  protected readonly driverMarkers = computed<MapMarker[]>(() => this.allDrivers()
    .filter((d) => d.statut === 'ACTIF' && d.position && d.zone_predilection === (this.city() === 'Douala' ? 'zone_dla_couv' : 'zone_yde_couv'))
    .map((d) => ({
      id: d.id, point: d.position!, label: `${d.prenom} ${d.nom} — ${d.statut_operationnel}`,
      tone: d.statut_operationnel === 'DISPONIBLE' ? 'good' : d.statut_operationnel === 'EN_MISSION' ? 'info' : d.statut_operationnel === 'PAUSE' ? 'warning' : 'neutral',
    })));

  protected readonly zoneShapes = computed<MapZoneShape[]>(() => {
    const b = this.bbox();
    return [{ id: 'zone', center: { lat: (b.latMin + b.latMax) / 2, lng: (b.lngMin + b.lngMax) / 2 }, radiusKm: 8, color: 'var(--brand)', label: 'Zone de couverture' }];
  });

  constructor() {
    this.refreshSnapshot();
    this.driversService.list({ page_size: 500 }).subscribe((res) => this.allDrivers.set(res.items));
    this.ordersService.list({ statut: 'ACTIVES', page_size: 500 }).subscribe((res) => this.allActiveOrders.set(res.items));
  }

  refreshSnapshot(): void {
    this.loadingSnapshot.set(true);
    this.reports.operationsSnapshot().subscribe((snap) => {
      this.snapshot.set(snap);
      this.loadingSnapshot.set(false);
    });
  }

  relative(iso: string): string {
    return formatRelative(iso, this.i18n.locale());
  }

  toggleFilter(type: AlertKind | 'TOUS'): void {
    this.typeFilter.set(type);
  }

  openAcknowledge(alert: SupervisionAlert): void {
    this.acknowledgeForm.reset();
    this.acknowledgeTarget.set(alert);
  }

  submitAcknowledge(): void {
    if (this.acknowledgeForm.invalid) {
      this.acknowledgeForm.markAllAsTouched();
      return;
    }
    const target = this.acknowledgeTarget();
    if (!target) return;
    this.acknowledging.set(true);
    this.notifications.acknowledgeAlert(target.id, this.acknowledgeForm.getRawValue().motif).subscribe({
      next: () => {
        this.acknowledging.set(false);
        this.acknowledgeTarget.set(null);
        this.toast.success('Alerte acquittée');
      },
      error: () => this.acknowledging.set(false),
    });
  }
}
