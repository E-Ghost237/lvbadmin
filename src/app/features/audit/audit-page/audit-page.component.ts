import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AuditService } from '../../../core/services/audit.service';
import { AuditLogEntry } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import {
  BreadcrumbsComponent, ColumnDef, DataTableComponent, ModalComponent, PaginationComponent, SearchInputComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-audit-page',
  imports: [DataTableComponent, PaginationComponent, SearchInputComponent, BreadcrumbsComponent, ModalComponent],
  templateUrl: './audit-page.component.html',
})
export class AuditPageComponent {
  private readonly auditService = inject(AuditService);
  protected readonly i18n = inject(I18nService);

  protected readonly rows = signal<AuditLogEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly action = signal('TOUS');
  protected readonly search = signal('');
  protected readonly actions = computedActions(this.auditService);

  protected readonly selected = signal<AuditLogEntry | null>(null);

  protected readonly columns: ColumnDef<AuditLogEntry>[] = [
    { key: 'cree_le', label: 'Horodatage', cell: (a) => formatDateTime(a.cree_le) },
    { key: 'auteur_nom', label: 'Auteur' },
    { key: 'action', label: 'Action' },
    { key: 'ressource', label: 'Ressource' },
    { key: 'ip', label: 'IP' },
    { key: 'appareil', label: 'Appareil' },
  ];

  constructor() {
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    this.auditService.list({ page: this.page(), page_size: this.pageSize(), action: this.action(), search: this.search() || undefined }).subscribe((res) => {
      this.rows.set(res.items);
      this.total.set(res.total);
      this.loading.set(false);
    });
  }

  applyFilters(): void { this.page.set(1); this.fetch(); }
  onSearch(v: string): void { this.search.set(v); this.applyFilters(); }
  onPageChange(p: number): void { this.page.set(p); this.fetch(); }

  openDetail(entry: AuditLogEntry): void { this.selected.set(entry); }

  jsonOf(v: unknown): string { return v ? JSON.stringify(v, null, 2) : '—'; }
  formatDateTime(v: string): string { return formatDateTime(v); }
}

function computedActions(service: AuditService): string[] {
  return service.distinctActions();
}
