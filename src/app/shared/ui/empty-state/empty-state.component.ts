import { Component, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="state-block">
      <div class="state-icon" style="background: var(--brand-50); color: var(--brand)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <div>
        <p class="state-title">{{ title() || i18n.t('common.noResults') }}</p>
        <p class="state-hint mt-1">{{ hint() || i18n.t('common.noResultsHint') }}</p>
      </div>
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  protected readonly i18n = inject(I18nService);
  readonly title = input<string>('');
  readonly hint = input<string>('');
}
