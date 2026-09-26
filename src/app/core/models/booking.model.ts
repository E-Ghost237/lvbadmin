export type BookingStatus =
  | 'EN_ATTENTE_PAIEMENT' | 'EN_ATTENTE_CONFIRMATION' | 'CONFIRMEE' | 'EN_ATTENTE_AFFECTATION'
  | 'PLANIFIEE' | 'EN_ROUTE' | 'PRESTATION_EN_COURS' | 'TERMINEE' | 'ANNULEE' | 'REJETEE'
  | 'EXPIREE' | 'ECHEC_PAIEMENT';

export const BOOKING_STATUS_VALUES: BookingStatus[] = [
  'EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_CONFIRMATION', 'CONFIRMEE', 'EN_ATTENTE_AFFECTATION',
  'PLANIFIEE', 'EN_ROUTE', 'PRESTATION_EN_COURS', 'TERMINEE', 'ANNULEE', 'REJETEE',
  'EXPIREE', 'ECHEC_PAIEMENT',
];

/** RGRNT030BookingTransition::TRANSITIONS — terminal states, no further transition possible. */
export const BOOKING_TERMINAL_STATUSES: BookingStatus[] = ['TERMINEE', 'ANNULEE', 'REJETEE', 'EXPIREE', 'ECHEC_PAIEMENT'];

export type BookingPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export type BookingDisputeStatus = 'OPEN' | 'RESOLVED';

export type BookingAction = 'cancel' | 'incident' | 'accept' | 'reject' | 'assign-driver' | 'resolve-dispute';

export type DisputeOutcome = 'release' | 'refund';

export interface BookingHistoryEntry {
  uuid: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  reason: string | null;
  position: { latitude: number; longitude: number } | null;
  created_at: string;
}

/**
 * Admin oversight view of a reservation — GET/POST
 * `/v1/admin/marketplace/bookings` (RGRNT030BookingTransition,
 * LVB-CDC-MKT-RENT-2026-V1.0). Unlike Offer/Vehicle/Driver, this resource
 * never exposes `partner_id`/`client_id`/`driver_id` at all — only
 * `vehicle_uuid`/`offer_uuid` (frozen at quote time from the booking's
 * snapshot, not a live join) and a `driver_assigned` boolean. There is no
 * endpoint to resolve a partner/client/driver display name from a booking.
 * `history` is only populated on the detail call (GET .../{uuid}).
 */
export interface Booking {
  uuid: string;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  payment_uuid: string | null;
  offer_uuid: string | null;
  vehicle_uuid: string | null;
  with_driver: boolean;
  driver_assigned: boolean;
  starts_at: string;
  ends_at: string;
  hold_expires_at: string;
  currency: 'XAF';
  total_amount: number;
  commission_amount: number;
  refund_amount: number;
  refunded_amount: number;
  dispute_status: BookingDisputeStatus | null;
  completed_at: string | null;
  pricing: Record<string, unknown>;
  cancellation_policy: Record<string, unknown>;
  history?: BookingHistoryEntry[];
  /** Detail call only — resolved by the backend so screens never have to show raw uuids. */
  vehicle?: { uuid: string; registration: string; brand?: string; model?: string; vehicle_type?: string; color?: string } | null;
  driver?: { uuid: string; first_name: string; last_name: string; phone: string | null } | null;
  pickup?: { lat: number; lng: number; address?: string } | null;
  destination?: { lat: number; lng: number; address?: string } | null;
  rating?: { score: number; comment: string | null; created_at: string } | null;
}
