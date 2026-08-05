import { CancellationQuote, Order } from '../models';

/** RG-025 barème d'annulation (UC-CLI-04) — pure so the UI can preview instantly before confirming. */
export function quoteCancellation(order: Order): CancellationQuote {
  const zero: CancellationQuote = { frais: 0, frais_pct: 0, remboursement: order.prix_total, justification: 'Aucun engagement à ce stade.' };

  switch (order.statut) {
    case 'BROUILLON':
    case 'EN_ATTENTE_PAIEMENT':
    case 'EN_ATTENTE_AFFECTATION':
    case 'EN_ATTENTE_MANUELLE':
      return zero;

    case 'AFFECTEE': {
      const minutesSince = order.affectee_le ? (Date.now() - new Date(order.affectee_le).getTime()) / 60_000 : 0;
      if (minutesSince < 2) return { ...zero, justification: 'Fenêtre de grâce (moins de 2 minutes après affectation).' };
      const frais = Math.max(Math.round(order.prix_total * 0.3), 500);
      return { frais, frais_pct: 30, remboursement: order.prix_total - frais, justification: 'Le livreur s’est déplacé (RG-025).' };
    }

    case 'EN_ROUTE_RAMASSAGE':
    case 'ARRIVE_RAMASSAGE': {
      const frais = Math.max(Math.round(order.prix_total * 0.3), 500);
      return { frais, frais_pct: 30, remboursement: order.prix_total - frais, justification: 'Le livreur s’est déplacé (RG-025).' };
    }

    case 'COLIS_RECUPERE':
    case 'EN_LIVRAISON':
    case 'ARRIVE_LIVRAISON':
      return { frais: order.prix_total, frais_pct: 100, remboursement: 0, justification: 'Service quasi rendu ; retour du colis facturé en sus.' };

    default:
      return { frais: 0, frais_pct: 0, remboursement: 0, justification: 'Annulation impossible à ce stade — orientez vers une réclamation (UC-CLI-08).' };
  }
}

export function isCancellable(order: Order): boolean {
  return ![
    'LIVREE', 'ANNULEE', 'EXPIREE', 'RETOURNEE', 'ECHEC_RAMASSAGE', 'ECHEC_LIVRAISON', 'RETOUR_EXPEDITEUR',
  ].includes(order.statut);
}

/** RG-017 machine à états — the exact adjacency list from §6.3.1, enforced everywhere a status can change. */
export const ORDER_STATUS_TRANSITIONS: Record<Order['statut'], Order['statut'][]> = {
  BROUILLON: ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_AFFECTATION', 'EXPIREE'],
  EN_ATTENTE_PAIEMENT: ['EN_ATTENTE_AFFECTATION', 'ANNULEE'],
  PLANIFIEE: ['EN_ATTENTE_AFFECTATION', 'ANNULEE'],
  EN_ATTENTE_AFFECTATION: ['AFFECTEE', 'EN_ATTENTE_MANUELLE', 'ANNULEE'],
  EN_ATTENTE_MANUELLE: ['AFFECTEE', 'ANNULEE'],
  AFFECTEE: ['EN_ROUTE_RAMASSAGE', 'EN_ATTENTE_AFFECTATION', 'ANNULEE'],
  EN_ROUTE_RAMASSAGE: ['ARRIVE_RAMASSAGE', 'EN_ATTENTE_AFFECTATION', 'ANNULEE'],
  ARRIVE_RAMASSAGE: ['COLIS_RECUPERE', 'ECHEC_RAMASSAGE'],
  COLIS_RECUPERE: ['EN_LIVRAISON'],
  EN_LIVRAISON: ['ARRIVE_LIVRAISON'],
  ARRIVE_LIVRAISON: ['LIVREE', 'ECHEC_LIVRAISON'],
  LIVREE: [],
  ECHEC_RAMASSAGE: ['ANNULEE', 'EN_ATTENTE_AFFECTATION'],
  ECHEC_LIVRAISON: ['RETOUR_EXPEDITEUR', 'EN_ATTENTE_AFFECTATION'],
  RETOUR_EXPEDITEUR: ['RETOURNEE'],
  RETOURNEE: [],
  ANNULEE: [],
  EXPIREE: [],
};

export function canTransition(from: Order['statut'], to: Order['statut']): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
