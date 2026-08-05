import {
  PaymentProvider, ReconciliationDomain, ReconciliationGapKind, TransactionStatus, TransactionType,
  WalletMovementMotif, WalletMovementSense,
} from './enums';
import { AuditFields } from './common.model';

/** `transactions` (§7.2.15). */
export interface Transaction extends AuditFields {
  id: string;
  uuid: string;
  commande_id?: string;
  commande_numero?: string;
  type: TransactionType;
  prestataire: PaymentProvider;
  reference_externe?: string;
  reference_interne: string;
  montant: number;
  frais_prestataire: number;
  statut: TransactionStatus;
  code_erreur_prestataire?: string;
  initiee_le: string;
  confirmee_le?: string;
}

/** `mouvements_wallet` (§7.2.16), grand livre, immuable. */
export interface WalletMovement {
  id: string;
  wallet_id: string;
  sens: WalletMovementSense;
  montant: number;
  motif: WalletMovementMotif;
  commande_id?: string;
  commande_numero?: string;
  transaction_id?: string;
  solde_apres: number;
  reference: string;
  cree_le: string;
}

export interface DriverWallet {
  livreur_id: string;
  livreur_nom: string;
  solde_disponible: number;
  encours_cod: number;
  plafond_cod: number;
  mouvements: WalletMovement[];
}

export interface ReconciliationGap {
  id: string;
  domaine: ReconciliationDomain;
  nature: ReconciliationGapKind;
  reference: string;
  montant_plateforme?: number;
  montant_operateur?: number;
  ecart: number;
  entite_liee?: string;
  qualifie: boolean;
  action?: 'REMBOURSEMENT' | 'REGULARISATION' | 'ENQUETE';
  qualifie_par?: string;
  qualifie_le?: string;
}

export interface ReconciliationPeriod {
  id: string;
  domaine: ReconciliationDomain;
  periode_debut: string;
  periode_fin: string;
  statut: 'OUVERTE' | 'CLOTUREE';
  total_attendu: number;
  total_constate: number;
  ecart_pct: number;
  cloturee_le?: string;
  cloturee_par?: string;
  ecarts: ReconciliationGap[];
}
