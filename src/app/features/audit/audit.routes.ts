import { Routes } from '@angular/router';

export const AUDIT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./audit-page/audit-page.component').then((m) => m.AuditPageComponent), title: 'Journal d’audit — LVB Admin' },
];
