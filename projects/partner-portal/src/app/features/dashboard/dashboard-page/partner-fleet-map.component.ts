import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ProblemDetails } from '@lvb/models/common.model';
import { FleetUnit, MapPanelComponent, unitKindFor } from '@lvb/ui/map-panel/map-panel.component';
import { FleetLiveService, PartnerFleetPosition } from '../../../core/services/fleet-live.service';

/** Map colour class + wording for a unit. Chauffeurs report their fleet status, not the courier online/offline states. */
function presentStatus(p: PartnerFleetPosition): { status: string; label: string } {
  const s = p.statut_operationnel;
  switch (s) {
    case 'DISPONIBLE': return { status: 'DISPONIBLE', label: 'En ligne — disponible' };
    case 'EN_MISSION': return { status: 'EN_MISSION', label: p.kind === 'CHAUFFEUR' ? 'En mission' : 'En livraison' };
    case 'PAUSE': return { status: 'PAUSE', label: 'En pause' };
    case 'HORS_LIGNE': return { status: 'HORS_LIGNE', label: 'Hors ligne' };
    case 'ACTIF': return { status: 'DISPONIBLE', label: 'Actif' };
    case 'EN_CONGE': return { status: 'PAUSE', label: 'En congé' };
    case 'INDISPONIBLE': return { status: 'HORS_LIGNE', label: 'Indisponible' };
    case 'SUSPENDU': return { status: 'HORS_LIGNE', label: 'Suspendu' };
    case 'EN_ATTENTE_VALIDATION': return { status: 'HORS_LIGNE', label: 'En attente de validation LVB' };
    default: return { status: 'HORS_LIGNE', label: s };
  }
}
const POLL_MS = 20_000;

/**
 * Live map of the partner's own couriers and drivers: vehicle icons that move, sized by zoom, with a
 * hover card (name, phone, status). Polls the positions feed every 20 s while the tab is visible.
 */
@Component({
  selector: 'app-partner-fleet-map',
  imports: [MapPanelComponent],
  template: `
    <section class="card flex flex-col">
      <div class="card-head">
        <div>
          <h2 class="card-title">Suivi de mon équipe en direct</h2>
          @if (state() === 'ready') {
            <p class="card-sub">
              {{ counts().online }} en ligne · {{ counts().mission }} en livraison · {{ counts().offline }} hors ligne
              @if (updated(); as t) { · mis à jour {{ t.toLocaleTimeString('fr-FR') }} }
            </p>
          } @else {
            <p class="card-sub">Positions GPS transmises par votre équipe</p>
          }
        </div>
      </div>
      <div class="card-body flex flex-col">
      @switch (state()) {
        @case ('loading') { <div class="skeleton h-80"></div> }
        @case ('unavailable') {
          <div class="inline-empty">Le suivi en direct n’est pas disponible pour votre compte (il est réservé aux membres de l’organisation habilités).</div>
        }
        @case ('error') {
          <div class="inline-empty" style="color: var(--status-critical)">{{ error() }}</div>
        }
        @default {
          @if (units().length === 0) {
            <p class="text-xs mb-2" style="color: var(--text-muted)">Aucun livreur ou chauffeur n’a encore partagé sa position — les icônes apparaissent dès que leur application envoie le GPS.</p>
          }
          <app-map-panel [bbox]="bbox()" [units]="units()" class="block h-80 sm:h-105">
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#2E9E44"></span> Disponible</div>
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#004AAD"></span> En livraison</div>
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#E8830C"></span> En pause</div>
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#6B7686"></span> Hors ligne</div>
          </app-map-panel>
          <p class="text-[11px] mt-2.5" style="color: var(--text-muted)">Survolez une icône pour voir le nom, le téléphone et l’état. Les icônes s’adaptent au zoom.</p>
        }
      }
      </div>
    </section>
  `,
})
export class PartnerFleetMapComponent {
  private readonly api = inject(FleetLiveService);

  protected readonly state = signal<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  protected readonly error = signal('');
  protected readonly items = signal<PartnerFleetPosition[]>([]);
  protected readonly updated = signal<Date | null>(null);

  protected readonly units = computed<FleetUnit[]>(() => this.items()
    .filter((p): p is PartnerFleetPosition & { lat: number; lng: number } => p.lat !== null && p.lng !== null)
    .map((p) => ({
      id: p.uuid, point: { lat: p.lat, lng: p.lng }, kind: unitKindFor(p.vehicle_type),
      name: [p.prenom, p.nom].filter(Boolean).join(' '), phone: p.telephone, status: presentStatus(p).status,
      statusLabel: presentStatus(p).label,
      subtitle: [p.kind === 'CHAUFFEUR' ? 'Chauffeur' : 'Livreur', p.matricule].filter(Boolean).join(' · '),
      updatedAt: p.position_updated_at,
    })));

  protected readonly counts = computed(() => {
    const l = this.items();
    return {
      online: l.filter((p) => presentStatus(p).status === 'DISPONIBLE').length,
      mission: l.filter((p) => presentStatus(p).status === 'EN_MISSION').length,
      offline: l.filter((p) => ['HORS_LIGNE', 'PAUSE'].includes(presentStatus(p).status)).length,
    };
  });

  /** Fits once on load so polling never yanks the map while the user pans. */
  protected readonly bbox = signal({ latMin: 3.9, latMax: 4.2, lngMin: 9.5, lngMax: 9.95 });
  private fitted = false;

  constructor() {
    this.load();
    const timer = setInterval(() => { if (!document.hidden && this.state() !== 'unavailable') this.load(); }, POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private load(): void {
    this.api.positions().subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.updated.set(new Date());
        this.state.set('ready');
        if (!this.fitted) this.fit();
      },
      error: (err: ProblemDetails) => {
        // 403/404/501 → the feed is not enabled for this account yet; anything else is a real failure.
        if ([403, 404, 501].includes(err.status)) this.state.set('unavailable');
        else if (this.state() === 'loading') { this.error.set(err.detail); this.state.set('error'); }
      },
    });
  }

  private fit(): void {
    const pts = this.units().map((u) => u.point);
    if (pts.length === 0) return;
    this.fitted = true;
    const lats = pts.map((p) => p.lat); const lngs = pts.map((p) => p.lng);
    const pad = 0.02;
    this.bbox.set({ latMin: Math.min(...lats) - pad, latMax: Math.max(...lats) + pad, lngMin: Math.min(...lngs) - pad, lngMax: Math.max(...lngs) + pad });
  }
}
