import { Component, input, model } from '@angular/core';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

/** Tab bar only — parent switches content on `active()` (keeps this component trivial and reusable). */
@Component({
  selector: 'app-tabs',
  template: `
    <div class="flex items-center gap-1 border-b overflow-x-auto thin-scroll" style="border-color: var(--border)" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button" role="tab" [attr.aria-selected]="active() === tab.id"
          class="relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
          [style.color]="active() === tab.id ? 'var(--brand)' : 'var(--text-secondary)'"
          (click)="active.set(tab.id)"
        >
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums" style="background: var(--surface-2); color: var(--text-muted)">{{ tab.count }}</span>
          }
          @if (active() === tab.id) {
            <span class="absolute left-0 right-0 -bottom-px h-0.5 rounded-full" style="background: var(--brand)"></span>
          }
        </button>
      }
    </div>
  `,
})
export class TabsComponent {
  readonly tabs = input.required<TabDef[]>();
  readonly active = model.required<string>();
}
