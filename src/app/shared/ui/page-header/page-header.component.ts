import { Component, input } from '@angular/core';
import { BreadcrumbsComponent, Crumb } from '../breadcrumbs/breadcrumbs.component';

/**
 * The header every feature page opens with: breadcrumb trail, page title,
 * one-line subtitle and a right-aligned action row.
 *
 *   <app-page-header [crumbs]="[{ label: 'Commandes' }]" title="Commandes" subtitle="…">
 *     <button class="btn btn-primary btn-sm">Nouvelle commande</button>
 *   </app-page-header>
 *
 * Detail screens that need richer markup (avatar, status pill, mixed
 * typography) project their own `[page-head-text]` block instead of using
 * `title`/`subtitle`, and `[page-head-lead]` (avatar / icon chip) sits before
 * the text in both shapes. Everything else projected lands in the actions row.
 */
@Component({
  selector: 'app-page-header',
  imports: [BreadcrumbsComponent],
  template: `
    <header class="page-head">
      @if (crumbs().length) {
        <app-breadcrumbs [crumbs]="crumbs()" />
      }
      <div class="page-head-row">
        <div class="page-head-lead">
          <ng-content select="[page-head-lead]" />
          @if (title()) {
            <div class="page-head-text">
              <h1 class="page-title">{{ title() }}</h1>
              @if (subtitle()) {
                <p class="page-sub">{{ subtitle() }}</p>
              }
            </div>
          }
          <ng-content select="[page-head-text]" />
        </div>
        <div class="page-head-actions">
          <ng-content />
        </div>
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input('');
  readonly subtitle = input('');
  readonly crumbs = input<Crumb[]>([]);
}
