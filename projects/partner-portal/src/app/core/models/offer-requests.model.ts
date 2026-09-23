import { OfferBookingMode } from '@lvb/models/marketplace.model';

/** Required as a whole object whenever sent — `description` is always required within it. */
export interface OfferCancellationPolicy {
  free_cancellation_hours?: number;
  fee_basis_points?: number;
  fixed_fee_xaf?: number;
  description: string;
}

/**
 * `POST/PATCH /v1/partner/offers*` (`OfferRequest`). Unlike the `GET`
 * response (`MarketplaceOffer`, reused as-is from `@lvb/models/marketplace.model`
 * since the same `decode()` builds it for admin and partner alike), the
 * request takes `category_uuid`, not `category_id` — the backend resolves
 * it to the internal id before persisting (`MarketplaceService::saveOffer()`).
 * Editing a `PUBLIEE` offer resets it to `EN_REVUE` automatically
 * server-side — every material edit passes moderation again.
 */
export interface SaveOfferRequest {
  category_uuid?: string;
  service_type?: string;
  title?: string;
  description?: string;
  city?: string;
  service_zones?: string[];
  media?: string[];
  conditions?: string | null;
  vehicle_uuid?: string | null;
  vehicle_category?: string | null;
  rate_plan_uuid?: string;
  booking_mode?: OfferBookingMode;
  with_driver?: boolean;
  indicative_amount?: number;
  cancellation_policy?: OfferCancellationPolicy;
}
