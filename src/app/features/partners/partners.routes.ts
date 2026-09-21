import { Routes } from '@angular/router';

export const PARTNERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./partners-page/partners-page.component').then((m) => m.PartnersPageComponent), title: 'Partenaires — LVB Admin' },
];
