import { Routes } from '@angular/router';

export const PRICING_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pricing-page/pricing-page.component').then((m) => m.PricingPageComponent), title: 'Tarification & zones — LVB Admin' },
];
