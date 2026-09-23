import { Routes } from '@angular/router';

export const MARKETPLACE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./marketplace-page/marketplace-page.component').then((m) => m.MarketplacePageComponent), title: 'Marketplace — Portail Partenaire' },
];
