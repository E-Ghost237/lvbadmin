import { DriverStatus, VehicleStatus } from '@lvb/models/rental.model';

/**
 * `POST/PATCH /v1/partner/vehicles*`. Every field optional (Laravel
 * `sometimes` on update; `store` requires a subset server-side — see
 * RentalResourceRequest). `registration` is normalized (uppercased,
 * non-alphanumerics stripped) server-side, not here.
 */
export interface SaveVehicleRequest {
  registration?: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicle_type?: string;
  category?: string;
  license_category?: string;
  color?: string;
  capacity_kg?: number;
  volume_liters?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  seats?: number;
  fuel?: string;
  transmission?: string;
  mileage?: number;
  condition?: string;
  status?: VehicleStatus;
}

/**
 * `POST/PATCH /v1/partner/drivers*`. `license_number` is write-only — the
 * backend encrypts it into `license_number_encrypted` and never returns it
 * (see `RentalService::safeRow()`), so it never appears on the `Driver`
 * read model. Editing `license_categories`/`license_expires_at`/
 * `license_number` on an existing driver resets `status` to
 * `EN_ATTENTE_VALIDATION` server-side automatically.
 */
export interface SaveDriverRequest {
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  phone?: string;
  address?: string;
  photo_url?: string;
  license_number?: string;
  license_categories?: string[];
  license_expires_at?: string;
  experience_years?: number;
  vehicle_types?: string[];
  status?: DriverStatus;
}
