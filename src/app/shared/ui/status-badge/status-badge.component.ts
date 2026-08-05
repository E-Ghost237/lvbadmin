import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { StatusDomain, i18nKeyFor, toneFor } from './status-color-map';

const TONE_CLASSES: Record<string, string> = {
  good: 'text-(--status-good) bg-(--status-good-bg)',
  warning: 'text-(--status-warning) bg-(--status-warning-bg)',
  serious: 'text-(--status-serious) bg-(--status-serious-bg)',
  critical: 'text-(--status-critical) bg-(--status-critical-bg)',
  neutral: 'text-(--status-neutral) bg-(--status-neutral-bg)',
  info: 'text-(--brand-600) bg-(--brand-50)',
};

/** Status is always paired with a visible label — never color alone (accessibility non-negotiable). */
@Component({
  selector: 'app-status-badge',
  template: `
    <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap" [class]="toneClass()">
      <span class="h-1.5 w-1.5 rounded-full" [style.background]="dotColor()"></span>
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  private readonly i18n = inject(I18nService);

  readonly domain = input.required<StatusDomain>();
  readonly status = input.required<string>();

  readonly tone = computed(() => toneFor(this.domain(), this.status()));
  readonly toneClass = computed(() => TONE_CLASSES[this.tone()]);
  readonly label = computed(() => this.i18n.t(i18nKeyFor(this.domain(), this.status())));
  readonly dotColor = computed(() => `var(--status-${this.tone() === 'info' ? 'neutral' : this.tone()})`);
}
