import { Component, computed, input } from '@angular/core';

export type BannerKind = 'info' | 'warning' | 'danger' | 'success';

const ICONS: Record<BannerKind, string> = {
  info: 'M12 16v-4M12 8h.01M12 22a10 10 0 100-20 10 10 0 000 20Z',
  warning: 'M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0ZM12 9v4M12 17h.01',
  danger: 'M12 8v4M12 16h.01M12 22a10 10 0 100-20 10 10 0 000 20Z',
  success: 'm9 12 2 2 4-4M12 22a10 10 0 100-20 10 10 0 000 20Z',
};

const CLASSES: Record<BannerKind, string> = {
  info: 'text-(--brand-600) bg-(--brand-50) border-(--brand-100)',
  warning: 'text-(--status-warning) bg-(--status-warning-bg) border-transparent',
  danger: 'text-(--status-critical) bg-(--status-critical-bg) border-transparent',
  success: 'text-(--status-good) bg-(--status-good-bg) border-transparent',
};

@Component({
  selector: 'app-alert-banner',
  template: `
    <div class="flex items-start gap-3 rounded-(--radius-md) border px-4 py-3 text-sm" [class]="classes()" role="status">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0" aria-hidden="true">
        <path [attr.d]="icon()" />
      </svg>
      <div class="flex-1">
        @if (title()) { <p class="font-medium">{{ title() }}</p> }
        <div class="text-[13px] opacity-90"><ng-content></ng-content></div>
      </div>
    </div>
  `,
})
export class AlertBannerComponent {
  readonly kind = input<BannerKind>('info');
  readonly title = input<string>('');

  readonly icon = computed(() => ICONS[this.kind()]);
  readonly classes = computed(() => CLASSES[this.kind()]);
}
