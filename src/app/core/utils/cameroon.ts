/**
 * Cameroon-specific format knowledge, kept as pure functions so it is unit
 * tested and shared by every form (admin + partner portal).
 *
 * Two families of rules live here:
 *  - HARD rules (phone numbers, names…): a wrong value would be rejected by
 *    the backend or is unusable, so the form blocks submission.
 *  - ADVISORY rules (RCCM, NIU, vehicle plates, RIB, operator prefix): the
 *    backend accepts any string there, and real-world numbers come in older
 *    or unusual shapes. These only show a non-blocking warning with an
 *    example — a legitimate number must never be refused by the UI.
 */

// --- Phone -----------------------------------------------------------------

export type PhoneIssue = 'empty' | 'chars' | 'country' | 'short' | 'long' | 'prefix';
export type PhoneKind = 'mobile' | 'landline';
export type PhoneOperator = 'MTN' | 'ORANGE' | 'NEXTTEL' | 'CAMTEL';

export interface PhoneAnalysis {
  ok: boolean;
  issue?: PhoneIssue;
  /** Digits still missing (issue `short`) or in excess (issue `long`). */
  delta?: number;
  /** Canonical `+237XXXXXXXXX` — only when `ok`. */
  e164?: string;
  kind?: PhoneKind;
}

/**
 * Accepts the shapes people actually type: `+237 6 51 23 45 67`, `00237…`,
 * `237…` and the bare 9-digit national number. National numbers are 9 digits
 * starting with 6 (mobile) or 2 (landline).
 */
export function analyzeCmPhone(raw: string | null | undefined): PhoneAnalysis {
  const value = (raw ?? '').trim();
  if (!value) return { ok: false, issue: 'empty' };
  if (/[^\d\s+().-]/.test(value)) return { ok: false, issue: 'chars' };

  let digits = value.replace(/[^\d+]/g, '');
  if (digits.includes('+') && !digits.startsWith('+')) return { ok: false, issue: 'chars' };

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
    if (!digits.startsWith('237')) return { ok: false, issue: 'country' };
    digits = digits.slice(3);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
    if (!digits.startsWith('237')) return { ok: false, issue: 'country' };
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('237')) {
    digits = digits.slice(3);
  }

  if (digits.length < 9) return { ok: false, issue: 'short', delta: 9 - digits.length };
  if (digits.length > 9) return { ok: false, issue: 'long', delta: digits.length - 9 };
  if (digits[0] !== '6' && digits[0] !== '2') return { ok: false, issue: 'prefix' };
  return { ok: true, e164: `+237${digits}`, kind: digits[0] === '6' ? 'mobile' : 'landline' };
}

/** `+237…` canonical form when the input is a valid number, otherwise the input untouched. */
export function normalizeCmPhone(raw: string | null | undefined): string {
  const analysis = analyzeCmPhone(raw);
  return analysis.ok ? analysis.e164! : (raw ?? '');
}

/**
 * Best-effort operator from the number's prefix. Prefix allocations change,
 * so this is only ever used for a non-blocking hint, never to reject.
 */
export function detectOperator(e164: string): PhoneOperator | null {
  const local = e164.replace(/^\+237/, '');
  if (local.length !== 9 || local[0] !== '6') return null;
  const p3 = local.slice(0, 3);
  const p2 = local.slice(0, 2);
  if (/^65[0-4]$/.test(p3) || p2 === '67' || /^68[0-4]$/.test(p3)) return 'MTN';
  if (/^65[5-9]$/.test(p3) || p2 === '69' || /^68[5-9]$/.test(p3)) return 'ORANGE';
  if (p2 === '66') return 'NEXTTEL';
  if (p2 === '62') return 'CAMTEL';
  return null;
}

// --- Names & email -----------------------------------------------------------

export type NameIssue = 'short' | 'chars';

/** Letters (any script, accents), spaces, apostrophes, dots and hyphens; at least 2 characters. */
export function analyzeName(raw: string | null | undefined): { ok: boolean; issue?: NameIssue } {
  const value = (raw ?? '').trim();
  if (value.length < 2) return { ok: false, issue: 'short' };
  if (!/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(value)) return { ok: false, issue: 'chars' };
  return { ok: true };
}

export type EmailIssue = 'spaces' | 'format' | 'domain';

export function analyzeEmail(raw: string | null | undefined): { ok: boolean; issue?: EmailIssue } {
  const value = raw ?? '';
  if (/\s/.test(value.trim())) return { ok: false, issue: 'spaces' };
  const v = value.trim();
  if (!/^[^@\s]+@[^@\s]+$/.test(v)) return { ok: false, issue: 'format' };
  const domain = v.split('@')[1];
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return { ok: false, issue: 'domain' };
  }
  return { ok: true };
}

// --- Advisory (non-blocking) formats ---------------------------------------------

export type AdvisoryKind = 'rccm' | 'niu' | 'plate' | 'rib' | 'operator';

export interface Advisory {
  /** i18n key of the warning message. */
  key: string;
  params?: Record<string, string | number>;
}

const compact = (v: string): string => v.replace(/\s+/g, '').toUpperCase();

/** OHADA-style commercial register number, e.g. `RC/DLA/2020/B/1234`. */
export function rccmMatches(v: string): boolean {
  return /^RC\/[A-Z]{3}\/\d{4}\/[ABCM]\/\d{1,7}$/.test(compact(v));
}

/** Taxpayer ID (NIU): one letter (M or P), 12 digits, one letter — e.g. `M012345678901A`. */
export function niuMatches(v: string): boolean {
  return /^[MP]\d{12}[A-Z]$/.test(compact(v));
}

/** Current plate layout: two region letters, digits, one or two letters — e.g. `LT 123 AB`. */
export function plateMatches(v: string): boolean {
  return /^[A-Z]{2}[ -]?\d{3,4}[ -]?[A-Z]{1,2}$/.test(v.trim().toUpperCase());
}

/** Bank identity statement: 23 digits (RIB) or a `CM` IBAN of 27 characters. */
export function ribMatches(v: string): boolean {
  const c = compact(v);
  return /^\d{23}$/.test(c) || /^CM\d{25}$/.test(c);
}

/**
 * Non-blocking hint for `value`, or `null` when the value looks right (or is
 * empty — presence is a separate, hard rule). `context.operator` is the
 * operator the user picked for a Mobile Money number.
 */
export function advisoryFor(kind: AdvisoryKind, value: string | null | undefined, context?: { operator?: string }): Advisory | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  switch (kind) {
    case 'rccm':
      return rccmMatches(v) ? null : { key: 'advisory.rccm' };
    case 'niu':
      return niuMatches(v) ? null : { key: 'advisory.niu' };
    case 'plate':
      return plateMatches(v) ? null : { key: 'advisory.plate' };
    case 'rib':
      return ribMatches(v) ? null : { key: 'advisory.rib' };
    case 'operator': {
      const analysis = analyzeCmPhone(v);
      if (!analysis.ok || !context?.operator) return null;
      const detected = detectOperator(analysis.e164!);
      const chosen = context.operator === 'MTN_MOMO' ? 'MTN' : context.operator === 'ORANGE_MONEY' ? 'ORANGE' : null;
      if (!detected || !chosen || detected === chosen) return null;
      return { key: 'advisory.operator', params: { detected, chosen } };
    }
  }
}
