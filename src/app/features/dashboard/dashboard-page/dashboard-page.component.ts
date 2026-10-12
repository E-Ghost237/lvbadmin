import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DriversService } from '../../../core/services/drivers.service';
import { OrderRoute, SupervisionAlert, SupervisionAlertType, SupervisionDashboard, SupervisionService } from '../../../core/services/supervision.service';
import { GeoPoint, ProblemDetails } from '../../../core/models';
import { formatRelative, formatXaf } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  FleetUnit,
  ForbiddenStateComponent,
  FormFeedbackService,
  FormFieldComponent,
  MapLine,
  MapMarker,
  MapPanelComponent,
  ModalComponent,
  PageHeaderComponent,
  StatTileComponent,
  ToastService,
  i18nKeyFor,
  unitKindFor,
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
  ForbiddenStateComponent,
  FormFieldComponent,
  MapPanelComponent,
  ModalComponent,
  PageHeaderComponent,
  ReactiveFormsModule,
  StatTileComponent,
],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly supervision = inject(SupervisionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  private readonly i18n = inject(I18nService);
  private readonly driversApi = inject(DriversService);
  /** user_uuid → identity, because the supervision feed carries only the matricule. */
  private readonly directory = signal<Record<string, { name: string; phone: string }>>({});

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

  protected readonly mapMarkers = computed<MapMarker[]>(() => this.orderMarkers());

  /** Couriers drawn as moving vehicle icons with a hover card (name, phone, status). */
  protected readonly driverUnits = computed<FleetUnit[]>(() => {
    const d = this.dashboard();
    if (!d) return [];
    const dir = this.directory();
    return d.drivers
      .filter((drv): drv is typeof drv & { lat: number; lng: number } => drv.lat !== null && drv.lng !== null)
      .map((drv): FleetUnit => {
        const person = dir[drv.user_uuid];
        const name = [drv.prenom, drv.nom].filter(Boolean).join(' ') || person?.name || drv.matricule;
        return {
          id: drv.user_uuid, point: { lat: drv.lat, lng: drv.lng }, kind: unitKindFor(drv.vehicle_type),
          name, phone: drv.telephone ?? person?.phone ?? null, status: drv.operational_status,
          statusLabel: this.i18n.t(i18nKeyFor('driverOp', drv.operational_status)), subtitle: drv.matricule,
          updatedAt: drv.position_updated_at,
        };
      });
  });

  private loadDirectory(cursor?: string, pages = 0): void {
    this.driversApi.list({ cursor, limit: 100 }).subscribe({
      next: (page) => {
        this.directory.update((m) => ({ ...m, ...Object.fromEntries(page.items.map((x) => [x.uuid, { name: `${x.prenom ?? ''} ${x.nom}`.trim(), phone: x.telephone }])) }));
        if (page.next_cursor && pages < 9) this.loadDirectory(page.next_cursor, pages + 1);
      },
      error: () => undefined, // the map still works with matricules only
    });
  }

  protected readonly mapLines = computed<MapLine[]>(() => {
    const d = this.dashboard();
    if (!d) return [];
    const lines: MapLine[] = [];
    if (this.showOrders()) {
      // Road routes computed by the backend (driver → current pickup/drop-off). No straight
      // pickup→drop-off line: orders without a usable route just show their two pins.
      const routes = this.routes();
      for (const o of d.orders) {
        const r = routes[o.uuid];
        if (r) lines.push({ id: `o:${o.uuid}`, points: r, color: '#E8830C', weight: 4, opacity: 0.9 });
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

  private readonly routes = signal<Record<string, GeoPoint[]>>({});
  private readonly routeFetchedAt = new Map<string, number>();

  /** Statuses for which the backend computes a route (driver assigned and moving toward a target). */
  private static readonly ROUTABLE = ['AFFECTEE', 'EN_ROUTE_RAMASSAGE', 'ARRIVE_RAMASSAGE', 'COLIS_RECUPERE', 'EN_LIVRAISON', 'ARRIVE_LIVRAISON'];

  /** The route endpoint is rate-limited (60/min), so refresh each order at most once a minute and cap the batch. */
  private refreshRoutes(d: SupervisionDashboard): void {
    const now = Date.now();
    const live = new Set(d.orders.map((o) => o.uuid));
    const due = d.orders
      .filter((o) => DashboardPageComponent.ROUTABLE.includes(o.status) && now - (this.routeFetchedAt.get(o.uuid) ?? 0) > 60_000)
      .slice(0, 25);
    for (const o of due) {
      this.routeFetchedAt.set(o.uuid, now);
      this.supervision.orderRoute(o.uuid).subscribe({
        next: (r: OrderRoute) => {
          const pts = r.route_available && r.geometry ? r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) : null;
          this.routes.update((prev) => {
            const next = { ...prev };
            if (pts) next[o.uuid] = pts; else delete next[o.uuid];
            return next;
          });
        },
        error: () => undefined, // a missing route just means no line for this order
      });
    }
    // Forget finished orders.
    this.routes.update((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => live.has(k))));
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
    this.loadDirectory();
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
        this.refreshRoutes(d);
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
