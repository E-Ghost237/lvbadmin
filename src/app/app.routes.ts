import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { ShellComponent } from './shared/layout/shell/shell.component';

/**
 * No route carries a permission guard: the backend never exposes the
 * caller's role/permission list to the client (see AuthService docblock),
 * so every authenticated user reaches every route and the server's real
 * 403 responses — surfaced via ForbiddenStateComponent — are the only
 * access-control signal in play.
 *
 * Features not yet wired to a real backend endpoint point at
 * PlaceholderPageComponent rather than dead mock UI; each is swapped in as
 * it's rebuilt against the actual API.
 */
export const routes: Routes = [
  ...AUTH_ROUTES,
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'teleconseiller',
        loadChildren: () => import('./features/teleconseiller/teleconseiller.routes').then((m) => m.TELECONSEILLER_ROUTES),
      },
      {
        path: 'orders',
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'drivers',
        loadChildren: () => import('./features/drivers/drivers.routes').then((m) => m.DRIVERS_ROUTES),
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'pricing',
        loadChildren: () => import('./features/pricing/pricing.routes').then((m) => m.PRICING_ROUTES),
      },
      {
        path: 'partners',
        loadChildren: () => import('./features/partners/partners.routes').then((m) => m.PARTNERS_ROUTES),
      },
      {
        path: 'marketplace',
        loadChildren: () => import('./features/marketplace/marketplace.routes').then((m) => m.MARKETPLACE_ROUTES),
      },
      {
        path: 'wallet',
        loadChildren: () => import('./features/wallet/wallet.routes').then((m) => m.WALLET_ROUTES),
      },
      {
        path: 'claims',
        loadChildren: () => import('./features/claims/claims.routes').then((m) => m.CLAIMS_ROUTES),
      },
      {
        path: 'finance',
        loadChildren: () => import('./features/finance/finance.routes').then((m) => m.FINANCE_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'audit',
        loadChildren: () => import('./features/audit/audit.routes').then((m) => m.AUDIT_ROUTES),
      },
      {
        path: 'account',
        loadChildren: () => import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: '**',
        loadComponent: () => import('./features/errors/status-page.component').then((m) => m.StatusPageComponent),
      },
    ],
  },
];
