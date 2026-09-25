import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';

export interface SupervisionDriver {
  id: number;
  user_uuid: string;
  matricule: string;
  account_status: string;
  operational_status: string;
  cod_outstanding_xaf: number;
  cod_limit_xaf: number;
  position_updated_at: string | null;
  permit_expires_at: string | null;
  insurance_expires_at: string | null;
  lat: number | null;
  lng: number | null;
}

export interface SupervisionOrder {
  id: number;
  uuid: string;
  status: string;
  payment_method: string;
  price_xaf: number;
  city: string;
  promised_at: string | null;
  created_at: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}

export interface SupervisionPayment {
  id: number;
  uuid: string;
  order_id: number;
  provider: string;
  status: string;
  amount_xaf: number;
  initiated_at: string;
}

export interface SupervisionIncident {
  id: number;
  driver_id: number;
  order_id: number | null;
  type: string;
  severity: string;
  description: string;
  lat: number;
  lng: number;
  created_at: string | null;
}

export type SupervisionAlertType =
  | 'COMMANDE_NON_AFFECTEE' | 'SLA_DEPASSE' | 'ECART_PROXIMITE' | 'PLAFOND_COD_PROCHE'
  | 'PAIEMENT_EN_ATTENTE' | 'INCIDENT_CRITIQUE';

export interface SupervisionAlert {
  id: string;
  type: SupervisionAlertType;
  resource_type: string;
  resource_id: string;
  severity: 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
  message: string;
  context: Record<string, unknown>;
  acknowledgement: { motif: string; acquitte_par?: string; acquitte_le?: string } | null;
}

export interface SupervisionDashboard {
  generated_at: string;
  limits: { drivers: number; orders: number };
  daily_stats: { created: number; delivered: number; cancelled: number };
  drivers: SupervisionDriver[];
  orders: SupervisionOrder[];
  payments_pending_over_10m: SupervisionPayment[];
  critical_incidents: SupervisionIncident[];
  alerts: SupervisionAlert[];
}

/** `GET /v1/orders/{uuid}/route` — road route computed by the backend (OSRM) from the driver's position to the current target. */
export interface OrderRoute {
  route_available: boolean;
  reason: string | null;
  target: 'pickup' | 'delivery' | null;
  distance_m: number | null;
  duration_seconds: number | null;
  eta_min_minutes: number | null;
  eta_max_minutes: number | null;
  /** GeoJSON LineString — coordinates are `[lng, lat]`. */
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
}

export interface KpiMeasurement {
  id: string;
  label: string;
  category: string;
  value: number | null;
  unit: string;
  status: 'OK' | 'WARNING' | 'ALERT' | 'MEASURED' | 'NO_DATA';
  source_event_count: number;
  formula: string;
  frequency: string;
  target: string;
  alert_threshold: string;
  source_events: string[];
}

export interface KpiDashboard {
  day: string;
  catalog_version: string;
  instrumented_kpis: number;
  measurements: KpiMeasurement[];
}

/** UC-ADM-01 — GET /v1/admin/supervision + GET /v1/admin/kpi-dashboard (Analytics module). */
@Injectable({ providedIn: 'root' })
export class SupervisionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  dashboard(status?: string, city?: string): Observable<SupervisionDashboard> {
    const params: Record<string, string> = {};
    if (status) params['statut'] = status;
    if (city) params['ville'] = city;
    return this.http.get<SupervisionDashboard>(`${this.baseUrl}/admin/supervision`, { params });
  }

  orderRoute(orderUuid: string): Observable<OrderRoute> {
    return this.http.get<OrderRoute>(`${this.baseUrl}/orders/${orderUuid}/route`, { params: { optimization: 'fastest' } });
  }

  acknowledgeAlert(alertId: string, motif: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/supervision/alerts/${alertId}/acknowledge`, { motif });
  }

  kpiDashboard(day?: string, categorie?: string): Observable<KpiDashboard> {
    const params: Record<string, string> = {};
    if (day) params['jour'] = day;
    if (categorie) params['categorie'] = categorie;
    return this.http.get<KpiDashboard>(`${this.baseUrl}/admin/kpi-dashboard`, { params });
  }
}
