import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom validators enforcing the CDC's business rules at the form boundary.
 * Every validator here mirrors a specific RG-/SEC-/ENF- requirement so the
 * mapping between UI validation and the contractual rule stays traceable.
 */

const E164_CM_PATTERN = /^\+237[26]\d{8}$/;

/** §2.4.3 — phone numbers stored in E.164 (+237XXXXXXXXX). */
export function e164Phone(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === '' || control.value === undefined) return null;
    return E164_CM_PATTERN.test(String(control.value).trim()) ? null : { phone: true };
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
