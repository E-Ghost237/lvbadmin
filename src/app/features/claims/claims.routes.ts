import { Routes } from '@angular/router';

export const CLAIMS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./claim-lookup/claim-lookup.component').then((m) => m.ClaimLookupComponent), title: 'Réclamations & litiges — LVB Admin' },
];
