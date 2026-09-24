import { Routes } from '@angular/router';
import { authGuard } from '@lvb/auth/auth.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { partnerGuard } from './core/partner.guard';
import { ShellComponent } from './shared/layout/shell/shell.component';

/**
 * Sections are gated by `partnerGuard` using the caller's partner status and
 * role (see PartnerContextService — role is derived from /me + /partner/users
 * since the backend has no "my role" endpoint). The guard is only a UX
 * shortcut: the server's 403 (`ERR-4038`) remains the real access control and
 * is still surfaced via ForbiddenStateComponent if the two ever disagree.
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
        canActivate: [partnerGuard('dashboard.read')],
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'profile',
        canActivate: [partnerGuard('profile.read')],
        loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      {
        path: 'fleet',
        canActivate: [partnerGuard('fleet.vehicle.manage')],
        loadChildren: () => import('./features/fleet/fleet.routes').then((m) => m.FLEET_ROUTES),
      },
      {
        path: 'marketplace',
        canActivate: [partnerGuard('marketplace.offer.read')],
        loadChildren: () => import('./features/marketplace/marketplace.routes').then((m) => m.MARKETPLACE_ROUTES),
      },
      {
        path: 'bookings',
        canActivate: [partnerGuard('booking.read')],
        loadChildren: () => import('./features/bookings/bookings.routes').then((m) => m.BOOKINGS_ROUTES),
      },
      {
        path: 'wallet',
        canActivate: [partnerGuard('wallet.read')],
        loadChildren: () => import('./features/wallet/wallet.routes').then((m) => m.WALLET_ROUTES),
      },
      {
        path: 'orders',
        canActivate: [partnerGuard('orders.read')],
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'onboarding',
        loadComponent: () => import('./features/onboarding/onboarding-page.component').then((m) => m.OnboardingPageComponent),
        title: 'Mon dossier — Portail Partenaire',
      },
      {
        path: 'accept-invitation',
        loadComponent: () => import('./features/invitation/accept-invitation.component').then((m) => m.AcceptInvitationComponent),
        title: 'Rejoindre une équipe — Portail Partenaire',
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
