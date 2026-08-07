import { Routes } from '@angular/router';
import { guestGuard } from '../../core/auth/auth.guard';

export const AUTH_ROUTES: Routes = [
  { path: 'login',canActivate: [guestGuard], loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent), title: 'Connexion — LVB Admin' },
  { path: 'forgot-password', canActivate: [guestGuard], loadComponent: () => import('./forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent), title: 'Récupérer l’accès — LVB Admin' },
  { path: 'reset-password', canActivate: [guestGuard], loadComponent: () => import('./reset-password/reset-password.component').then((m) => m.ResetPasswordComponent), title: 'Nouveau mot de passe — LVB Admin' },
];
