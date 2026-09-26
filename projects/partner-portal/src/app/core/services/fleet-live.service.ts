import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@lvb/http/api.config';

/**
 * One courier or driver of the organisation with their last known position.
 * `GET /v1/partner/fleet/positions` — only units attached to the caller's partner (`booking.read`).
 */
export interface PartnerFleetPosition {
  uuid: string;
  kind: 'LIVREUR' | 'CHAUFFEUR';
  nom: string;
  prenom: string | null;
  telephone: string | null;
  matricule: string | null;
  /** MOTO, VELO, TRICYCLE, VOITURE, CAMIONNETTE, PIETON… or a rental vehicle type code. */
  vehicle_type: string | null;
  /** Couriers: DISPONIBLE / EN_MISSION / PAUSE / HORS_LIGNE. Rental chauffeurs: their fleet status (ACTIF, INDISPONIBLE, EN_CONGE, SUSPENDU, EN_ATTENTE_VALIDATION). */
  statut_operationnel: string;
  lat: number | null;
  lng: number | null;
  position_updated_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class FleetLiveService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  positions(): Observable<{ items: PartnerFleetPosition[] }> {
    return this.http.get<{ items: PartnerFleetPosition[] }>(`${this.baseUrl}/partner/fleet/positions`);
  }
}
