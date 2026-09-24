import { Directive, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { normalizeCmPhone } from '../../../core/utils/cameroon';

/**
 * `<input appCmPhone …>` — accepts a Cameroon number typed any usual way
 * (`651234567`, `237 651 23 45 67`, `00237…`, `+237 6 51 23 45 67`) and
 * rewrites it to the canonical `+237651234567` when the field is left or
 * Enter is pressed. The backend's partner/rental modules require exactly
 * that form (`+` prefix, no spaces); doing it here means the user never
 * has to know. An invalid value is left untouched so the validator can
 * explain what is wrong.
 */
@Directive({
  selector: 'input[appCmPhone]',
  host: {
    inputmode: 'tel',
    autocomplete: 'tel',
    '(blur)': 'normalize()',
    '(keydown.enter)': 'normalize()',
  },
})
export class CmPhoneDirective {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  normalize(): void {
    const current = this.el.nativeElement.value;
    const normalised = normalizeCmPhone(current);
    if (normalised === current) return;
    if (this.ngControl?.control) {
      this.ngControl.control.setValue(normalised);
    } else {
      this.el.nativeElement.value = normalised;
      this.el.nativeElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}
