export type RatePlanMode = 'HORAIRE' | 'DEMI_JOURNEE' | 'JOURNALIER' | 'KILOMETRIQUE' | 'PAR_TRAJET' | 'MIXTE';
export const RATE_PLAN_MODE_VALUES: RatePlanMode[] = [
  'HORAIRE', 'DEMI_JOURNEE', 'JOURNALIER', 'KILOMETRIQUE', 'PAR_TRAJET', 'MIXTE',
];

export type RoundingMode = 'UP' | 'DOWN' | 'NEAREST';

/**
 * `RentalResourceRequest` (resource=rate-plans) — every `*_amount` field is
 * an integer XAF amount (0–1e9), every `*_minutes` field 1–525600,
 * `tax_bps` 0–10000, `zone_amounts` up to 100 integer amounts.
 */
export interface RatePlanParameters {
  base_amount?: number;
  duration_amount?: number;
  kilometer_amount?: number;
  trip_amount?: number;
  minimum_amount?: number;
  driver_amount?: number;
  handling_amount?: number;
  fuel_amount?: number;
  toll_amount?: number;
  insurance_amount?: number;
  waiting_hour_amount?: number;
  discount_amount?: number;
  tax_bps?: number;
  minimum_minutes?: number;
  maximum_minutes?: number;
  increment_minutes?: number;
  unit_minutes?: number;
  rounding?: RoundingMode;
  zone_amounts?: number[];
}

/**
 * `/v1/partner/rate-plans*` (Rental module). `active` is NOT mutually
 * exclusive across a partner's rate plans — `activate()` on the backend is
 * just `save('rate-plans', ..., {active: true})`, nothing deactivates
 * siblings. Every edit bumps `version` and snapshots the previous version
 * server-side (`rental_rate_plan_versions`).
 */
export interface RatePlan {
  id?: number;
  uuid: string;
  partner_id?: number;
  name: string;
  mode: RatePlanMode;
  version: number;
  active: boolean;
  parameters: RatePlanParameters;
  created_at: string;
  updated_at: string;
}

export interface SaveRatePlanRequest {
  name?: string;
  mode?: RatePlanMode;
  active?: boolean;
  parameters?: RatePlanParameters;
}
