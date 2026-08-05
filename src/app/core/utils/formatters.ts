/** Display formatting helpers — §2.4.3 units and conventions. */

const XAF_FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Franc CFA has no decimal subunit in this system — always an integer. */
export function formatXaf(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `${XAF_FORMATTER.format(Math.round(amount))} XAF`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)} %`;
}

const DATE_TZ = 'Africa/Douala';

/** All storage is UTC; display is always Africa/Douala (UTC+1) per §2.4.3. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: DATE_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: DATE_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: DATE_TZ, hour: '2-digit', minute: '2-digit' }).format(date);
}

/** "il y a 4 min" — honest relative timestamps for last-known-position style UI (RG-034/UC-CLI-03 analogue). */
export function formatRelative(iso: string | null | undefined, locale: 'fr' | 'en' = 'fr'): string {
  if (!iso) return '—';
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return '—';
  const diffSec = Math.round((Date.now() - date) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { numeric: 'auto' });
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  return rtf.format(-diffDay, 'day');
}

export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes < 60) return `${minutes} min${seconds ? ` ${seconds} s` : ''}`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours} h ${remMin.toString().padStart(2, '0')}`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const match = phone.match(/^\+237(\d{1})(\d{2})(\d{3})(\d{3})$/);
  if (!match) return phone;
  return `+237 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
