export type MarketplaceOfferStatus = 'BROUILLON' | 'EN_REVUE' | 'PUBLIEE' | 'SUSPENDUE' | 'ARCHIVEE' | 'REJETEE';

export const MARKETPLACE_OFFER_STATUS_VALUES: MarketplaceOfferStatus[] = [
  'BROUILLON', 'EN_REVUE', 'PUBLIEE', 'SUSPENDUE', 'ARCHIVEE', 'REJETEE',
];

/**
 * RG (OfferPublication::TRANSITIONS, LVB-CDC-MKT-RENT-2026-V1.0 §7.3) — the
 * admin actor is never subject to the "PUBLIEE/REJETEE is admin-only" gate
 * (that gate only restricts the *partner* actor), so every target listed
 * here for a given current status is a legal admin action.
 */
export const MARKETPLACE_OFFER_TRANSITIONS: Record<MarketplaceOfferStatus, MarketplaceOfferStatus[]> = {
  BROUILLON: ['EN_REVUE', 'ARCHIVEE'],
  EN_REVUE: ['PUBLIEE', 'REJETEE', 'BROUILLON', 'ARCHIVEE'],
  PUBLIEE: ['SUSPENDUE', 'EN_REVUE', 'ARCHIVEE'],
  SUSPENDUE: ['EN_REVUE', 'PUBLIEE', 'ARCHIVEE'],
  REJETEE: ['BROUILLON', 'ARCHIVEE'],
  ARCHIVEE: [],
};

export interface MarketplaceCategory {
  uuid: string;
  name: string;
  slug: string;
  active: boolean;
}

/** `booking_mode` has both a French and an English/legacy spelling in the contract — both are live values. */
export type OfferBookingMode = 'AUTO_CONFIRM' | 'PARTNER_CONFIRM' | 'AUTOMATIQUE' | 'VALIDATION_PARTENAIRE';

/**
 * Admin moderation view of an offer — GET /v1/admin/marketplace/offers,
 * POST .../{uuid}/status. Note `partner_id`/`category_id` are bare integers
 * in this contract (no embedded display name) — the moderation screen
 * resolves `category_id` locally against the categories list, and falls
 * back to showing the raw partner id since there is no batch partner
 * lookup by integer id available from the admin Partner API (which only
 * looks up by uuid).
 */
export interface MarketplaceOffer {
  id: number;
  uuid: string;
  partner_id: number;
  category_id: number;
  service_type?: string;
  title: string;
  description: string;
  city: string;
  service_zones: string[];
  media?: string[];
  conditions?: string | null;
  vehicle_uuid?: string | null;
  vehicle_category?: string | null;
  rate_plan_uuid: string;
  booking_mode?: OfferBookingMode;
  with_driver?: boolean;
  indicative_amount?: number;
  status: MarketplaceOfferStatus;
  version: number;
  rating?: number | string | null;
  rating_count?: number;
  created_at: string;
  updated_at: string;
}
