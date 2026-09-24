import { Component, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingService } from '../../../core/services/booking.service';
import { FleetService } from '../../../core/services/fleet.service';
import { BOOKING_STATUS_VALUES, BOOKING_TERMINAL_STATUSES, Booking, BookingStatus } from '@lvb/models/booking.model';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatDateTime, formatXaf } from '@lvb/utils/formatters';
import { PartnerContextService } from '../../../core/services/partner-context.service';
import { I18nService } from '@lvb/i18n/i18n.service';
import { BreadcrumbsComponent } from '@lvb/ui/breadcrumbs/breadcrumbs.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatusBadgeComponent } from '@lvb/ui/status-badge/status-badge.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ColumnDef, DataTableComponent } from '@lvb/ui/table/data-table.component';
import { TableCellDefDirective } from '@lvb/ui/table/table-cell-def.directive';
import { ModalComponent } from '@lvb/ui/modal/modal.component';
import { ConfirmService } from '@lvb/ui/confirm/confirm.service';
import { ToastService } from '@lvb/ui/toast/toast.service';

type BookingActionKind = 'accept' | 'reject' | 'assign-driver' | 'en-route' | 'start' | 'complete' | 'cancel' | 'incident';

interface BookingActionDef {
  action: BookingActionKind;
  label: string;
  danger: boolean;
}

const ACTION_LABEL: Record<BookingActionKind, string> = {
  accept: 'Confirmer', reject: 'Rejeter', 'assign-driver': 'Affecter un chauffeur', 'en-route': 'Marquer en route',
  start: 'Démarrer la prestation', complete: 'Terminer la prestation', cancel: 'Annuler', incident: 'Signaler un incident',
};
const ACTION_DANGER: Partial<Record<BookingActionKind, boolean>> = { reject: true, cancel: true };
const REASON_LABEL: Partial<Record<BookingActionKind, string>> = {
  reject: 'Motif de rejet', cancel: 'Motif d’annulation', incident: 'Description de l’incident',
};

/**
 * Booking self-service — `/v1/partner/bookings*`
 * (LVB-CDC-MKT-RENT-2026-V1.0). Unlike Profile/Fleet/Marketplace/Wallet,
 * both RESPONSABLE_PARTENAIRE and OPERATEUR_PARTENAIRE can run these
 * actions — this is the one section day-to-day operational staff actually
 * use. `resolve-dispute` is admin-only and not offered here.
 */
