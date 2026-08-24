import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, newIdempotencyKey, withIdempotencyKey } from '../http/api.config';
import { GeoPoint, OrderChannel, OrderStatus, PaymentMethod, UuidCursorPage } from '../models';

export interface AdminOrderParty {
  uuid: string;
  nom: string;
  prenom: string | null;
  telephone: string;
}

export interface AdminOrderDriver extends AdminOrderParty {
  matricule: string;
}

export interface AdminOrderListItem {
  uuid: string;
  statut: OrderStatus;
  canal: OrderChannel;
  ville: string;
  depart: GeoPoint;
  arrivee: GeoPoint;
  destinataire: { nom: string; telephone: string };
  mode_paiement: PaymentMethod;
  prix_final_xaf: number;
  poids_kg: number;
  valeur_declaree_xaf: number | null;
  creneau_planifie: string | null;
  echeance_promise: string;
  affectee_le: string | null;
  livree_le: string | null;
  cree_le: string;
  archivee_le: string | null;
  client: AdminOrderParty | null;
  livreur: AdminOrderDriver | null;
}

export interface AdminOrderListFilters {
  from?: string;
  to?: string;
  statuses?: OrderStatus[];
  city?: string;
  client_uuid?: string;
  driver_uuid?: string;
  payment_method?: PaymentMethod;
  channel?: OrderChannel;
  q?: string;
  archived?: boolean;
  cursor?: string;
  limit?: number;
}

/** UC-ADM-08/09 — GET /v1/admin/orders (Ordering module). Read-only global order search; dispatch actions live in DispatchService. */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: AdminOrderListFilters): Observable<UuidCursorPage<AdminOrderListItem>> {
    return this.http.get<UuidCursorPage<AdminOrderListItem>>(`${this.baseUrl}/admin/orders`, {
      params: this.toParams(filters),
    });
  }

  private toParams(filters: AdminOrderListFilters): Record<string, string | string[]> {
    const params: Record<string, string | string[]> = {};
    if (filters.from) params['from'] = filters.from;
    if (filters.to) params['to'] = filters.to;
    if (filters.statuses?.length) params['statuses[]'] = filters.statuses;
    if (filters.city) params['city'] = filters.city;
    if (filters.client_uuid) params['client_uuid'] = filters.client_uuid;
    if (filters.driver_uuid) params['driver_uuid'] = filters.driver_uuid;
    if (filters.payment_method) params['payment_method'] = filters.payment_method;
    if (filters.channel) params['channel'] = filters.channel;
    if (filters.q) params['q'] = filters.q;
    if (filters.archived !== undefined) params['archived'] = String(filters.archived);
    if (filters.cursor) params['cursor'] = filters.cursor;
    if (filters.limit) params['limit'] = String(filters.limit);
    return params;
  }
}

export interface ManualAssignmentRequest {
  order_uuid: string;
  driver_uuid: string;
  reason: string;
}

/** UC-ADM-10 — POST /v1/admin/dispatch/assign (Dispatch module). */
@Injectable({ providedIn: 'root' })
export class DispatchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  assignManually(req: ManualAssignmentRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/dispatch/assign`, req, {
      context: withIdempotencyKey(newIdempotencyKey()),
    });
  }
}
