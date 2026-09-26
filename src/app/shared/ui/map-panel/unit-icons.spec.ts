import { unitKindFor, unitSvg } from './unit-icons';

describe('unit icons', () => {
  it('maps backend vehicle types to an icon kind', () => {
    expect(unitKindFor('MOTO')).toBe('moto');
    expect(unitKindFor('VELO')).toBe('velo');
    expect(unitKindFor('VOITURE')).toBe('voiture');
    expect(unitKindFor('CAMIONNETTE')).toBe('camion');
    expect(unitKindFor('CAMION_BENNE')).toBe('camion');
    expect(unitKindFor('TRICYCLE')).toBe('tricycle');
    expect(unitKindFor('PIETON')).toBe('pieton');
  });
  it('falls back to a neutral icon for unknown or missing types', () => {
    expect(unitKindFor(null)).toBe('inconnu');
    expect(unitKindFor('TROTTINETTE')).toBe('inconnu');
  });
  it('renders an SVG tinted with the status colour for every kind', () => {
    for (const k of ['moto', 'velo', 'voiture', 'camion', 'tricycle', 'pieton', 'inconnu'] as const) {
      const svg = unitSvg(k, '#2E9E44');
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('#2E9E44');
    }
  });
});
