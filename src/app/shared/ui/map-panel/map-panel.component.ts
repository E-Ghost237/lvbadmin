import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { GeoPoint } from '../../../core/models';

export interface MapMarker {
  id: string;
  point: GeoPoint;
  tone: 'good' | 'warning' | 'critical' | 'neutral' | 'info';
  label: string;
}

export interface MapZoneShape {
  id: string;
  center: GeoPoint;
  radiusKm: number;
  color: string;
  label: string;
}

type BaseLayer = 'road' | 'satellite' | 'hybrid';

const TONE_COLOR: Record<MapMarker['tone'], string> = {
  good: '#2E9E44', warning: '#B3760F', critical: '#D03B3B', neutral: '#6B7686', info: '#004AAD',
};

/**
 * Real Leaflet map — free tile sources, no API key (§11.5 swap point). Road
 * uses OpenStreetMap; satellite/hybrid use Esri World Imagery (+ a labels
 * overlay for hybrid) since both are usable client-side with no billing.
 */
@Component({
  selector: 'app-map-panel',
  template: `
    <div class="relative w-full h-full overflow-hidden rounded-(--radius-md)" style="background: var(--surface-2)">
      <div #mapEl class="absolute inset-0"></div>

      <div class="absolute top-2 right-2 z-[1000] flex rounded-(--radius-sm) overflow-hidden shadow-(--shadow-sm)" style="border: 1px solid var(--border-strong)">
        @for (opt of layerOptions; track opt.id) {
          <button
            type="button" class="px-2.5 py-1 text-[11px] font-medium transition-colors"
            [style.background]="baseLayer() === opt.id ? 'var(--brand)' : 'var(--surface-1)'"
            [style.color]="baseLayer() === opt.id ? 'white' : 'var(--text-secondary)'"
            (click)="baseLayer.set(opt.id)"
          >{{ opt.label }}</button>
        }
      </div>

      <div class="absolute bottom-2 left-2 z-[1000] flex flex-wrap gap-2 px-2 py-1.5 rounded-(--radius-sm) text-[10px]" style="background: var(--surface-1); border: 1px solid var(--border)">
        <ng-content select="[legend]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .leaflet-control-zoom { border: none !important; box-shadow: var(--shadow-sm) !important; margin: 8px !important; }
    .leaflet-control-zoom a { background: var(--surface-1) !important; color: var(--text-primary) !important; border-color: var(--border-strong) !important; }
    .leaflet-control-zoom a:hover { background: var(--surface-2) !important; }
    .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.75) !important; }
  `],
})
export class MapPanelComponent {
  readonly bbox = input.required<{ latMin: number; latMax: number; lngMin: number; lngMax: number }>();
  readonly markers = input<MapMarker[]>([]);
  readonly zones = input<MapZoneShape[]>([]);

  readonly markerClick = output<string>();

  protected readonly layerOptions: { id: BaseLayer; label: string }[] = [
    { id: 'road', label: 'Plan' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'hybrid', label: 'Hybride' },
  ];
  protected readonly baseLayer = signal<BaseLayer>('road');

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private map: L.Map | undefined;
  private activeBaseLayer: L.TileLayer | undefined;
  private hybridOverlay: L.TileLayer | undefined;
  private markerLayer: L.LayerGroup | undefined;
  private zoneLayer: L.LayerGroup | undefined;
  private resizeObserver: ResizeObserver | undefined;

  private readonly boundsFromBbox = computed(() => {
    const b = this.bbox();
    return L.latLngBounds([b.latMin, b.lngMin], [b.latMax, b.lngMax]);
  });

  constructor() {
    afterNextRender(() => {
      this.initMap();

      // The map's CSS size changes with the viewport (responsive height
      // classes on the host) and with sidebar collapse/expand — Leaflet
      // caches its container size at init and after each fitBounds, so it
      // must be told explicitly whenever that box changes.
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(this.host.nativeElement);

      this.destroyRef.onDestroy(() => {
        this.resizeObserver?.disconnect();
        this.map?.remove();
      });
    });

    effect(() => {
      const layer = this.baseLayer();
      if (this.map) this.applyBaseLayer(layer);
    });

    effect(() => {
      const bounds = this.boundsFromBbox();
      if (this.map) this.map.fitBounds(bounds, { padding: [12, 12] });
    });

    effect(() => {
      const markers = this.markers();
      const zones = this.zones();
      if (this.map) this.renderOverlays(markers, zones);
    });
  }

  private initMap(): void {
    const map = L.map(this.mapEl().nativeElement, {
      zoomControl: true,
      attributionControl: true,
    });
    this.map = map;
    map.fitBounds(this.boundsFromBbox(), { padding: [12, 12] });

    this.markerLayer = L.layerGroup().addTo(map);
    this.zoneLayer = L.layerGroup().addTo(map);
    this.applyBaseLayer(this.baseLayer());
    this.renderOverlays(this.markers(), this.zones());
  }

  private applyBaseLayer(layer: BaseLayer): void {
    const map = this.map;
    if (!map) return;

    if (this.activeBaseLayer) map.removeLayer(this.activeBaseLayer);
    if (this.hybridOverlay) { map.removeLayer(this.hybridOverlay); this.hybridOverlay = undefined; }

    if (layer === 'road') {
      this.activeBaseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      });
    } else {
      this.activeBaseLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles &copy; Esri' },
      );
      if (layer === 'hybrid') {
        this.hybridOverlay = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19, attribution: 'Tiles &copy; Esri' },
        );
      }
    }

    this.activeBaseLayer.addTo(map);
    this.activeBaseLayer.bringToBack();
    if (this.hybridOverlay) this.hybridOverlay.addTo(map);
  }

  private renderOverlays(markers: MapMarker[], zones: MapZoneShape[]): void {
    this.markerLayer?.clearLayers();
    this.zoneLayer?.clearLayers();

    for (const zone of zones) {
      L.circle([zone.center.lat, zone.center.lng], {
        radius: zone.radiusKm * 1000,
        color: zone.color, weight: 1, opacity: 0.6, fillColor: zone.color, fillOpacity: 0.1,
      }).bindTooltip(zone.label).addTo(this.zoneLayer!);
    }

    for (const marker of markers) {
      const color = TONE_COLOR[marker.tone];
      L.circleMarker([marker.point.lat, marker.point.lng], {
        radius: 7, color: 'white', weight: 2, fillColor: color, fillOpacity: 1,
      })
        .bindTooltip(marker.label)
        .on('click', () => this.markerClick.emit(marker.id))
        .addTo(this.markerLayer!);
    }
  }
}
