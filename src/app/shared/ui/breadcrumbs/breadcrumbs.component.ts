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
    <nav aria-label="Fil d’Ariane" class="flex items-center gap-1.5 flex-wrap">
      @for (crumb of crumbs(); track crumb.label; let last = $last) {
        @if (crumb.link && !last) {
          <a [routerLink]="crumb.link" class="link" style="color: var(--text-secondary); font-weight: 500">{{ crumb.label }}</a>
        } @else {
          <span [style.color]="last ? 'var(--text-muted)' : 'var(--text-secondary)'" [style.fontWeight]="last ? 600 : 500">{{ crumb.label }}</span>
        }
        @if (!last) {
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" stroke-width="2.5" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        }
      }
    </nav>
  `,
  styles: `
    :host { display: block; font-size: 12.5px; line-height: 1.4; }
  `,
})
export class BreadcrumbsComponent {
  readonly crumbs = input.required<Crumb[]>();
}
