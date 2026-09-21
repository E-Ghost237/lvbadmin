import { Routes } from '@angular/router';

export const PARTNERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./partners-page/partners-page.component').then((m) => m.PartnersPageComponent), title: 'Partenaires — LVB Admin' },
  { path: ':uuid', loadComponent: () => import('./partner-detail/partner-detail.component').then((m) => m.PartnerDetailComponent), title: 'Partenaire — LVB Admin' },
];
