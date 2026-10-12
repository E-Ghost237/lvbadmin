import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AuditLogEntry, AuditService } from '../../../core/services/audit.service';
import { ProblemDetails } from '../../../core/models';
import { formatDateTime, humanizeSlug } from '../../../core/utils/formatters';
import {
  ColumnDef,
  DataTableComponent,
  ForbiddenStateComponent,
  ModalComponent,
  PageHeaderComponent,
  ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-audit-page',
  imports: [
  DataTableComponent,
  ForbiddenStateComponent,
  JsonPipe,
  ModalComponent,
  PageHeaderComponent,
],
  templateUrl: './audit-page.component.html',
})
export class AuditPageComponent {
  private readonly audit = inject(AuditService);
  private readonly toast = inject(ToastService);

  protected readonly columns: ColumnDef<AuditLogEntry>[] = [
    { key: 'cree_le', label: 'Horodatage', cell: (r) => formatDateTime(r.cree_le) },
    { key: 'action', label: 'Action', cell: (r) => humanizeSlug(r.action) },
    { key: 'ressource_type', label: 'Ressource', cell: (r) => humanizeSlug(r.ressource_type) },
    { key: 'acteur_type', label: 'Acteur', cell: (r) => humanizeSlug(r.acteur_type) },
    { key: 'ip', label: 'IP', cell: (r) => r.ip ?? '—' },
  ];

  /** Exposed for the raw-value detail modal / tooltips — the table itself always shows the humanized form. */
  protected readonly humanize = humanizeSlug;
  protected readonly trackById = (row: AuditLogEntry) => row.id;

  protected readonly rows = signal<AuditLogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly nextCursor = signal<number | null>(null);

  protected readonly actionFilter = signal('');
  protected readonly resourceTypeFilter = signal('');
  protected readonly exporting = signal(false);

  protected readonly detail = signal<AuditLogEntry | null>(null);

  constructor() {
    this.fetch();
  }

  fetch(cursor?: number): void {
    this.loading.set(true);
    this.forbidden.set(false);
    this.audit.search({
      action: this.actionFilter() || undefined, ressource_type: this.resourceTypeFilter() || undefined, cursor,
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

  onActionFilter(v: string): void {
    this.actionFilter.set(v);
    this.fetch();
  }

  onResourceTypeFilter(v: string): void {
    this.resourceTypeFilter.set(v);
    this.fetch();
  }

  openDetail(row: AuditLogEntry): void {
    this.detail.set(row);
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.audit.exportCsv({ action: this.actionFilter() || undefined, ressource_type: this.resourceTypeFilter() || undefined }).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err: ProblemDetails) => {
        this.exporting.set(false);
        this.toast.error('Échec de l’export', err.detail);
      },
    });
  }
}
