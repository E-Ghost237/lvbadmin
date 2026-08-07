import { Routes } from '@angular/router';

export const DRIVERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./drivers-list/drivers-list.component').then((m) => m.DriversListComponent), title: 'Livreurs — LVB Admin' },
  { path: 'kyc/:uuid', loadComponent: () => import('./kyc-review/kyc-review.component').then((m) => m.KycReviewComponent), title: 'Revue KYC — LVB Admin' },
  { path: ':uuid', loadComponent: () => import('./driver-detail/driver-detail.component').then((m) => m.DriverDetailComponent), title: 'Livreur — LVB Admin' },
];
