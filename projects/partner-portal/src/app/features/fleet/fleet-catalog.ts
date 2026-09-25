import { SelectOption } from '@lvb/ui/select/select.component';

/**
 * Cameroonian driving-licence categories. The SAME values are used for a vehicle's
 * required category and a driver's held categories, because the backend checks
 * eligibility by comparing them.
 */
export const LICENSE_CATEGORIES: { value: string; label: string; hint: string }[] = [
  { value: 'A1', label: 'A1', hint: 'Motos légères (≤ 125 cm³)' },
  { value: 'A', label: 'A', hint: 'Motos' },
  { value: 'B', label: 'B', hint: 'Voitures et utilitaires ≤ 3,5 t' },
  { value: 'C', label: 'C', hint: 'Poids lourds > 3,5 t' },
  { value: 'D', label: 'D', hint: 'Transport en commun' },
  { value: 'E', label: 'E', hint: 'Remorques et ensembles articulés' },
  { value: 'F', label: 'F', hint: 'Véhicules aménagés' },
];

export const LICENSE_SELECT_OPTIONS: SelectOption[] = LICENSE_CATEGORIES.map((c) => ({ value: c.value, label: `${c.label} — ${c.hint}` }));

export const FUEL_OPTIONS: SelectOption[] = ['Diesel', 'Essence', 'Électrique', 'Hybride', 'GPL'].map((v) => ({ value: v, label: v }));
export const TRANSMISSION_OPTIONS: SelectOption[] = ['Manuelle', 'Automatique'].map((v) => ({ value: v, label: v }));

/** What the form asks for depends on the kind of vehicle chosen. */
export interface TypeProfile {
  capacityLabel: string;
  /** Unit of the useful volume the partner types, or null when the type has no cargo volume. */
  volume: 'm3' | 'L' | null;
  volumeLabel: string;
  /** Ask for length / width / height. */
  dimensions: boolean;
  /** Suggested licence category (still editable). */
  permit: string;
}

const CARGO: TypeProfile = { capacityLabel: 'Charge utile (kg)', volume: 'm3', volumeLabel: 'Volume utile (m³)', dimensions: true, permit: 'C' };

export function profileFor(typeCode: string): TypeProfile {
  const c = (typeCode || '').toUpperCase();
  if (c.includes('CITERNE')) return { capacityLabel: 'Charge utile (kg)', volume: 'L', volumeLabel: 'Capacité de la cuve (litres)', dimensions: false, permit: 'C' };
  if (c.includes('BENNE')) return { ...CARGO, volumeLabel: 'Volume de la benne (m³)', dimensions: false };
  if (c.includes('GRUE')) return { capacityLabel: 'Capacité de levage (kg)', volume: null, volumeLabel: '', dimensions: false, permit: 'C' };
  if (c.includes('PLATEAU')) return { ...CARGO, volume: null, volumeLabel: '' };
  if (c.includes('FOURGON') || c.includes('LEGER') || c.includes('UTILITAIRE')) return { ...CARGO, permit: 'B' };
  if (c.includes('AUTRE') || !c) return { ...CARGO, dimensions: false, permit: '' };
  return CARGO; // déménagement, frigorifique, marchandises, poids lourd…
}
