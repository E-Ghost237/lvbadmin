import { Routes } from '@angular/router';

export const CLAIMS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./claims-list/claims-list.component').then((m) => m.ClaimsListComponent), title: 'Réclamations & litiges — LVB Admin' },
  { path: ':id', loadComponent: () => import('./claim-arbitration/claim-arbitration.component').then((m) => m.ClaimArbitrationComponent), title: 'Réclamation — LVB Admin' },
];
