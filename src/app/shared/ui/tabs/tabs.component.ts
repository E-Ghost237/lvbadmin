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
    <div class="tab-bar thin-scroll" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button" role="tab" [attr.aria-selected]="active() === tab.id"
          class="tab" [class.tab-active]="active() === tab.id"
          (click)="active.set(tab.id)"
        >
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="tab-count">{{ tab.count }}</span>
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
