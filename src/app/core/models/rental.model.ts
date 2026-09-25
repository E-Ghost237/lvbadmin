export type VehicleStatus = 'BROUILLON' | 'ACTIF' | 'INDISPONIBLE' | 'EN_MAINTENANCE' | 'SUSPENDU' | 'ARCHIVE';
export const VEHICLE_STATUS_VALUES: VehicleStatus[] = [
  'BROUILLON', 'ACTIF', 'INDISPONIBLE', 'EN_MAINTENANCE', 'SUSPENDU', 'ARCHIVE',
];

export type DriverStatus = 'EN_ATTENTE_VALIDATION' | 'ACTIF' | 'INDISPONIBLE' | 'EN_CONGE' | 'SUSPENDU' | 'ARCHIVE';
export const DRIVER_STATUS_VALUES: DriverStatus[] = [
  'EN_ATTENTE_VALIDATION', 'ACTIF', 'INDISPONIBLE', 'EN_CONGE', 'SUSPENDU', 'ARCHIVE',
];

/**
 * Admin compliance view of a partner's vehicle — GET/PATCH
 * `/v1/admin/marketplace/vehicles/{uuid}` (both require `partner_id`, the
 * marketplace-internal integer id — see RentalService docblock for why).
 * `compliance_suspended` is read-only from this API (not a field the admin
 * PATCH body accepts) — the actionable lever is `status`.
 */
export interface Vehicle {
  id?: number;
  uuid: string;
  partner_id?: number;
  registration: string;
  brand: string;
  model: string;
  year: number | null;
  vehicle_type: string;
  category: string;
  license_category: string;
  color: string | null;
  capacity_kg: number;
  volume_liters: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  seats?: number;
  fuel: string | null;
  transmission: string | null;
  mileage?: number;
  condition: string | null;
  status: VehicleStatus;
  media?: string[];
  compliance_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id?: number;
  uuid: string;
  partner_id?: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email?: string | null;
  account_linked?: boolean;
  phone: string;
  address: string | null;
  photo_url: string | null;
  license_categories: string[];
  license_expires_at: string;
  experience_years?: number;
  vehicle_types?: string[];
  status: DriverStatus;
  compliance_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface RentalVehicleType {
  id?: number;
  code: string;
  label: string;
  active: boolean;
}
