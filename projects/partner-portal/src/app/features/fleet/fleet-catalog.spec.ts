import { describe, expect, it } from 'vitest';
import { LICENSE_CATEGORIES, profileFor } from './fleet-catalog';

describe('vehicle type profiles', () => {
  it('asks a tanker for litres and no dimensions', () => {
    const p = profileFor('CAMION_CITERNE');
    expect(p.volume).toBe('L');
    expect(p.dimensions).toBe(false);
    expect(p.permit).toBe('C');
  });
  it('gives a crane no cargo volume and a lifting-capacity label', () => {
    const p = profileFor('CAMION_GRUE');
    expect(p.volume).toBeNull();
    expect(p.capacityLabel).toContain('levage');
  });
  it('suggests category B for vans and C for heavy trucks', () => {
    expect(profileFor('CAMION_FOURGON').permit).toBe('B');
    expect(profileFor('CAMION_DEMENAGEMENT').permit).toBe('C');
    expect(profileFor('CAMION_DEMENAGEMENT').dimensions).toBe(true);
  });
  it('only ever suggests a category that exists in the dropdown', () => {
    const known = new Set(LICENSE_CATEGORIES.map((c) => c.value));
    for (const code of ['CAMION_BENNE', 'CAMION_FOURGON', 'CAMION_GRUE', 'CAMION_CITERNE', 'CAMION_FRIGORIFIQUE', 'AUTRE']) {
      const permit = profileFor(code).permit;
      expect(permit === '' || known.has(permit)).toBe(true);
    }
  });
});
