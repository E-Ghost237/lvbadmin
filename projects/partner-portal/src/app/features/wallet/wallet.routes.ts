import { Routes } from '@angular/router';

export const WALLET_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./wallet-page/wallet-page.component').then((m) => m.WalletPageComponent), title: 'Portefeuille — Portail Partenaire' },
];
