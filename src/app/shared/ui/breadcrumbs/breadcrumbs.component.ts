import { RouterLink } from '@angular/router';
import { Component, input } from '@angular/core';

export interface Crumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  template: `
    <nav aria-label="Fil d’Ariane" class="flex items-center gap-1.5 text-sm mb-1">
      @for (crumb of crumbs(); track crumb.label; let last = $last) {
        @if (crumb.link && !last) {
          <a [routerLink]="crumb.link" class="link" style="color: var(--text-muted)">{{ crumb.label }}</a>
        } @else {
          <span [style.color]="last ? 'var(--text-primary)' : 'var(--text-muted)'" [style.fontWeight]="last ? 600 : 400">{{ crumb.label }}</span>
        }
        @if (!last) {
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
        }
      }
    </nav>
  `,
})
export class BreadcrumbsComponent {
  readonly crumbs = input.required<Crumb[]>();
}
