import { Component, inject, signal } from '@angular/core';
import { PartnerOrderService } from '../../../core/services/partner-order.service';
import { PartnerFinanceService } from '../../../core/services/partner-finance.service';
import { DashboardFinance, PartnerOrder, PartnerOrderDetail } from '../../../core/models';
import { ORDER_STATUS_VALUES, OrderStatus, PaymentMethod } from '@lvb/models/enums';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatDate, formatDateTime, formatXaf } from '@lvb/utils/formatters';
import { I18nService } from '@lvb/i18n/i18n.service';
import { BreadcrumbsComponent } from '@lvb/ui/breadcrumbs/breadcrumbs.component';
import { TabDef, TabsComponent } from '@lvb/ui/tabs/tabs.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatusBadgeComponent } from '@lvb/ui/status-badge/status-badge.component';
import { StatTileComponent } from '@lvb/ui/stat-tile/stat-tile.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ColumnDef, DataTableComponent } from '@lvb/ui/table/data-table.component';
import { TableCellDefDirective } from '@lvb/ui/table/table-cell-def.directive';
import { ModalComponent } from '@lvb/ui/modal/modal.component';
import { ToastService } from '@lvb/ui/toast/toast.service';

const PAYMENT_METHOD_OPTIONS: SelectOption[] = [
  { value: 'MTN_MOMO', label: 'MTN Mobile Money' }, { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'CARTE', label: 'Carte' }, { value: 'COD', label: 'Paiement à la livraison' },
  { value: 'COMPTE_DIFFERE', label: 'Compte différé' }, { value: 'AVOIR', label: 'Avoir' },
];

/**
 * Orders & Finance — `/v1/partner/orders*` + `/v1/partner/finance/*`
 * (Ordering + Payments modules, partner-as-client). This is the partner
 * org's OWN deliveries booked through LVB — a different concept from
 * Marketplace `Booking` (where the partner is the service provider, see
 * the Réservations page). `finance` is only visible to
 * RESPONSABLE_PARTENAIRE (the backend omits it for other roles on the
 * dashboard, and this standalone endpoint is gated by `finance.read`,
 * which only that role has).
 */
@Component({
  selector: 'app-orders-page',
  imports: [
    BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent, StatTileComponent,
    SelectComponent, DataTableComponent, TableCellDefDirective, ModalComponent,
  ],
  templateUrl: './orders-page.component.html',
})
export class OrdersPageComponent {
  private readonly orderSvc = inject(PartnerOrderService);
  private readonly financeSvc = inject(PartnerFinanceService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [{ id: 'orders', label: 'Commandes' }, { id: 'finance', label: 'Finance' }];
  protected readonly activeTab = signal('orders');
  protected readonly paymentMethodOptions = PAYMENT_METHOD_OPTIONS;

  date(iso: string | null): string {
    return formatDate(iso);
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number | null): string {
    return formatXaf(amount);
  }

  constructor() {
    this.fetchOrders();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'finance' && this.finance() === null && !this.loadingFinance()) this.fetchFinance();
  }

  // --- Orders ------------------------------------------------------------

  protected readonly statusOptions: SelectOption[] = ORDER_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.order.' + s),
  }));

  protected readonly columns: ColumnDef<PartnerOrder>[] = [
    { key: 'destinataire_nom', label: 'Destinataire' },
    { key: 'ville', label: 'Ville' },
    { key: 'statut', label: 'Statut' },
    { key: 'prix_final_xaf', label: 'Prix', cell: (r) => this.xaf(r.prix_final_xaf) },
    { key: 'cree_le', label: 'Créée le', cell: (r) => this.dateTime(r.cree_le) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByUuid = (row: PartnerOrder) => row.uuid;

  protected readonly orders = signal<PartnerOrder[]>([]);
  protected readonly loadingOrders = signal(true);
  protected readonly forbiddenOrders = signal(false);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  protected readonly paymentMethodFilter = signal<PaymentMethod | ''>('');

  protected readonly detail = signal<PartnerOrderDetail | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly downloadingReceipt = signal(false);

  fetchOrders(cursor?: string): void {
    this.loadingOrders.set(true);
    this.forbiddenOrders.set(false);
    this.orderSvc.list({
      statut: this.statusFilter() || undefined, mode_paiement: this.paymentMethodFilter() || undefined, cursor,
    }).subscribe({
      next: (page) => {
        this.loadingOrders.set(false);
        this.orders.set(cursor ? [...this.orders(), ...page.data] : page.data);
        this.nextCursor.set(page.meta.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingOrders.set(false);
        if (err.status === 403) this.forbiddenOrders.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as OrderStatus | '');
    this.fetchOrders();
  }

  onPaymentMethodFilterChange(value: string): void {
    this.paymentMethodFilter.set(value as PaymentMethod | '');
    this.fetchOrders();
  }

  openDetail(uuid: string): void {
    this.loadingDetail.set(true);
    this.detail.set(null);
    this.orderSvc.get(uuid).subscribe({
      next: (d) => { this.loadingDetail.set(false); this.detail.set(d); },
      error: (err: ProblemDetails) => { this.loadingDetail.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  closeDetail(): void {
    this.detail.set(null);
  }

  downloadReceipt(order: PartnerOrderDetail): void {
    this.downloadingReceipt.set(true);
    this.orderSvc.downloadReceipt(order.uuid).subscribe({
      next: (blob) => {
        this.downloadingReceipt.set(false);
        this.saveBlob(blob, `recu-${order.uuid.slice(0, 8)}.pdf`);
      },
      error: (err: ProblemDetails) => { this.downloadingReceipt.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Finance --------------------------------------------------------

  protected readonly finance = signal<DashboardFinance | null>(null);
  protected readonly loadingFinance = signal(false);
  protected readonly forbiddenFinance = signal(false);
  protected readonly exportingCsv = signal(false);

  fetchFinance(): void {
    this.loadingFinance.set(true);
    this.forbiddenFinance.set(false);
    this.financeSvc.getSummary().subscribe({
      next: (f) => { this.loadingFinance.set(false); this.finance.set(f); },
      error: (err: ProblemDetails) => {
        this.loadingFinance.set(false);
        if (err.status === 403) this.forbiddenFinance.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  exportFinanceCsv(): void {
    this.exportingCsv.set(true);
    this.financeSvc.exportCsv().subscribe({
      next: (blob) => { this.exportingCsv.set(false); this.saveBlob(blob, 'finance-partenaire.csv'); },
      error: (err: ProblemDetails) => { this.exportingCsv.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
