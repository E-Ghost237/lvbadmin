import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { ShellComponent } from './shared/layout/shell/shell.component';

export const routes: Routes = [
  ...AUTH_ROUTES,
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard', canActivate: [permissionGuard('order.read')],
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'orders', canActivate: [permissionGuard('order.read')],
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'teleconseiller', canActivate: [permissionGuard('teleconseiller.order.create')],
        loadChildren: () => import('./features/teleconseiller/teleconseiller.routes').then((m) => m.TELECONSEILLER_ROUTES),
      },
      {
        path: 'drivers', canActivate: [permissionGuard('driver.read')],
        loadChildren: () => import('./features/drivers/drivers.routes').then((m) => m.DRIVERS_ROUTES),
      },
      {
        path: 'users', canActivate: [permissionGuard('user.read')],
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'pricing', canActivate: [permissionGuard(['tarif.read', 'zone.read'])],
        loadChildren: () => import('./features/pricing/pricing.routes').then((m) => m.PRICING_ROUTES),
      },
      {
        path: 'finance', canActivate: [permissionGuard(['finance.reconciliation.read', 'wallet.read'])],
        loadChildren: () => import('./features/finance/finance.routes').then((m) => m.FINANCE_ROUTES),
      },
      {
        path: 'claims', canActivate: [permissionGuard('claim.read')],
        loadChildren: () => import('./features/claims/claims.routes').then((m) => m.CLAIMS_ROUTES),
      },
      {
        path: 'reports', canActivate: [permissionGuard('report.read')],
        loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'settings', canActivate: [permissionGuard('settings.read')],
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'audit', canActivate: [permissionGuard('audit.read')],
        loadChildren: () => import('./features/audit/audit.routes').then((m) => m.AUDIT_ROUTES),
      },
      {
        path: 'account',
        loadChildren: () => import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: '403',
        loadComponent: () => import('./features/errors/status-page.component').then((m) => m.StatusPageComponent),
        data: { code: '403', title: 'Accès refusé', message: 'Vous n’avez pas la permission d’accéder à cette page.' },
      },
      {
        path: '**',
        loadComponent: () => import('./features/errors/status-page.component').then((m) => m.StatusPageComponent),
      },
    ],
  },
];