@Component({
  selector: 'app-bookings-page',
  imports: [
    BreadcrumbsComponent, ForbiddenStateComponent, StatusBadgeComponent, SelectComponent, DataTableComponent,
    TableCellDefDirective, ModalComponent,
  ],
  templateUrl: './bookings-page.component.html',
})
export class BookingsPageComponent {
  private readonly bookingSvc = inject(BookingService);
  private readonly fleet = inject(FleetService);
  private readonly toast = inject(ToastService);
  protected readonly ctx = inject(PartnerContextService);
  protected readonly canAct = this.ctx.can('booking.accept');
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number | null): string {
    return formatXaf(amount);
  }

  protected readonly statusOptions: SelectOption[] = BOOKING_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.booking.' + s),
  }));
  protected readonly columns: ColumnDef<Booking>[] = [
    { key: 'uuid', label: 'Réservation', cell: (r) => `${r.uuid.slice(0, 8)}…` },
    { key: 'status', label: 'Statut' },
    { key: 'starts_at', label: 'Début', cell: (r) => this.dateTime(r.starts_at) },
    { key: 'total_amount', label: 'Montant', cell: (r) => this.xaf(r.total_amount) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByUuid = (row: Booking) => row.uuid;

  protected readonly bookings = signal<Booking[]>([]);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly cursor = signal<number | null>(null);
  protected readonly statusFilter = signal<BookingStatus | ''>('');
  protected readonly updating = signal<string | null>(null);

  protected readonly detail = signal<Booking | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly driverOptions = signal<SelectOption[]>([]);
  protected readonly showAssignDriverForm = signal(false);
  protected readonly assignDriverUuid = signal('');

  constructor() {
    this.fetch();
    this.fetchDrivers();
  }

  fetch(cursor?: number): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.bookingSvc.list({ status: this.statusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.bookings.set(cursor ? [...this.bookings(), ...page.items] : page.items);
        this.cursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 403) this.forbidden.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as BookingStatus | '');
    this.fetch();
  }

  fetchDrivers(): void {
    this.fleet.listDrivers({ status: 'ACTIF', limit: 100 }).subscribe({
      next: (page) => this.driverOptions.set(page.items.map((d) => ({ value: d.uuid, label: `${d.first_name} ${d.last_name}` }))),
      error: () => undefined,
    });
  }

  openDetail(uuid: string): void {
    this.showAssignDriverForm.set(false);
    this.loadingDetail.set(true);
    this.detail.set(null);
    this.bookingSvc.get(uuid).subscribe({
      next: (b) => { this.loadingDetail.set(false); this.detail.set(b); },
      error: (err: ProblemDetails) => { this.loadingDetail.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  closeDetail(): void {
    this.detail.set(null);
    this.showAssignDriverForm.set(false);
  }

  actionsFor(b: Booking): BookingActionDef[] {
    const actions: BookingActionDef[] = [];
    if (b.status === 'EN_ATTENTE_CONFIRMATION') {
      actions.push({ action: 'accept', label: ACTION_LABEL.accept, danger: false });
      actions.push({ action: 'reject', label: ACTION_LABEL.reject, danger: true });
    }
    if (b.with_driver && !b.driver_assigned && ['CONFIRMEE', 'EN_ATTENTE_AFFECTATION', 'PLANIFIEE'].includes(b.status)) {
      actions.push({ action: 'assign-driver', label: ACTION_LABEL['assign-driver'], danger: false });
    }
    if (b.status === 'PLANIFIEE') actions.push({ action: 'en-route', label: ACTION_LABEL['en-route'], danger: false });
    if (b.status === 'PLANIFIEE' || b.status === 'EN_ROUTE') actions.push({ action: 'start', label: ACTION_LABEL.start, danger: false });
    if (b.status === 'PRESTATION_EN_COURS') actions.push({ action: 'complete', label: ACTION_LABEL.complete, danger: false });
    if (!BOOKING_TERMINAL_STATUSES.includes(b.status)) actions.push({ action: 'cancel', label: ACTION_LABEL.cancel, danger: true });
    actions.push({ action: 'incident', label: ACTION_LABEL.incident, danger: false });
    return actions;
  }

  async applyAction(booking: Booking, def: BookingActionDef): Promise<void> {
    if (def.action === 'assign-driver') {
      this.assignDriverUuid.set('');
      this.showAssignDriverForm.set(true);
      return;
    }
    if (def.action === 'accept' || def.action === 'en-route' || def.action === 'start' || def.action === 'complete') {
      const ok = await this.confirm.ask({ title: `${def.label} ?`, message: booking.uuid, confirmLabel: def.label });
      if (!ok) return;
      const obs = def.action === 'accept' ? this.bookingSvc.accept(booking.uuid)
        : def.action === 'en-route' ? this.bookingSvc.enRoute(booking.uuid)
        : def.action === 'start' ? this.bookingSvc.start(booking.uuid)
        : this.bookingSvc.complete(booking.uuid);
      this.run(booking.uuid, obs);
      return;
    }
    const reason = await this.confirm.askReason({
      title: `${def.label} cette réservation ?`, label: REASON_LABEL[def.action] ?? 'Motif',
      danger: def.danger, confirmLabel: def.label,
    });
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    const obs = def.action === 'reject' ? this.bookingSvc.reject(booking.uuid, trimmed)
      : def.action === 'cancel' ? this.bookingSvc.cancel(booking.uuid, trimmed)
      : this.bookingSvc.reportIncident(booking.uuid, trimmed);
    this.run(booking.uuid, obs);
  }

  onAssignDriverChange(value: string): void {
    this.assignDriverUuid.set(value);
  }

  cancelAssignDriverForm(): void {
    this.showAssignDriverForm.set(false);
  }

  submitAssignDriver(): void {
    const booking = this.detail();
    const driverUuid = this.assignDriverUuid();
    if (!booking || !driverUuid) return;
    this.showAssignDriverForm.set(false);
    this.run(booking.uuid, this.bookingSvc.assignDriver(booking.uuid, driverUuid));
  }

  private run(uuid: string, obs: Observable<Booking>): void {
    this.updating.set(uuid);
    obs.subscribe({
      next: () => {
        this.updating.set(null);
        this.toast.success('Réservation mise à jour');
        this.fetch();
        if (this.detail()?.uuid === uuid) this.openDetail(uuid);
      },
      error: (err: ProblemDetails) => { this.updating.set(null); this.toast.error('Échec', err.detail); },
    });
  }
}
