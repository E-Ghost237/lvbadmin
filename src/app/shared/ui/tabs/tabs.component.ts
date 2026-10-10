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
    <div class="inline-flex items-center gap-1 rounded-[12px] p-1 overflow-x-auto thin-scroll max-w-full" style="background: var(--surface-2)" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button" role="tab" [attr.aria-selected]="active() === tab.id"
          class="px-3.5 py-1.5 rounded-[9px] text-sm font-semibold whitespace-nowrap transition-all duration-150"
          [style.background]="active() === tab.id ? 'var(--surface-1)' : 'transparent'"
          [style.color]="active() === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)'"
          [style.box-shadow]="active() === tab.id ? 'var(--shadow-sm)' : 'none'"
          (click)="active.set(tab.id)"
        >
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums" [style.background]="active() === tab.id ? 'var(--brand-50)' : 'transparent'" [style.color]="active() === tab.id ? 'var(--brand)' : 'var(--text-muted)'">{{ tab.count }}</span>
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
