/** Rental fleet operations — calendar, unavailability, documents, operating hours, authorisations, simulation. */

export type FleetResource = 'vehicles' | 'drivers';
export type UnavailabilityKind = 'MANUEL' | 'MAINTENANCE' | 'CONGE';
export type RentalDocumentKind = 'ASSURANCE' | 'VISITE_TECHNIQUE' | 'CARTE_GRISE' | 'PERMIS' | 'JUSTIFICATIF';

export interface BlockRequest {
  vehicle_uuid?: string;
  driver_uuid?: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  kind?: UnavailabilityKind;
}

export interface UnavailabilityCreated { uuid: string; starts_at: string; ends_at: string }

export interface UnavailabilityRow {
  uuid: string;
  vehicle_uuid: string | null;
  driver_uuid: string | null;
  starts_at: string;
  ends_at: string;
  reason: string;
  kind: UnavailabilityKind;
}

export interface CalendarHold {
  uuid: string;
  vehicle_uuid: string | null;
  driver_uuid: string | null;
  starts_at: string;
  ends_at: string;
  status: 'HOLD' | 'RESERVED';
  expires_at: string | null;
}

export interface FleetCalendar {
  unavailability: UnavailabilityRow[];
  bookings: { items: CalendarHold[] };
}

export interface RentalDocument {
  uuid: string;
  kind: RentalDocumentKind | 'PHOTO';
  mime_type: string;
  bytes: number;
  created_at: string;
}

/** Signed, short-lived (15 min) link — never store it. */
export interface RentalDocumentLink { uuid: string; kind: string; url: string; expires_at: string }

export interface WeeklyHours { weekday: number; opens_at: string; closes_at: string }
export interface HoursException { date: string; intervals: { opens_at: string; closes_at: string }[] }

export interface OperatingHours {
  resource_uuid: string;
  configured: boolean;
  timezone: string;
  weekly_hours: WeeklyHours[];
  exceptions: HoursException[];
  version?: number;
}

export interface SaveOperatingHoursRequest {
  timezone: string;
  weekly_hours: WeeklyHours[];
  exceptions?: HoursException[];
}

export interface AuthorizeDriverRequest {
  vehicle_uuid?: string;
  vehicle_category?: string;
  starts_at: string;
  ends_at?: string | null;
}

export interface SimulateRequest {
  starts_at: string;
  ends_at: string;
  distance_meters?: number;
  with_driver?: boolean;
  options?: ('handling' | 'fuel' | 'toll' | 'insurance')[];
  zone?: string;
  waiting_minutes?: number;
}

export interface SimulationResult {
  currency: 'XAF';
  billed_minutes?: number;
  detail_calcul: Record<string, number>;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  commission_amount: number;
  partner_amount: number;
}
