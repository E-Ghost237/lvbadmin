export interface NavItem {
  label: string;
  labelKey: string;
  path: string;
  icon: string;
}

/**
 * Icons are inline stroke paths (24x24 viewBox) — zero icon-font dependency.
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
  { label: 'Supervision', labelKey: 'nav.dashboard', path: '/dashboard', icon: 'M3 3v18h18M7 15l4-4 4 4 5-6' },
  { label: 'Commandes', labelKey: 'nav.orders', path: '/orders', icon: 'M20 7h-3.2l-1.6-3.2A2 2 0 0 0 13.4 3h-2.8a2 2 0 0 0-1.8 1.1L7.2 7H4a1 1 0 0 0 0 2h1l1 10.2A2 2 0 0 0 8 21h8a2 2 0 0 0 2-1.8L19 9h1a1 1 0 0 0 0-2ZM10.6 5h2.8l1 2h-4.8ZM9.5 17v-6M12 17v-6M14.5 17v-6' },
  { label: 'Console téléconseiller', labelKey: 'nav.teleconseiller', path: '/teleconseiller', icon: 'M3 5a2 2 0 0 1 2-2h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5Z' },
  { label: 'Livreurs', labelKey: 'nav.drivers', path: '/drivers', icon: 'M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM5 17H3v-4l2-5h9l4 4h2v5h-2M9 8v4h6' },
  { label: 'Utilisateurs & rôles', labelKey: 'nav.users', path: '/users', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 3a4 4 0 0 0 0-8' },
  { label: 'Tarification & zones', labelKey: 'nav.pricing', path: '/pricing', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6' },
  { label: 'Finance', labelKey: 'nav.finance', path: '/finance', icon: 'M3 6h18v12H3zM3 10h18M7 15h4' },
  { label: 'Réclamations & litiges', labelKey: 'nav.claims', path: '/claims', icon: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' },
  { label: 'Rapports & KPI', labelKey: 'nav.reports', path: '/reports', icon: 'M3 3v18h18M18 17V9M13 17V5M8 17v-4' },
  { label: 'Paramètres', labelKey: 'nav.settings', path: '/settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9-3a9 9 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L16 2h-4l-.3 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6A9 9 0 0 0 3 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1c.6.6 1.4 1 2.2 1.3L8 22h4l.3-2.4c.8-.3 1.6-.7 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z' },
  { label: 'Journal d’audit', labelKey: 'nav.audit', path: '/audit', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
];
