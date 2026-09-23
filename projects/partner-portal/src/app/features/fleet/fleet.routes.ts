import { Routes } from '@angular/router';

export const FLEET_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./fleet-page/fleet-page.component').then((m) => m.FleetPageComponent), title: 'Flotte — Portail Partenaire' },
];
