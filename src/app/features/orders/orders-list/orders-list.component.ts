import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from '../../../core/services/orders.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { Order, OrderChannel, OrderStatus, ORDER_STATUS_VALUES } from '../../../core/models';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import {
  BreadcrumbsComponent, ColumnDef, DataTableComponent, PaginationComponent, SearchInputComponent,
  StatusBadgeComponent, TableCellDefDirective,
} from '../../../shared/ui';

type PeriodFilter = 'TOUS' | 'today' | '7' | '30';

@Component({
  selector: 'app-orders-list',
  imports: [DataTableComponent, TableCellDefDirective, PaginationComponent, StatusBadgeComponent, SearchInputComponent, BreadcrumbsComponent],
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  /** Bound automatically from ?search= via withComponentInputBinding() (e.g. topbar quick search). */
  readonly search = input<string>('');

  protected readonly rows = signal<Order[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly statut = signal<OrderStatus | 'TOUS' | 'ACTIVES'>('TOUS');
  protected readonly ville = signal<'TOUS' | 'Douala' | 'Yaoundé'>('TOUS');
  protected readonly canal = signal<'TOUS' | OrderChannel>('TOUS');
  protected readonly period = signal<PeriodFilter>('TOUS');
  protected readonly searchTerm = signal('');

  protected readonly statusOptions = ['TOUS', 'ACTIVES', ...ORDER_STATUS_VALUES] as const;

  protected readonly columns: ColumnDef<Order>[] = [
    { key: 'numero', label: 'Commande', sortable: false },
    { key: 'client_nom', label: 'Client' },
    { key: 'ville', label: 'Ville' },
    { key: 'statut', label: 'Statut' },
    { key: 'livreur_nom', label: 'Livreur', cell: (r) => r.livreur_nom ?? '—' },
    { key: 'prix_total', label: 'Montant', align: 'right', cell: (r) => formatXaf(r.prix_total) },
    { key: 'canal', label: 'Canal' },
    { key: 'cree_le', label: 'Créée le', cell: (r) => formatDateTime(r.cree_le) },
  ];

  constructor() {
    effect(() => {
      const incoming = this.search();
      if (incoming) this.searchTerm.set(incoming);
    }, { allowSignalWrites: true });

    effect(() => {
      // Re-fetch whenever any filter/pagination signal changes.
      this.page(); this.pageSize(); this.statut(); this.ville(); this.canal(); this.period(); this.searchTerm();
      this.fetch();
    });
  }

  private fetch(): void {
    this.loading.set(true);
    const dateDebut = this.periodToDate(this.period());
    this.ordersService.list({
      page: this.page(), page_size: this.pageSize(),
      statut: this.statut(), ville: this.ville() === 'TOUS' ? undefined : this.ville(),
      canal: this.canal() === 'TOUS' ? undefined : (this.canal() as OrderChannel),
      date_debut: dateDebut, search: this.searchTerm() || undefined,
    }).subscribe((res) => {
      this.rows.set(res.items);
      this.total.set(res.total);
      this.loading.set(false);
    });
  }

  private periodToDate(period: PeriodFilter): string | undefined {
    if (period === 'TOUS') return undefined;
    const days = period === 'today' ? 0 : period === '7' ? 7 : 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  onSearch(value: string): void {
    this.page.set(1);
    this.searchTerm.set(value);
  }

  resetFilters(): void {
    this.statut.set('TOUS'); this.ville.set('TOUS'); this.canal.set('TOUS'); this.period.set('TOUS'); this.searchTerm.set(''); this.page.set(1);
  }

  openOrder(order: Order): void {
    this.router.navigate(['/orders', order.id]);
  }

  statusLabel(value: string): string {
    if (value === 'TOUS') return this.i18n.t('common.all');
    if (value === 'ACTIVES') return 'Actives';
    return this.i18n.t(`status.order.${value}`);
  }
}
