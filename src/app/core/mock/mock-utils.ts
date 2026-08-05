import { Observable, delay, of, throwError } from 'rxjs';
import { ListQuery, PagedResult, ProblemDetails } from '../models';
import { ERROR_CODES } from '../errors/error-codes';

/** Small deterministic PRNG (mulberry32) so demo data is stable across a session's re-seed. */
export function createRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickMany<T>(rng: () => number, arr: readonly T[], count: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function uid(prefix: string, rng: () => number): string {
  return `${prefix}_${Math.floor(rng() * 1e9).toString(36)}`;
}

export function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function isoDaysAgo(days: number, rng?: () => number): string {
  const jitterMs = rng ? rng() * 86_400_000 : 0;
  return new Date(Date.now() - days * 86_400_000 - jitterMs).toISOString();
}

export function isoInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** A random point some minutes after `baseIso`, clamped to now — keeps derived lifecycle
 * timestamps (e.g. "affectée le") consistent with an order's actual creation date instead of
 * always landing near the present, which breaks chronology for older seeded orders. */
export function isoAfter(baseIso: string, minMinutes: number, maxMinutes: number, rng: () => number): string {
  const base = new Date(baseIso).getTime();
  const offsetMs = randomInt(rng, minMinutes, maxMinutes) * 60_000;
  return new Date(Math.min(base + offsetMs, Date.now())).toISOString();
}

/** Simulated network latency window, tuned to feel real without slowing down demos. */
const LATENCY_MIN = 180;
const LATENCY_MAX = 520;

export function mockOk<T>(value: T, latency = randomLatency()): Observable<T> {
  return of(value).pipe(delay(latency));
}

function randomLatency(): number {
  return LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
}

export function mockFail<T>(code: keyof typeof ERROR_CODES, detail?: string, instance?: string): Observable<T> {
  const def = ERROR_CODES[code];
  const problem: ProblemDetails = {
    type: `https://api.lvb.cm/errors/${code.toLowerCase()}`,
    title: def.fr,
    status: def.http,
    code,
    detail: detail ?? def.fr,
    instance,
    request_id: Math.random().toString(36).slice(2),
  };
  return throwError(() => problem).pipe(delay(randomLatency()));
}

export function paginate<T>(items: T[], query: ListQuery | undefined): PagedResult<T> {
  const page = query?.page && query.page > 0 ? query.page : 1;
  const pageSize = query?.page_size && query.page_size > 0 ? query.page_size : 20;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  };
}

export function matchesSearch(haystacks: (string | undefined | null)[], search: string | undefined): boolean {
  if (!search || !search.trim()) return true;
  const needle = search.trim().toLowerCase();
  return haystacks.some((h) => h?.toLowerCase().includes(needle));
}

export const CM_FIRST_NAMES = [
  'Paul', 'Jean', 'Aïcha', 'Larissa', 'Ndongo', 'Marie', 'Pierre', 'Sandrine', 'Yves', 'Carine',
  'Junior', 'Blaise', 'Chantal', 'Serge', 'Nadège', 'Franck', 'Divine', 'Arsène', 'Sonia', 'Hervé',
  'Estelle', 'Boris', 'Vanessa', 'Cyrille', 'Line', 'Armand', 'Flore', 'Régis', 'Judith', 'Thierry',
  'Rosine', 'Patrick', 'Aurélie', 'Landry', 'Bernadette', 'Cédric', 'Solange', 'Éric', 'Christelle', 'Alain',
] as const;

export const CM_LAST_NAMES = [
  'Mbarga', 'Fotso', 'Kamga', 'Talla', 'Ateba', 'Mballa', 'Onana', 'Essomba', 'Nkeng', 'Tchoua',
  'Mvondo', 'Ngono', 'Fouda', 'Njoya', 'Assam', 'Eyenga', 'Manga', 'Owona', 'Abega', 'Zambo',
  'Bilé', 'Djoumessi', 'Ekwalla', 'Fokou', 'Guimatsia', 'Hamadou', 'Ikomo', 'Kenfack', 'Lekene', 'Moukouri',
] as const;

export const DOUALA_QUARTIERS = ['Akwa', 'Bonabéri', 'Bonanjo', 'Bépanda', 'Deido', 'Ndogbong', 'Makepe', 'New-Bell'] as const;
export const YAOUNDE_QUARTIERS = ['Bastos', 'Mvog-Mbi', 'Essos', 'Mendong', 'Nlongkak', 'Biyem-Assi', 'Ngousso', 'Tsinga'] as const;

export function fullName(rng: () => number): { nom: string; prenom: string } {
  return { prenom: pick(rng, CM_FIRST_NAMES), nom: pick(rng, CM_LAST_NAMES) };
}

/** Always produces a valid `+237[26]\d{8}` number matching the E.164 validator. */
export function randomPhone(rng: () => number): string {
  const leading = pick(rng, ['6', '2'] as const);
  const digits = Array.from({ length: 8 }, () => randomInt(rng, 0, 9)).join('');
  return `+237${leading}${digits}`;
}
