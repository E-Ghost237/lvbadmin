import { Injectable, inject } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ProblemDetails } from '../../../core/models/common.model';
import { ToastService } from '../toast/toast.service';

function invalidLeafCount(control: AbstractControl): number {
  if (control instanceof FormGroup || control instanceof FormArray) {
    return Object.values(control.controls).reduce((sum, child) => sum + invalidLeafCount(child), 0);
  }
  return control.invalid ? 1 : 0;
}

/**
 * One place that answers "why did nothing happen?" for every form:
 *  - `invalid(form)`     submit refused client-side → touch every field (so each
 *                        shows its own reason), say how many need fixing, scroll to the first.
 *  - `serverError(form)` backend refused the request → show the plain-language
 *                        message AND pin each refused field's reason under that field.
 *  - `blocked(message)`  a precondition outside the form (e.g. "pick a client first").
 */
@Injectable({ providedIn: 'root' })
export class FormFeedbackService {
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  invalid(form: AbstractControl): void {
    form.markAllAsTouched();
    const count = Math.max(1, invalidLeafCount(form));
    this.toast.warning(
      this.i18n.t('feedback.incomplete.title'),
      count === 1
        ? this.i18n.t('feedback.incomplete.messageOne')
        : this.i18n.t('feedback.incomplete.message', { count }),
    );
    this.revealFirstError();
  }

  serverError(form: AbstractControl | null, title: string, err: ProblemDetails): void {
    if (form) this.applyFieldErrors(form, err);
    this.toast.error(title, err.detail);
    if (form) this.revealFirstError();
  }

  /** A precondition the form itself can't express — tell the user what to do instead of silently ignoring the click. */
  blocked(message: string, title?: string): void {
    this.toast.warning(title ?? this.i18n.t('feedback.incomplete.title'), message);
  }

  /** Pins each server-refused field's reason under the matching control. Returns how many controls matched. */
  applyFieldErrors(form: AbstractControl, err: ProblemDetails): number {
    let matched = 0;
    for (const issue of err.field_errors ?? []) {
      const control = form.get(issue.field);
      if (!control) continue;
      const reason = issue.reason.charAt(0).toUpperCase() + issue.reason.slice(1);
      control.setErrors({ ...(control.errors ?? {}), server: reason });
      control.markAsTouched();
      matched++;
    }
    return matched;
  }

  /** Scrolls the first visible error into view and focuses its input (topmost open modal first). */
  private revealFirstError(): void {
    if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      const root: ParentNode = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document;
      const firstError = root.querySelector('.field-error');
      if (!firstError) return;
      const field = firstError.parentElement;
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.querySelector<HTMLElement>('input, textarea, select, button[role="combobox"]')?.focus({ preventScroll: true });
    }));
  }
}
