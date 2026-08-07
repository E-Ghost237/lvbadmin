import { Routes } from '@angular/router';

export const TELECONSEILLER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./console/console.component').then((m) => m.ConsoleComponent), title: 'Console téléconseiller — LVB Admin' },
];
