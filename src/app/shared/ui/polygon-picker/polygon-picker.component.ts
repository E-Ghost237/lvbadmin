import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { GeoPoint } from '../../../core/models';

/** Click-to-add-vertex polygon drawing — used for zone creation (min 3 points, no geocoding available). */
@Component({
  selector: 'app-polygon-picker',
  template: `
    <div class="relative w-full h-full overflow-hidden rounded-(--radius-md)" style="background: var(--surface-2)">
      <div #mapEl class="absolute inset-0"></div>
      <div class="absolute top-2 left-2 z-[1000] px-2.5 py-1 rounded-full text-[11px] font-medium" style="background: var(--surface-1); border: 1px solid var(--border-strong)">
        {{ points().length }} point(s) — minimum 3
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class PolygonPickerComponent {
  readonly center = input<GeoPoint>({ lat: 4.0511, lng: 9.7679 });
  readonly zoom = input(12);
  readonly points = input<GeoPoint[]>([]);

  readonly pointsChange = output<GeoPoint[]>();

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private map: L.Map | undefined;
  private polygon: L.Polygon | undefined;
  private markers: L.CircleMarker[] = [];
  private resizeObserver: ResizeObserver | undefined;

  constructor() {
    afterNextRender(() => {
      const map = L.map(this.mapEl().nativeElement).setView([this.center().lat, this.center().lng], this.zoom());
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      map.on('click', (e: L.LeafletMouseEvent) => {
        this.pointsChange.emit([...this.points(), { lat: e.latlng.lat, lng: e.latlng.lng }]);
      });
      this.map = map;

      // Same responsive-container caveat as MapPanelComponent: Leaflet needs
      // an explicit nudge whenever the host's CSS-driven size changes.
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(this.host.nativeElement);

      this.destroyRef.onDestroy(() => {
        this.resizeObserver?.disconnect();
        map.remove();
      });
      this.redraw();
    });

    effect(() => {
      this.points();
      if (this.map) this.redraw();
    });
  }

  private redraw(): void {
    if (!this.map) return;
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    if (this.polygon) { this.polygon.remove(); this.polygon = undefined; }

    const points = this.points();
    for (const p of points) {
      this.markers.push(L.circleMarker([p.lat, p.lng], { radius: 5, color: 'white', weight: 2, fillColor: '#004AAD', fillOpacity: 1 }).addTo(this.map));
    }
    if (points.length >= 2) {
      this.polygon = L.polygon(points.map((p) => [p.lat, p.lng] as [number, number]), {
        color: '#004AAD', weight: 2, fillColor: '#004AAD', fillOpacity: 0.12,
      }).addTo(this.map);
    }
  }
}
