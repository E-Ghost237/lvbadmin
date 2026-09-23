import { Routes } from '@angular/router';

export const ORDERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./orders-page/orders-page.component').then((m) => m.OrdersPageComponent), title: 'Commandes — Portail Partenaire' },
];
