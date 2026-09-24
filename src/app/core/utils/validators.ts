import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { analyzeCmPhone, analyzeEmail, analyzeName } from './cameroon';

/**
 * Custom validators enforcing the CDC's business rules at the form boundary.
 * Every validator here mirrors a specific RG-/SEC-/ENF- requirement so the
 * mapping between UI validation and the contractual rule stays traceable.
 *
 * Failing validators return an error object carrying a `reason` (and any
 * numbers the message needs) so `FormFieldComponent` can tell the user
 * exactly what to fix instead of a generic "invalid" — see `validation.*`
 * in the i18n dictionaries.
 */

const isBlank = (value: unknown): boolean => value === null || value === undefined || String(value).trim() === '';

/**
 * §2.4.3 — Cameroon phone number, mobile (6XXXXXXXX) or landline (2XXXXXXXX),
 * typed in any usual shape. The value is normalised to `+237XXXXXXXXX` on
 * blur by `CmPhoneDirective`; the backend's partner/rental modules require
 * that canonical form.
 */
export function e164Phone(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const a = analyzeCmPhone(String(control.value));
    return a.ok ? null : { phone: { reason: a.issue, delta: a.delta ?? 0 } };
  };
}

/**
 * Identity module (accounts, registration, admin user creation) only
 * accepts MOBILE numbers (`+2376XXXXXXXX`) — a landline is rejected there.
 */
export function cmMobilePhone(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const a = analyzeCmPhone(String(control.value));
    if (!a.ok) return { phone: { reason: a.issue, delta: a.delta ?? 0 } };
    return a.kind === 'mobile' ? null : { phone: { reason: 'landline', delta: 0 } };
  };
}

/** Mobile Money number: a Cameroon mobile number whenever the chosen provider is MTN or Orange. */
export function momoAccount(provider: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const p = provider();
    if (p !== 'MTN_MOMO' && p !== 'ORANGE_MONEY') return null;
    const a = analyzeCmPhone(String(control.value));
    if (!a.ok) return { phone: { reason: a.issue, delta: a.delta ?? 0 } };
    return a.kind === 'mobile' ? null : { phone: { reason: 'landline', delta: 0 } };
  };
}

/** Stricter than Angular's `Validators.email` (which accepts `a@b`): requires a dotted domain and no spaces. */
export function emailAddress(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const a = analyzeEmail(String(control.value));
    return a.ok ? null : { email: { reason: a.issue } };
  };
}

/** Person name: letters (accents allowed), spaces, apostrophes, dots and hyphens; 2+ characters. */
export function personName(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const a = analyzeName(String(control.value));
    return a.ok ? null : { personName: { reason: a.issue } };
  };
}

/** Whole-XAF amount within bounds — there is no decimal subunit (§2.4.3). */
export function xafAmount(min = 0, max = 1_000_000_000): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const num = Number(control.value);
    if (!Number.isFinite(num) || !Number.isInteger(num)) return { integer: true };
    if (num < min) return { min: { min, actual: num } };
    if (num > max) return { max: { max, actual: num } };
    return null;
  };
}

/** Whole number within `[min, max]` — quantities, years, minutes, basis points… (money uses `xafAmount`, same rule). */
export const intRange = xafAmount;

/** Web address. `httpsOnly` mirrors the backend's `url:https` rule (logos, photos, media). */
export function webUrl(httpsOnly = false): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    try {
      const url = new URL(String(control.value).trim());
      if (url.protocol !== 'https:' && (httpsOnly || url.protocol !== 'http:')) return { url: { reason: 'protocol' } };
      if (!url.hostname.includes('.')) return { url: { reason: 'format' } };
      return null;
    } catch {
      return { url: { reason: 'format' } };
    }
  };
}

/** Comma-separated list (zones, licence categories…) with an item-count and per-item length cap. */
export function csvList(opts: { maxItems: number; maxItemLength: number }): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const items = String(control.value).split(',').map((i) => i.trim()).filter(Boolean);
    if (items.length > opts.maxItems) return { list: { reason: 'items', max: opts.maxItems } };
    const tooLong = items.find((i) => i.length > opts.maxItemLength);
    if (tooLong) return { list: { reason: 'itemLength', max: opts.maxItemLength, item: tooLong } };
    return null;
  };
}

/** Group rule: at least one of `fields` must be filled — the error is shown under the LAST field of the list. */
export function requireOneOf(fields: string[], reason?: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const controls = fields.map((f) => group.get(f)).filter((c): c is AbstractControl => !!c);
    if (controls.length !== fields.length) return null;
    const anyFilled = controls.some((c) => !isBlank(c.value));
    const target = controls[controls.length - 1];
    if (anyFilled) {
      if (target.hasError('oneOf')) {
        const { oneOf, ...rest } = target.errors ?? {};
        target.setErrors(Object.keys(rest).length ? rest : null);
      }
      return null;
    }
    target.setErrors({ ...(target.errors ?? {}), oneOf: reason ? { reason } : true });
    return null;
  };
}

/** The person must be at least `years` old on the given `YYYY-MM-DD` date (driver: 18). */
export function minAge(years = 18): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const born = new Date(String(control.value));
    if (Number.isNaN(born.getTime())) return { date: true };
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() - years);
    return born.getTime() <= limit.getTime() ? null : { minAge: { years } };
  };
}

