import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./profile-page/profile-page.component').then((m) => m.ProfilePageComponent), title: 'Profil — Portail Partenaire' },
];
