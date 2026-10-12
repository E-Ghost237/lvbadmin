import { Component, input } from '@angular/core';

/** Table-shaped skeleton used while a list page loads. */
@Component({
  selector: 'app-skeleton-rows',
  template: `
    <div class="flex flex-col" role="status" aria-label="Chargement en cours">
      @for (row of rowsArray(); track $index) {
        <div class="flex items-center gap-4 px-4 py-3.5" style="border-bottom: 1px solid var(--border)">
          <span class="skeleton h-3.5 w-3.5 !rounded-full"></span>
          <span class="skeleton h-3.5 flex-1 max-w-70"></span>
          <span class="skeleton h-3.5 w-24 hidden sm:block"></span>
          <span class="skeleton h-3.5 w-16 hidden md:block"></span>
        </div>
      }
    </div>
  `,
})
export class SkeletonRowsComponent {
  readonly rows = input(5);
  rowsArray(): number[] {
    return Array.from({ length: this.rows() });
  }
}
