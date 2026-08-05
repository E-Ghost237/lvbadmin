import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, contentChildren, inject, input, output } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../skeleton/skeleton-rows.component';
import { TableCellDefDirective } from './table-cell-def.directive';

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  cell?: (row: T) => string;
}

/**
 * Generic, sortable, empty/loading-aware data table used across every list
 * screen in the admin console. Rich columns are supplied via
 * `<ng-template appCell="key" let-row>…</ng-template>` projected into the table;
 * plain columns fall back to `column.cell(row)` or `row[column.key]`.
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, EmptyStateComponent, SkeletonRowsComponent],
  template: `
    <div class="overflow-x-auto thin-scroll">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr style="border-bottom: 1px solid var(--border)">
            @for (col of columns(); track col.key) {
              <th
                class="text-left font-medium px-4 py-2.5 whitespace-nowrap select-none text-xs uppercase tracking-wide"
                [style.width]="col.width" [style.textAlign]="col.align || 'left'"
                [class.cursor-pointer]="col.sortable"
                style="color: var(--text-muted)"
                (click)="col.sortable && toggleSort(col.key)"
              >
                <span class="inline-flex items-center gap-1">
                  {{ col.label }}
                  @if (col.sortable) {
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                         [style.opacity]="sortKey() === col.key ? 1 : 0.35"
                         [style.transform]="sortKey() === col.key && sortDir() === 'desc' ? 'rotate(180deg)' : 'none'">
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  }
                </span>
              </th>
            }
          </tr>
        </thead>
        @if (!loading()) {
          <tbody>
            @for (row of rows(); track trackByFn()(row)) {
              <tr
                style="border-bottom: 1px solid var(--border)" class="transition-colors hover:bg-(--surface-2)"
                [class.cursor-pointer]="rowClickable()"
                (click)="rowClickable() && rowClick.emit(row)"
              >
                @for (col of columns(); track col.key) {
                  <td class="px-4 py-3 align-middle" [style.textAlign]="col.align || 'left'">
                    @if (templateFor(col.key); as tpl) {
                      <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, row: row }"></ng-container>
                    } @else {
                      {{ cellText(col, row) }}
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        }
      </table>
      @if (loading()) {
        <app-skeleton-rows [rows]="skeletonRows()" />
      } @else if (rows().length === 0) {
        <app-empty-state [title]="emptyTitle()" [hint]="emptyHint()" />
      }
    </div>
  `,
})
export class DataTableComponent<T> {
  protected readonly i18n = inject(I18nService);

  readonly columns = input.required<ColumnDef<T>[]>();
  readonly rows = input<T[]>([]);
  readonly loading = input(false);
  readonly skeletonRows = input(6);
  readonly rowClickable = input(false);
  readonly trackBy = input<(row: T) => unknown>((row: T) => (row as Record<string, unknown>)['id'] ?? row);
  readonly emptyTitle = input<string>('');
  readonly emptyHint = input<string>('');

  readonly sortKey = input<string>('');
  readonly sortDir = input<'asc' | 'desc'>('asc');

  readonly rowClick = output<T>();
  readonly sortChange = output<{ key: string; dir: 'asc' | 'desc' }>();

  private readonly cellDefs = contentChildren(TableCellDefDirective);
  protected readonly trackByFn = computed(() => this.trackBy());

  templateFor(key: string) {
    return this.cellDefs().find((d) => d.appCell() === key)?.templateRef ?? null;
  }

  cellText(col: ColumnDef<T>, row: T): string {
    if (col.cell) return col.cell(row);
    const value = (row as Record<string, unknown>)[col.key];
    return value === null || value === undefined ? '' : String(value);
  }

  toggleSort(key: string): void {
    const dir: 'asc' | 'desc' = this.sortKey() === key && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ key, dir });
  }
}
