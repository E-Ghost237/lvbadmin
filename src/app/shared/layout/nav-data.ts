import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxOpen, faChartColumn, faClipboardList, faGaugeHigh, faGear, faHandshake, faHeadset, faMotorcycle,
  faSackDollar, faScaleBalanced, faTags, faUsersGear,
} from '@fortawesome/free-solid-svg-icons';

export interface NavItem {
  label: string;
  labelKey: string;
  path: string;
  icon: IconDefinition;
}

/**
 * Icons are FontAwesome (`@fortawesome/free-solid-svg-icons`), one chosen
 * per page's real subject rather than a generic bullet/dot set.
 *
 * No client-side permission gating: the backend never returns the caller's
 * role or permission list (no `/v1/profile` GET), so every authenticated
 * user sees the full nav and the server's real 403 responses are the only
 * access-control signal the UI reacts to (see ForbiddenStateComponent).
 *
 * "Finance" and "Commandes" used to be omitted here because neither had a
 * backing endpoint — admin order list/manual-assign and
 * withdrawals/reconciliation now do (`GET /v1/admin/orders`,
 * `POST /v1/admin/dispatch/assign`, `/v1/admin/withdrawals`,
 * `/v1/admin/reconciliation`), so both are wired to real pages now.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Supervision', labelKey: 'nav.dashboard', path: '/dashboard', icon: faGaugeHigh },
  { label: 'Commandes', labelKey: 'nav.orders', path: '/orders', icon: faBoxOpen },
  { label: 'Console téléconseiller', labelKey: 'nav.teleconseiller', path: '/teleconseiller', icon: faHeadset },
  { label: 'Livreurs', labelKey: 'nav.drivers', path: '/drivers', icon: faMotorcycle },
  { label: 'Utilisateurs & rôles', labelKey: 'nav.users', path: '/users', icon: faUsersGear },
  { label: 'Tarification & zones', labelKey: 'nav.pricing', path: '/pricing', icon: faTags },
  { label: 'Partenaires', labelKey: 'nav.partners', path: '/partners', icon: faHandshake },
  { label: 'Finance', labelKey: 'nav.finance', path: '/finance', icon: faSackDollar },
  { label: 'Réclamations & litiges', labelKey: 'nav.claims', path: '/claims', icon: faScaleBalanced },
  { label: 'Rapports & KPI', labelKey: 'nav.reports', path: '/reports', icon: faChartColumn },
  { label: 'Paramètres', labelKey: 'nav.settings', path: '/settings', icon: faGear },
  { label: 'Journal d’audit', labelKey: 'nav.audit', path: '/audit', icon: faClipboardList },
];
