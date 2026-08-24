import { Routes } from '@angular/router';

export const FINANCE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./finance-page/finance-page.component').then((m) => m.FinancePageComponent), title: 'Finance — LVB Admin' },
];
