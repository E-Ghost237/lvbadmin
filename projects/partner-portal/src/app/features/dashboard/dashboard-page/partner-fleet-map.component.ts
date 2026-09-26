import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ProblemDetails } from '@lvb/models/common.model';
import { FleetUnit, MapPanelComponent, unitKindFor } from '@lvb/ui/map-panel/map-panel.component';
import { FleetLiveService, PartnerFleetPosition } from '../../../core/services/fleet-live.service';

const STATUS_LABEL: Record<string, string> = {
  DISPONIBLE: 'En ligne — disponible', EN_MISSION: 'En livraison', PAUSE: 'En pause', HORS_LIGNE: 'Hors ligne',
};
const POLL_MS = 20_000;

/**
 * Live map of the partner's own couriers and drivers: vehicle icons that move, sized by zoom, with a
 * hover card (name, phone, status). Polls the positions feed every 20 s while the tab is visible.
 */
@Component({
  selector: 'app-partner-fleet-map',
  imports: [MapPanelComponent],
  template: `
    <div class="card p-4 flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 class="text-sm font-semibold">Suivi de mon équipe en direct</h2>
        @if (state() === 'ready') {
          <p class="text-xs" style="color: var(--text-muted)">
            {{ counts().online }} en ligne · {{ counts().mission }} en livraison · {{ counts().offline }} hors ligne
            @if (updated(); as t) { · mis à jour {{ t.toLocaleTimeString('fr-FR') }} }
          </p>
        }
      </div>
      @switch (state()) {
        @case ('loading') { <div class="skeleton h-80"></div> }
        @case ('unavailable') {
          <p class="text-sm px-3 py-6 text-center rounded-(--radius-md)" style="background: var(--surface-2); color: var(--text-muted)">
            Le suivi en direct n’est pas encore activé pour votre organisation. Il apparaîtra ici dès que LVB l’aura mis en service.
          </p>
        }
        @case ('error') {
          <p class="text-sm px-3 py-6 text-center rounded-(--radius-md)" style="background: var(--surface-2); color: var(--status-critical)">{{ error() }}</p>
        }
        @default {
          @if (units().length === 0) {
            <p class="text-xs mb-2" style="color: var(--text-muted)">Aucun livreur ou chauffeur avec une position pour l’instant.</p>
          }
          <app-map-panel [bbox]="bbox()" [units]="units()" class="block h-80 sm:h-105">
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#2E9E44"></span> Disponible</div>
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#004AAD"></span> En livraison</div>
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#E8830C"></span> En pause</div>
            <div legend class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:#6B7686"></span> Hors ligne</div>
          </app-map-panel>
          <p class="text-[11px] mt-2" style="color: var(--text-muted)">Survolez une icône pour voir le nom, le téléphone et l’état. Les icônes s’adaptent au zoom.</p>
        }
      }
    </div>
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
      name: [p.prenom, p.nom].filter(Boolean).join(' '), phone: p.telephone, status: p.statut_operationnel,
      statusLabel: STATUS_LABEL[p.statut_operationnel] ?? p.statut_operationnel,
      subtitle: [p.kind === 'CHAUFFEUR' ? 'Chauffeur' : 'Livreur', p.matricule].filter(Boolean).join(' · '),
      updatedAt: p.position_updated_at,
    })));

  protected readonly counts = computed(() => {
    const l = this.items();
    return {
      online: l.filter((p) => p.statut_operationnel === 'DISPONIBLE').length,
      mission: l.filter((p) => p.statut_operationnel === 'EN_MISSION').length,
      offline: l.filter((p) => p.statut_operationnel === 'HORS_LIGNE').length,
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