/** Date that must not be in the past (document/licence expiry). Set `strict` to require a date after today. */
export function notInPast(strict = false): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (isBlank(control.value)) return null;
    const date = new Date(String(control.value));
    if (Number.isNaN(date.getTime())) return { date: true };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compare = new Date(date);
    compare.setHours(0, 0, 0, 0);
    const ok = strict ? compare.getTime() > today.getTime() : compare.getTime() >= today.getTime();
    return ok ? null : { pastDate: { reason: strict ? 'strict' : 'past' } };
  };
}

/** Trims and rejects a value made only of whitespace. */
export function requiredTrimmed(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined) return { required: true };
    return String(value).trim().length === 0 ? { required: true } : null;
  };
}

/** §2.4.3 — "Aucun flottant ne DOIT être utilisé pour un montant" (XAF is an integer franc amount). */
export function integerAmount(min = 0): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isInteger(num)) return { integer: true };
    if (num < min) return { min: { min } };
    return null;
  };
}

export function positiveInteger(): ValidatorFn {
  return integerAmount(1);
}

/** RG-015 / commissions / coefficients expressed as 0-100 percentages. */
export function percentageRange(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return { pattern: true };
    return num < 0 || num > 100 ? { percentage: true } : null;
  };
}

/** SEC-01 — 12 char minimum, upper + lower + digit, for internal staff accounts. */
export function passwordPolicy(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) return null;
    const longEnough = value.length >= 12;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);
    return longEnough && hasUpper && hasLower && hasDigit ? null : { passwordPolicy: true };
  };
}

/** 6-digit numeric OTP / MFA code (SEC-04, UC-AUT-02 second factor). */
export function digitCode(length = 6): ValidatorFn {
  const re = new RegExp(`^\\d{${length}}$`);
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;
    return re.test(String(value).trim()) ? null : { code: true };
  };
}

/** Cross-field: `field` must be strictly in the future. */
export function futureDate(field: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const control = group.get(field);
    if (!control || !control.value) return null;
    const date = new Date(control.value);
    if (Number.isNaN(date.getTime())) return null;
    const err = date.getTime() > Date.now() ? null : { futureDate: true };
    if (err) control.setErrors({ ...(control.errors ?? {}), ...err });
    return null;
  };
}

/** Cross-field: `endField` must be after `startField` (grille tarifaire, périodes, exports). */
export function dateRangeValid(startField: string, endField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startField)?.value;
    const end = group.get(endField)?.value;
    if (!start || !end) return null;
    const invalid = new Date(end).getTime() < new Date(start).getTime();
    const endControl = group.get(endField);
    if (invalid && endControl) {
      endControl.setErrors({ ...(endControl.errors ?? {}), dateRange: true });
    }
    return null;
  };
}

/** Cross-field: two password controls must match (UC-AUT-05 reset flow). */
export function matchControls(field: string, matchField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const control = group.get(field);
    const matchControl = group.get(matchField);
    if (!control || !matchControl || !matchControl.value) return null;
    if (control.value !== matchControl.value) {
      matchControl.setErrors({ ...(matchControl.errors ?? {}), mismatch: true });
    } else if (matchControl.hasError('mismatch')) {
      const { mismatch, ...rest } = matchControl.errors ?? {};
      matchControl.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  };
}

/** Requires `targetField` when `triggerField` equals one of `values` (e.g. motif obligatoire si rejet). */
export function requiredWhen(triggerField: string, values: unknown[], targetField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const trigger = group.get(triggerField)?.value;
    const target = group.get(targetField);
    if (!target) return null;
    const shouldRequire = values.includes(trigger);
    const isEmpty = target.value === null || target.value === undefined || String(target.value).trim() === '';
    if (shouldRequire && isEmpty) {
      target.setErrors({ ...(target.errors ?? {}), required: true });
    } else if (target.hasError('required') && !shouldRequire) {
      const { required, ...rest } = target.errors ?? {};
      target.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  };
}

/** Rejects a code already present in `existing` (case-insensitive) — promo codes, grid labels, zone names. */
export function uniqueAmong(existing: () => string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim().toLowerCase();
    if (!value) return null;
    return existing().some((v) => v.toLowerCase() === value) ? { unique: true } : null;
  };
}

export function fileConstraints(opts: { maxSizeMb: number; acceptedTypes: string[] }): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const file = control.value as File | null;
    if (!file) return null;
    const errors: ValidationErrors = {};
    if (!opts.acceptedTypes.includes(file.type)) errors['fileType'] = true;
    if (file.size > opts.maxSizeMb * 1024 * 1024) errors['fileSize'] = { max: opts.maxSizeMb };
    return Object.keys(errors).length ? errors : null;
  };
}

/** First human-readable validation-error message for `control`, or null if valid/untouched. */
export function firstErrorKey(control: AbstractControl | null): string | null {
  if (!control || !control.errors) return null;
  return Object.keys(control.errors)[0] ?? null;
}

export function isInvalidAndTouched(control: AbstractControl | null): boolean {
  if (!control) return false;
  return control.invalid && (control.touched || control.dirty);
}

export function markGroupTouched(group: FormGroup): void {
  group.markAllAsTouched();
  Object.values(group.controls).forEach((c) => {
    if (c instanceof FormGroup) markGroupTouched(c);
  });
}
