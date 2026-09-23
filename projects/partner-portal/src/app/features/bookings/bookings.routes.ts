import { Routes } from '@angular/router';

export const BOOKINGS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./bookings-page/bookings-page.component').then((m) => m.BookingsPageComponent), title: 'Réservations — Portail Partenaire' },
];
