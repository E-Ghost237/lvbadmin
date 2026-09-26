/**
 * Top-down vehicle icons for the live map. Every icon points UP (heading 0°) and is rotated by the
 * map layer to the direction of travel. A lighter "highlight" layer and a soft drop shadow (set in
 * CSS) give a light 3D feel without any image assets.
 */
export type UnitKind = 'moto' | 'velo' | 'voiture' | 'camion' | 'tricycle' | 'pieton' | 'inconnu';

export const UNIT_KIND_LABEL: Record<UnitKind, string> = {
  moto: 'Moto', velo: 'Vélo', voiture: 'Voiture', camion: 'Camion / camionnette', tricycle: 'Tricycle', pieton: 'À pied', inconnu: 'Livreur',
};

/** Backend `vehicules.type` (livreurs) and rental vehicle types → icon. */
export function unitKindFor(type: string | null | undefined): UnitKind {
  const t = (type ?? '').toUpperCase();
  if (t.includes('MOTO')) return 'moto';
  if (t.includes('VELO')) return 'velo';
  if (t.includes('TRICYCLE')) return 'tricycle';
  if (t.includes('PIETON')) return 'pieton';
  if (t.includes('CAMION') || t.includes('POIDS') || t.includes('FOURGON') || t.includes('UTILITAIRE') || t.includes('BENNE') || t.includes('PLATEAU')) return 'camion';
  if (t.includes('VOITURE') || t.includes('BERLINE') || t.includes('AUTO')) return 'voiture';
  return 'inconnu';
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

/** `color` is the status colour (body); the highlight is derived from it. */
export function unitSvg(kind: UnitKind, color: string): string {
  const hi = shade(color, 55);
  const lo = shade(color, -45);
  const tyre = '#1f2937';
  const glass = '#cfe8ff';
  const body = (inner: string) => `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">${inner}</svg>`;
  switch (kind) {
    case 'moto':
      return body(`
        <rect x="21" y="3" width="6" height="13" rx="3" fill="${tyre}"/>
        <rect x="21" y="32" width="6" height="14" rx="3" fill="${tyre}"/>
        <rect x="8" y="14" width="32" height="3.5" rx="1.75" fill="${lo}"/>
        <rect x="17" y="15" width="14" height="22" rx="7" fill="${color}"/>
        <rect x="19" y="17" width="10" height="9" rx="4.5" fill="${hi}" opacity=".85"/>
        <circle cx="24" cy="27" r="6" fill="#fbbf77"/><circle cx="24" cy="27" r="6" fill="none" stroke="${lo}" stroke-width="1.5"/>
        <circle cx="24" cy="25.5" r="3.2" fill="#374151"/>`);
    case 'velo':
      return body(`
        <rect x="22.5" y="2" width="3" height="15" rx="1.5" fill="${tyre}"/>
        <rect x="22.5" y="31" width="3" height="15" rx="1.5" fill="${tyre}"/>
        <rect x="11" y="13" width="26" height="2.6" rx="1.3" fill="${lo}"/>
        <rect x="22.4" y="13" width="3.2" height="22" rx="1.6" fill="${color}"/>
        <circle cx="24" cy="26" r="5.2" fill="#fbbf77"/><circle cx="24" cy="26" r="5.2" fill="none" stroke="${lo}" stroke-width="1.4"/>
        <circle cx="24" cy="24.6" r="2.8" fill="#374151"/>`);
    case 'tricycle':
      return body(`
        <rect x="21" y="2" width="6" height="11" rx="3" fill="${tyre}"/>
        <rect x="8" y="13" width="32" height="3" rx="1.5" fill="${lo}"/>
        <rect x="15" y="14" width="18" height="10" rx="5" fill="${color}"/>
        <rect x="9" y="26" width="30" height="19" rx="3" fill="${hi}" stroke="${lo}" stroke-width="1.5"/>
        <rect x="6" y="30" width="4" height="12" rx="2" fill="${tyre}"/><rect x="38" y="30" width="4" height="12" rx="2" fill="${tyre}"/>
        <circle cx="24" cy="19" r="4.5" fill="#fbbf77"/><circle cx="24" cy="18" r="2.6" fill="#374151"/>`);
    case 'voiture':
      return body(`
        <rect x="9" y="8" width="5" height="9" rx="2" fill="${tyre}"/><rect x="34" y="8" width="5" height="9" rx="2" fill="${tyre}"/>
        <rect x="9" y="31" width="5" height="9" rx="2" fill="${tyre}"/><rect x="34" y="31" width="5" height="9" rx="2" fill="${tyre}"/>
        <rect x="12" y="3" width="24" height="42" rx="10" fill="${color}"/>
        <rect x="14" y="5" width="20" height="13" rx="7" fill="${hi}" opacity=".7"/>
        <rect x="15" y="14" width="18" height="8" rx="3" fill="${glass}"/>
        <rect x="16" y="23" width="16" height="12" rx="4" fill="${lo}" opacity=".55"/>
        <rect x="15" y="36" width="18" height="5" rx="2.5" fill="${glass}"/>`);
    case 'camion':
      return body(`
        <rect x="8" y="4" width="5" height="8" rx="2" fill="${tyre}"/><rect x="35" y="4" width="5" height="8" rx="2" fill="${tyre}"/>
        <rect x="8" y="33" width="5" height="10" rx="2" fill="${tyre}"/><rect x="35" y="33" width="5" height="10" rx="2" fill="${tyre}"/>
        <rect x="12" y="2" width="24" height="14" rx="6" fill="${color}"/>
        <rect x="15" y="4" width="18" height="6" rx="3" fill="${glass}"/>
        <rect x="11" y="18" width="26" height="28" rx="3" fill="${hi}" stroke="${lo}" stroke-width="1.6"/>
        <rect x="15" y="22" width="18" height="20" rx="2" fill="${color}" opacity=".35"/>`);
    case 'pieton':
      return body(`
        <ellipse cx="24" cy="30" rx="13" ry="9" fill="${color}"/>
        <ellipse cx="24" cy="28" rx="9" ry="5" fill="${hi}" opacity=".8"/>
        <circle cx="24" cy="21" r="7" fill="#fbbf77"/><circle cx="24" cy="19.5" r="4" fill="#374151"/>`);
    default:
      return body(`
        <circle cx="24" cy="24" r="15" fill="${color}"/><circle cx="24" cy="21" r="8" fill="${hi}" opacity=".75"/>
        <path d="M24 9 32 27 24 23 16 27Z" fill="white" opacity=".95"/>`);
  }
}
