import { Routes } from '@angular/router';

export const TELECONSEILLER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./console/teleconseiller-console.component').then((m) => m.TeleconseillerConsoleComponent), title: 'Console téléconseiller — LVB Admin' },
];
