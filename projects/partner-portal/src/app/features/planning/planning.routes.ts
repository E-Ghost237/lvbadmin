import { Routes } from '@angular/router';

export const PLANNING_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./planning-page.component').then((m) => m.PlanningPageComponent), title: 'Planning — Portail Partenaire' },
];
