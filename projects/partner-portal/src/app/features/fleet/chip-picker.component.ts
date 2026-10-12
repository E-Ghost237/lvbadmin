import { Component, input, output } from '@angular/core';

export interface ChipOption { value: string; label: string; hint?: string }

/** Multi-select as toggle chips. `value` is a comma-separated string so it plugs straight into the existing CSV form controls. */
@Component({
  selector: 'app-chip-picker',
  template: `
    <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="ariaLabel()">
      @for (o of options(); track o.value) {
        <button
          type="button" class="chip" [title]="o.hint ?? ''"
          [attr.aria-pressed]="isOn(o.value)"
          [style.background]="isOn(o.value) ? 'var(--app-accent)' : 'var(--surface-1)'"
          [style.color]="isOn(o.value) ? 'white' : 'var(--text-secondary)'"
          [style.border-color]="isOn(o.value) ? 'var(--app-accent)' : 'var(--border-strong)'"
          (click)="toggle(o.value)"
        >{{ o.label }}</button>
      }
    </div>
  `,
})
export class ChipPickerComponent {
  readonly options = input.required<ChipOption[]>();
  readonly value = input<string>('');
  readonly ariaLabel = input('');
  readonly valueChange = output<string>();

  private selected(): string[] { return this.value().split(',').map((s) => s.trim()).filter(Boolean); }
  protected isOn(v: string): boolean { return this.selected().includes(v); }

  toggle(v: string): void {
    const cur = this.selected();
    this.valueChange.emit((cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(', '));
  }
}
