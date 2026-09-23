import { OrderStatus, PaymentMethod } from '@lvb/models/enums';

/**
 * `GET /v1/partner/orders*` (Ordering module, partner-as-client — the
 * partner org's OWN deliveries booked through LVB, distinct from
 * Marketplace `Booking` where the partner is the service provider). Same
 * `CommandeModel`/`publicOrder()` shape used across the platform; `statut`/
 * `mode_paiement` reuse the shared `OrderStatus`/`PaymentMethod` enums.
 */
export interface PartnerOrder {
  uuid: string;
  statut: OrderStatus;
  ville: string;
  destinataire_nom: string;
  destinataire_telephone: string;
  mode_paiement: PaymentMethod;
  prix_final_xaf: number;
  cree_le: string;
  echeance_promise: string;
  livree_le: string | null;
}

export interface PartnerOrderHistoryEntry {
  statut: string;
  horodatage: string;
}

export interface PartnerOrderClaim {
  uuid: string;
  categorie: string;
  statut: string;
  description: string;
  cree_le: string;
}

/** `GET /v1/partner/orders/{uuid}` — `recu_disponible` gates whether the receipt download will succeed. */
export interface PartnerOrderDetail extends PartnerOrder {
  suivi: PartnerOrderHistoryEntry[];
  reclamations: PartnerOrderClaim[];
  recu_disponible: boolean;
}

/**
 * Laravel cursor-pagination envelope (`data`/`meta`) — deliberately
 * different from the `{items, next_cursor}` shape every other admin/partner
 * list endpoint in this app uses; this one is untouched legacy Ordering
 * module API, not part of the newer Marketplace/Rental/Booking/PartnerLedger
 * contract family.
 */
export interface PartnerOrderListResponse {
  data: PartnerOrder[];
  meta: { per_page: number; next_cursor: string | null; previous_cursor: string | null };
}

export interface PartnerOrderFilters {
  from?: string;
  to?: string;
  statut?: OrderStatus;
  mode_paiement?: PaymentMethod;
  ville?: string;
  destinataire?: string;
  cursor?: string;
}
