import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle',
  template: `
    <button
      type="button" role="switch" [attr.aria-checked]="checked()" [attr.aria-label]="label()"
      class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
      [style.background]="checked() ? 'var(--brand)' : 'var(--border-strong)'"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform" [style.transform]="checked() ? 'translateX(18px)' : 'translateX(3px)'"></span>
    </button>
  `,
})
export class ToggleComponent {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly label = input('');
  readonly checkedChange = output<boolean>();

  toggle(): void {
    if (this.disabled()) return;
    this.checkedChange.emit(!this.checked());
  }
}
