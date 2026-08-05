import { Routes } from '@angular/router';

export const ACCOUNT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./account-page/account-page.component').then((m) => m.AccountPageComponent), title: 'Mon compte — LVB Admin' },
];
