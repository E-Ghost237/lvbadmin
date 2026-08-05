import { Component, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div class="flex h-12 w-12 items-center justify-center rounded-full" style="background: var(--surface-2)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <div>
        <p class="text-sm font-medium">{{ title() || i18n.t('common.noResults') }}</p>
        <p class="text-xs mt-1" style="color: var(--text-muted)">{{ hint() || i18n.t('common.noResultsHint') }}</p>
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
