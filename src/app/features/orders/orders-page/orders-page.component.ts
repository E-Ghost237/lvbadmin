import { Component, inject, signal } from '@angular/core';
import { AdminOrderListItem, DispatchService, OrdersService } from '../../../core/services/orders.service';
import { AdminDriverSummary, DriversService } from '../../../core/services/drivers.service';
import { OrderChannel, OrderStatus, ORDER_STATUS_VALUES, PaymentMethod, ProblemDetails } from '../../../core/models';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ColumnDef, DataTableComponent, ForbiddenStateComponent, ModalComponent, SearchInputComponent,
  StatusBadgeComponent, TableCellDefDirective, ToastService,
} from '../../../shared/ui';

const CHANNEL_LABELS: Record<OrderChannel, string> = {
  APP_CLIENT: 'Appli client', TELECONSEILLER: 'Téléconseiller', API_PARTENAIRE: 'API partenaire', WEB: 'Web',
};
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  MTN_MOMO: 'MTN Mobile Money', ORANGE_MONEY: 'Orange Money', CARTE: 'Carte', COD: 'Paiement à la livraison',
  COMPTE_DIFFERE: 'Compte différé', AVOIR: 'Avoir',
};

const UNASSIGNED_STATUSES: OrderStatus[] = ['EN_ATTENTE_AFFECTATION', 'EN_ATTENTE_MANUELLE'];

/** UC-ADM-08/09/10 — /v1/admin/orders (Ordering) + /v1/admin/dispatch/assign (Dispatch). */
@Component({
  selector: 'app-orders-page',
  imports: [
    BreadcrumbsComponent, ForbiddenStateComponent, StatusBadgeComponent, SearchInputComponent, ModalComponent,
    DataTableComponent, TableCellDefDirective,
  ],
  templateUrl: './orders-page.component.html',
})
export class OrdersPageComponent {
  private readonly orders = inject(OrdersService);
  private readonly dispatch = inject(DispatchService);
  private readonly driversService = inject(DriversService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly channelLabel = CHANNEL_LABELS;
  protected readonly paymentLabel = PAYMENT_LABELS;
  protected readonly statusValues = ORDER_STATUS_VALUES;
  protected readonly unassignedStatuses = UNASSIGNED_STATUSES;

  protected readonly columns: ColumnDef<AdminOrderListItem>[] = [
    { key: 'destinataire', label: 'Destinataire' },
    { key: 'statut', label: 'Statut' },
    { key: 'ville', label: 'Ville' },
    { key: 'canal', label: 'Canal', cell: (r) => CHANNEL_LABELS[r.canal] },
    { key: 'mode_paiement', label: 'Paiement', cell: (r) => PAYMENT_LABELS[r.mode_paiement] },
    { key: 'prix_final_xaf', label: 'Prix', align: 'right', cell: (r) => formatXaf(r.prix_final_xaf) },
    { key: 'livreur', label: 'Livreur' },
    { key: 'cree_le', label: 'Créée le', cell: (r) => formatDateTime(r.cree_le) },
    { key: 'actions', label: '' },
  ];

  protected readonly trackByUuid = (row: AdminOrderListItem) => row.uuid;

  protected readonly rows = signal<AdminOrderListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly nextCursor = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly cityFilter = signal<'' | 'Douala' | 'Yaoundé'>('');
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  protected readonly unassignedOnly = signal(false);

  constructor() {
    this.fetch();
  }

  fetch(cursor?: string): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.orders.list({
      q: this.search() || undefined,
      city: this.cityFilter() || undefined,
      statuses: this.unassignedOnly()
        ? UNASSIGNED_STATUSES
        : (this.statusFilter() ? [this.statusFilter() as OrderStatus] : undefined),
      cursor,
      limit: 50,
    }).subscribe({
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

  onSearch(q: string): void {
    this.search.set(q);
    this.fetch();
  }

  selectCity(city: '' | 'Douala' | 'Yaoundé'): void {
    this.cityFilter.set(city);
    this.fetch();
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as OrderStatus | '');
    this.fetch();
  }

  toggleUnassignedOnly(): void {
    this.unassignedOnly.update((v) => !v);
    this.fetch();
  }

  isUnassignable(row: AdminOrderListItem): boolean {
    return UNASSIGNED_STATUSES.includes(row.statut) && !row.livreur;
  }

  // --- Manual assignment --------------------------------------------------
  protected readonly assignTarget = signal<AdminOrderListItem | null>(null);
  protected readonly driverQuery = signal('');
  protected readonly driverCandidates = signal<AdminDriverSummary[]>([]);
  protected readonly loadingDrivers = signal(false);
  protected readonly selectedDriver = signal<AdminDriverSummary | null>(null);
  protected readonly assignReason = signal('');
  protected readonly assigning = signal(false);

  openAssign(row: AdminOrderListItem): void {
    this.assignTarget.set(row);
    this.driverQuery.set('');
    this.driverCandidates.set([]);
    this.selectedDriver.set(null);
    this.assignReason.set('');
  }

  searchDrivers(q: string): void {
    this.driverQuery.set(q);
    if (!q.trim()) {
      this.driverCandidates.set([]);
      return;
    }
    this.loadingDrivers.set(true);
    this.driversService.list({ q, limit: 10 }).subscribe({
      next: (page) => {
        this.loadingDrivers.set(false);
        this.driverCandidates.set(page.items);
      },
      error: () => this.loadingDrivers.set(false),
    });
  }

  selectDriver(d: AdminDriverSummary): void {
    this.selectedDriver.set(d);
  }

  clearDriver(): void {
    this.selectedDriver.set(null);
  }

  onReasonInput(value: string): void {
    this.assignReason.set(value);
  }

  confirmAssign(): void {
    const order = this.assignTarget();
    const driver = this.selectedDriver();
    if (!order || !driver || this.assignReason().trim().length < 5) return;
    this.assigning.set(true);
    this.dispatch.assignManually({ order_uuid: order.uuid, driver_uuid: driver.uuid, reason: this.assignReason().trim() }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignTarget.set(null);
        this.toast.success('Commande affectée');
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.assigning.set(false);
        this.toast.error('Échec de l’affectation', err.detail);
      },
    });
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number): string {
    return formatXaf(amount);
  }
}
