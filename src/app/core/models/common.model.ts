/** Shared envelope types used across the mock/API boundary (§9.1). */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  id?: string;
  libelle?: string;
  point: GeoPoint;
  ville: string;
  quartier: string;
  repere: string;
  adresse_texte?: string;
  contact_nom: string;
  contact_telephone: string;
  instructions?: string;
  zone_id?: string;
}

/** RFC 9457 problem+json, enriched with the LVB application code (§9.1.1). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
  request_id: string;
  errors?: { field: string; message: string; code: string }[];
}

/** Cursor pagination — the shape every admin list endpoint actually uses (no total count, no page numbers). */
export interface CursorPage<T> {
  items: T[];
  next_cursor: number | null;
}

export interface ListQuery {
  page?: number;
  page_size?: number;
  sort?: string;
  sort_dir?: 'asc' | 'desc';
  search?: string;
  [key: string]: unknown;
}

export interface AuditFields {
  cree_le: string;
  modifie_le?: string;
  cree_par?: string;
  modifie_par?: string;
}

/** Discriminated result wrapper so components never guess about failure shape. */
export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProblemDetails };
