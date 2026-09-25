/** Cameroon is UTC+1 all year (no DST) — the backend stores instants and validates `after:` on them. */
const DOUALA_OFFSET = '+01:00';

/** `<input type="datetime-local">` value ("2026-09-25T14:30") → ISO instant in Douala time. */
export function localToIso(local: string): string {
  return local.length === 16 ? `${local}:00${DOUALA_OFFSET}` : local;
}

/** Instant → value for `<input type="datetime-local">` in Douala time. */
export function isoToLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

export function nowLocal(offsetHours = 0): string {
  return isoToLocal(new Date(Date.now() + offsetHours * 3_600_000).toISOString());
}

export function formatDouala(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Douala' }).format(new Date(iso));
}
