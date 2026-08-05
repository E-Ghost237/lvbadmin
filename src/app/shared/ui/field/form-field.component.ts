import { Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { firstErrorKey, isInvalidAndTouched } from '../../../core/utils/validators';

/**
 * Wraps a native form control with a consistent label / hint / error triad.
 * Usage:
 *   <app-field label="Téléphone" [control]="form.controls.telephone" required>
 *     <input class="input" formControlName="telephone" [class.input-invalid]="fieldInvalid" />
 *   </app-field>
 */
@Component({
  selector: 'app-field',
  template: `
    <div>
      <label class="field-label" [attr.for]="controlId()">
        {{ label() }}
        @if (required()) { <span class="text-(--status-critical)" aria-hidden="true">*</span> }
        @if (!required() && showOptional()) { <span class="text-(--text-muted) font-normal">({{ i18n.t('common.optional') }})</span> }
      </label>
      <ng-content></ng-content>
      @if (hint() && !errorMessage()) {
        <p class="field-hint">{{ hint() }}</p>
      }
      @if (errorMessage()) {
        <p class="field-error" role="alert">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {{ errorMessage() }}
        </p>
      }
    </div>
  `,
})
export class FormFieldComponent {
  protected readonly i18n = inject(I18nService);

  readonly label = input.required<string>();
  readonly control = input<AbstractControl | null>(null);
  readonly hint = input<string>('');
  readonly required = input(false, { transform: booleanAttribute });
  readonly showOptional = input(false, { transform: booleanAttribute });
  readonly controlId = input<string>('');
  /** Override the default i18n validation message for specific error keys, e.g. { min: 'Doit être ≥ 5' }. */
  readonly customMessages = input<Record<string, string>>({});

  readonly errorMessage = computed(() => {
    const control = this.control();
    if (!isInvalidAndTouched(control)) return '';
    const key = firstErrorKey(control);
    if (!key) return '';
    const custom = this.customMessages()[key];
    if (custom) return custom;
    const errorValue = control!.errors?.[key];
    const vars = typeof errorValue === 'object' && errorValue ? errorValue : {};
    return this.i18n.t(`validation.${this.mapErrorKey(key)}`, vars);
  });

  private mapErrorKey(key: string): string {
    const map: Record<string, string> = {
      required: 'required', email: 'email', phone: 'phone', minlength: 'minLength', maxlength: 'maxLength',
      min: 'min', max: 'max', integer: 'integer', positive: 'positive', pattern: 'pattern',
      passwordPolicy: 'passwordPolicy', mismatch: 'passwordMismatch', code: 'otp', dateRange: 'dateRange',
      percentage: 'percentage', unique: 'uniqueCode', fileType: 'fileType', fileSize: 'fileSize', futureDate: 'futureDate',
    };
    return map[key] ?? key;
  }
}
