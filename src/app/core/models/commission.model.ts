/**
 * A partner commission rule (PartnerLedger module, LVB-CDC-MKT-RENT-2026-V1.0,
 * RG-PWL-011) — GET/POST `/v1/admin/marketplace/commissions`. Rules are
 * append-only and immutable (a DB trigger blocks UPDATE/DELETE on
 * `partner_commission_rules`): correcting a rate means creating a new,
 * higher-`version` rule for the same scope, never editing an existing one.
 * `partner_uuid`/`category_uuid` being `null` means "applies to all
 * partners"/"applies to all categories" respectively — the most specific
 * non-expired rule wins at resolution time (partner+category > single-scope
 * > global), then highest version within that scope.
 */
export interface PartnerCommissionRule {
  uuid: string;
  partner_uuid: string | null;
  category_uuid: string | null;
  version: number;
  /** 0–10000, i.e. hundredths of a percent — divide by 100 for a display percentage. */
  basis_points: number;
  valid_from: string;
  valid_to: string | null;
  reason: string;
  created_at: string;
}

export interface CreateCommissionRuleRequest {
  partner_uuid?: string | null;
  category_uuid?: string | null;
  basis_points: number;
  valid_from: string;
  valid_to?: string | null;
  reason: string;
}
