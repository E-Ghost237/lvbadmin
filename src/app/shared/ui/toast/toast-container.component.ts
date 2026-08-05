import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

const ICONS: Record<string, string> = {
  success: 'm9 12 2 2 4-4M12 22a10 10 0 100-20 10 10 0 000 20Z',
  error: 'M12 8v4M12 16h.01M12 22a10 10 0 100-20 10 10 0 000 20Z',
  info: 'M12 16v-4M12 8h.01M12 22a10 10 0 100-20 10 10 0 000 20Z',
  warning: 'M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0ZM12 9v4M12 17h.01',
};
const COLORS: Record<string, string> = {
  success: 'var(--status-good)', error: 'var(--status-critical)', info: 'var(--brand)', warning: 'var(--status-warning)',
};

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="card shadow-(--shadow-lg) px-4 py-3 flex items-start gap-3 animate-[toast-in_0.18s_ease]" role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" [attr.stroke]="colorFor(toast.kind)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0" aria-hidden="true">
            <path [attr.d]="iconFor(toast.kind)" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">{{ toast.title }}</p>
            @if (toast.message) { <p class="text-xs mt-0.5" style="color: var(--text-muted)">{{ toast.message }}</p> }
          </div>
          <button type="button" class="shrink-0 opacity-60 hover:opacity-100" (click)="toasts.dismiss(toast.id)" aria-label="Fermer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      }
    </div>
    <style>
      @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    </style>
  `,
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
  iconFor(kind: string): string { return ICONS[kind] ?? ICONS['info']; }
  colorFor(kind: string): string { return COLORS[kind] ?? COLORS['info']; }
}
