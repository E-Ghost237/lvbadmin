import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons';

export interface NavItem {
  label: string;
  labelKey: string;
  path: string;
  icon: IconDefinition;
}

/**
 * Grows one entry per stage as each partner-facing section lands (mirrors
 * how the admin app's own nav grew — see that app's nav-data.ts). No
 * client-side permission gating here either: the backend never exposes the
 * caller's partner role to the client, so every authenticated partner
 * member sees the full nav and the server's real 403 (`ERR-4038`) is the
 * only access-control signal — see ForbiddenStateComponent. In practice
 * most roles (OPERATEUR_PARTENAIRE, LECTEUR_PARTENAIRE) can't reach most of
 * these sections; that's enforced server-side per PartnerRole::allows().
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', labelKey: 'partner.nav.dashboard', path: '/dashboard', icon: faGaugeHigh },
];
