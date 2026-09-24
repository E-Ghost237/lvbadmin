import { Component, booleanAttribute, computed, effect, inject, input, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AdvisoryKind, advisoryFor } from '../../../core/utils/cameroon';
import { firstErrorKey, isInvalidAndTouched } from '../../../core/utils/validators';

/**
 * Wraps a native form control with a consistent label / hint / error triad.
 * Usage:
 *   <app-field label="Téléphone" [control]="form.controls.telephone" required>
 *     <input class="input" formControlName="telephone" />
 *   </app-field>
 *
 * Error display is driven by the control's own event stream. A control's
 * `touched`/`errors`/`value` are plain properties, not signals — reading
 * them inside a `computed()` alone is memoised forever and the message
 * would never appear. `tick` bumps on every control event so the computed
 * values below re-evaluate.
 *
 * Three kinds of feedback, in priority order:
 *  1. error   — blocks submission, says exactly what to fix (validators
 *               return a `reason`, see `validation.<rule>.<reason>` keys).
 *  2. advisory — non-blocking amber hint (RCCM, NIU, plate, RIB…): the
 *               backend accepts any value there, so this only warns.
 *  3. hint    — static help text.
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
      @if (errorMessage()) {
        <p class="field-error" role="alert">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {{ errorMessage() }}
        </p>
      } @else if (advisoryMessage()) {
        <p class="field-warning" role="status">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="17.5" x2="12.01" y2="17.5"/></svg>
          {{ advisoryMessage() }}
        </p>
      } @else if (hint()) {
        <p class="field-hint">{{ hint() }}</p>
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
  /** Non-blocking format check — see `advisoryFor` in core/utils/cameroon. */
  readonly advisory = input<AdvisoryKind | null>(null);
  readonly advisoryContext = input<{ operator?: string } | undefined>(undefined);

  private readonly tick = signal(0);

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      if (!control) return;
      const sub = control.events.subscribe(() => this.tick.update((n) => n + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }

  readonly errorMessage = computed(() => {
    this.tick();
    const control = this.control();
    if (!isInvalidAndTouched(control)) return '';
    const key = firstErrorKey(control);
    if (!key) return '';
    return this.messageFor(control!, key);
  });

  readonly advisoryMessage = computed(() => {
    this.tick();
    this.i18n.locale();
    const kind = this.advisory();
    const control = this.control();
    if (!kind || !control) return '';
    const result = advisoryFor(kind, control.value as string | null, this.advisoryContext());
    return result ? this.i18n.t(result.key, result.params) : '';
  });

  private messageFor(control: AbstractControl, key: string): string {
    this.i18n.locale();
    const custom = this.customMessages()[key];
    if (custom) return custom;
    const value = control.errors?.[key] as unknown;

    // Server-side (backend) error attached to this control by FormFeedbackService.
    if (key === 'server') {
      if (typeof value === 'string') return value;
      return (value as { message?: string } | null)?.message ?? '';
    }

    const vars: Record<string, string | number> = {};
    let reason: string | undefined;
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'string' || typeof v === 'number') vars[k] = v;
      }
      reason = typeof (value as { reason?: unknown }).reason === 'string' ? (value as { reason: string }).reason : undefined;
    }
    // Angular's built-in length validators name their bound `requiredLength`.
    if (key === 'minlength') vars['min'] = Number(vars['requiredLength']);
    if (key === 'maxlength') vars['max'] = Number(vars['requiredLength']);

    const base = this.mapErrorKey(key);
    if (reason) {
      const specificKey = `validation.${base}.${reason}`;
      const specific = this.i18n.t(specificKey, vars);
      if (specific !== specificKey) return specific;
    }
    return this.i18n.t(`validation.${base}`, vars);
  }

  private mapErrorKey(key: string): string {
    const map: Record<string, string> = {
      required: 'required', email: 'email', phone: 'phone', minlength: 'minLength', maxlength: 'maxLength',
      min: 'min', max: 'max', integer: 'integer', positive: 'positive', pattern: 'pattern',
      passwordPolicy: 'passwordPolicy', mismatch: 'passwordMismatch', code: 'otp', dateRange: 'dateRange',
      percentage: 'percentage', unique: 'uniqueCode', fileType: 'fileType', fileSize: 'fileSize', futureDate: 'futureDate',
      personName: 'personName', minAge: 'minAge', pastDate: 'pastDate', date: 'date',
    };
    return map[key] ?? key;
  }
}
