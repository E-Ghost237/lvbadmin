import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-pagination',
  template: `
    @if (total() > 0) {
      <div class="card-foot !border-t-0">
        <div class="text-xs" style="color: var(--text-secondary)">
          {{ i18n.t('common.total') }}: <span class="font-semibold tabular-nums" style="color: var(--text-primary)">{{ total() }}</span>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary)">
            {{ i18n.t('common.rowsPerPage') }}
            <select class="select !w-auto !py-1" [value]="pageSize()" (change)="onPageSizeChange($event)">
              @for (size of pageSizeOptions; track size) { <option [value]="size">{{ size }}</option> }
            </select>
          </label>
          <div class="flex items-center gap-1">
            <button type="button" class="btn btn-secondary btn-sm !px-2" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)" [attr.aria-label]="i18n.t('action.previous')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span class="tabular-nums px-1.5 text-xs">{{ i18n.t('common.page') }} {{ page() }} {{ i18n.t('common.of') }} {{ totalPages() }}</span>
            <button type="button" class="btn btn-secondary btn-sm !px-2" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)" [attr.aria-label]="i18n.t('action.next')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PaginationComponent {
  protected readonly i18n = inject(I18nService);

  readonly page = input(1);
  readonly pageSize = input(20);
  readonly total = input(0);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly pageSizeOptions = [10, 20, 50, 100];
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  onPageSizeChange(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
