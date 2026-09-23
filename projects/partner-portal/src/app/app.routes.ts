import { Routes } from '@angular/router';
import { authGuard } from '@lvb/auth/auth.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { ShellComponent } from './shared/layout/shell/shell.component';

/**
 * Same no-client-side-permission-gating stance as the admin app (see that
 * app's app.routes.ts docblock): the backend never exposes a partner
 * member's role/permission list to the client, so every authenticated
 * partner user reaches every route here and the server's real 403
 * (`ERR-4038`) is the only access-control signal, surfaced via
 * ForbiddenStateComponent.
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
        path: 'profile',
        loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      {
        path: 'fleet',
        loadChildren: () => import('./features/fleet/fleet.routes').then((m) => m.FLEET_ROUTES),
      },
      {
        path: 'marketplace',
        loadChildren: () => import('./features/marketplace/marketplace.routes').then((m) => m.MARKETPLACE_ROUTES),
      },
      {
        path: 'bookings',
        loadChildren: () => import('./features/bookings/bookings.routes').then((m) => m.BOOKINGS_ROUTES),
      },
      {
        path: 'wallet',
        loadChildren: () => import('./features/wallet/wallet.routes').then((m) => m.WALLET_ROUTES),
      },
      {
        path: '**',
        loadComponent: () => import('./features/errors/status-page.component').then((m) => m.StatusPageComponent),
      },
    ],
  },
];
