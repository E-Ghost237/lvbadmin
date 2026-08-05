import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-rows',
  template: `
    <div class="flex flex-col gap-2.5 p-4" role="status" aria-label="Chargement en cours">
      @for (row of rowsArray(); track $index) {
        <div class="skeleton h-9 w-full"></div>
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
