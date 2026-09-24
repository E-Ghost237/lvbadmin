import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupervisionAlert, SupervisionAlertType, SupervisionDashboard, SupervisionService } from '../../../core/services/supervision.service';
import { GeoPoint, ProblemDetails } from '../../../core/models';
import { formatRelative, formatXaf } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ForbiddenStateComponent, FormFieldComponent, MapLine, MapMarker,
  MapPanelComponent, ModalComponent, StatTileComponent, ToastService, i18nKeyFor, FormFeedbackService,
} from '../../../shared/ui';

const ALERT_TYPE_LABELS: Record<SupervisionAlertType, string> = {
  COMMANDE_NON_AFFECTEE: 'Sans affectation',
  SLA_DEPASSE: 'Retard SLA',
  ECART_PROXIMITE: 'Écart de proximité',
  PLAFOND_COD_PROCHE: 'Plafond COD proche',
  PAIEMENT_EN_ATTENTE: 'Paiement en attente',
  INCIDENT_CRITIQUE: 'Incident critique',
};

/** Refresh cadence and number of positions kept per driver trail. */
const POLL_MS = 20_000;
const TRAIL_LENGTH = 40;

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
  private readonly feedback = inject(FormFeedbackService);
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

  // --- Live map ---------------------------------------------------------
  // The backend only exposes each driver's *last* position, so movement is
  // rebuilt client-side: the dashboard is polled every POLL_MS and each new
  // position is appended to a short per-driver trail.

  protected readonly live = signal(true);
  protected readonly showOrders = signal(true);
  protected readonly showTrails = signal(true);
  protected readonly lastUpdate = signal<Date | null>(null);
  private readonly trails = signal<Record<string, GeoPoint[]>>({});

  protected readonly driverMarkers = computed<MapMarker[]>(() => {
    const d = this.dashboard();
    if (!d) return [];
    return d.drivers
      .filter((drv): drv is typeof drv & { lat: number; lng: number } => drv.lat !== null && drv.lng !== null)
      .map((drv) => ({
        id: drv.user_uuid,
        point: { lat: drv.lat, lng: drv.lng },
        tone: OPERATIONAL_TONE[drv.operational_status] ?? 'neutral',
        label: `${drv.matricule} — ${this.i18n.t(i18nKeyFor('driverOp', drv.operational_status))}`
          + (drv.position_updated_at ? ` · ${formatRelative(drv.position_updated_at)}` : ''),
      }));
  });

  protected readonly orderMarkers = computed<MapMarker[]>(() => {
    const d = this.dashboard();
    if (!d || !this.showOrders()) return [];
    return d.orders.flatMap((o) => [
      { id: `${o.uuid}:p`, point: o.pickup, tone: 'good' as const, kind: 'pickup' as const, label: `Ramassage #${o.id} — ${o.status}` },
      { id: `${o.uuid}:d`, point: o.dropoff, tone: 'critical' as const, kind: 'dropoff' as const, label: `Livraison #${o.id} — ${o.status}` },
    ]);
  });

  protected readonly mapMarkers = computed<MapMarker[]>(() => [...this.orderMarkers(), ...this.driverMarkers()]);

  protected readonly mapLines = computed<MapLine[]>(() => {
    const d = this.dashboard();
    if (!d) return [];
    const lines: MapLine[] = [];
    if (this.showOrders()) {
      for (const o of d.orders) {
        lines.push({ id: `o:${o.uuid}`, points: [o.pickup, o.dropoff], color: '#6B7686', dashed: true, weight: 2, opacity: 0.6 });
      }
    }
    if (this.showTrails()) {
      const trails = this.trails();
      for (const drv of d.drivers) {
        const pts = trails[drv.user_uuid];
        if (pts && pts.length > 1) lines.push({ id: `t:${drv.user_uuid}`, points: pts, color: '#004AAD', weight: 3, opacity: 0.85 });
      }
    }
    return lines;
  });

  protected readonly bbox = signal({ latMin: 3.6, latMax: 4.3, lngMin: 9.5, lngMax: 11.7 });

  /** Re-centre on everything currently visible. Only on first load / manual refresh, so polling never yanks the map while someone is panning. */
  private fitToData(): void {
    const d = this.dashboard();
    if (!d) return;
    const points: GeoPoint[] = [...this.driverMarkers().map((m) => m.point), ...d.orders.flatMap((o) => [o.pickup, o.dropoff])];
    if (points.length === 0) return;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const pad = 0.03;
    this.bbox.set({
      latMin: Math.min(...lats) - pad, latMax: Math.max(...lats) + pad,
      lngMin: Math.min(...lngs) - pad, lngMax: Math.max(...lngs) + pad,
    });
  }

  private recordTrails(d: SupervisionDashboard): void {
    this.trails.update((prev) => {
      const next: Record<string, GeoPoint[]> = {};
      for (const drv of d.drivers) {
        if (drv.lat === null || drv.lng === null) continue;
        const pts = prev[drv.user_uuid] ?? [];
        const last = pts[pts.length - 1];
        const moved = !last || last.lat !== drv.lat || last.lng !== drv.lng;
        next[drv.user_uuid] = moved ? [...pts, { lat: drv.lat, lng: drv.lng }].slice(-TRAIL_LENGTH) : pts;
      }
      return next;
    });
  }

  constructor() {
    this.fetch();
    const timer = setInterval(() => {
      if (this.live() && !document.hidden && !this.loading() && !this.forbidden()) this.fetch(true);
    }, POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  fetch(silent = false): void {
    if (!silent) this.loading.set(true);
    this.forbidden.set(false);
    this.supervision.dashboard().subscribe({
      next: (d) => {
        const first = this.dashboard() === null;
        this.dashboard.set(d);
        this.recordTrails(d);
        this.lastUpdate.set(new Date());
        this.loading.set(false);
        if (first || !silent) this.fitToData();
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 403) this.forbidden.set(true);
        else if (!silent) this.toast.error('Chargement impossible', err.detail);
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
      this.feedback.invalid(this.ackForm);
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
