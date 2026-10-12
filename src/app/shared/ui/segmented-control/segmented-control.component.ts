import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

export interface SegmentOption {
  value: string;
  label: string;
}

/**
 * Replaces the ad hoc "pill row" (`Toutes villes / Douala / Yaoundé`-style)
 * that several pages built inline with duplicated `[style.background]` ternaries
 * — one shared, properly transitioned control instead.
 */
@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg-group max-w-full overflow-x-auto thin-scroll" [class.flex]="fullWidth()" role="tablist" [attr.aria-label]="ariaLabel() || null">
      @for (opt of options(); track opt.value) {
        <button
          type="button" role="tab" [attr.aria-selected]="value() === opt.value" [disabled]="disabled()"
          class="seg-item disabled:opacity-50 disabled:cursor-not-allowed"
          [class.seg-item-active]="value() === opt.value"
          [class.flex-1]="fullWidth()"
          (click)="valueChange.emit(opt.value)"
        >{{ opt.label }}</button>
      }
    </div>
  `,
})
export class SegmentedControlComponent {
  readonly options = input.required<SegmentOption[]>();
  readonly value = input.required<string>();
  readonly ariaLabel = input<string>('');
  readonly disabled = input(false);
  /** Stretches the pills to fill the container width in equal shares (e.g. a two-way toggle inside a card). */
  readonly fullWidth = input(false, { transform: booleanAttribute });
  readonly valueChange = output<string>();
}
