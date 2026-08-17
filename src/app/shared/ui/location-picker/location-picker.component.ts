import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { GeoPoint } from '../../../core/models';

/**
 * There is no geocoding/address-search endpoint anywhere in the backend
 * (checked every module's routes) — `POST /v1/quotes` requires raw
 * lat/lng, full stop. So pickup/dropoff selection is a literal map click,
 * not an address form. Free OSM road tiles, no API key.
 */
@Component({
  selector: 'app-location-picker',
  template: `
    <div class="relative w-full h-full overflow-hidden rounded-(--radius-md)" style="background: var(--surface-2)">
      <div #mapEl class="absolute inset-0"></div>
      @if (!value()) {
        <div class="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" style="background: var(--surface-1); border: 1px solid var(--border-strong)">Cliquez sur la carte pour placer le point</span>
        </div>
      }
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class LocationPickerComponent {
  readonly center = input<GeoPoint>({ lat: 4.0511, lng: 9.7679 });
  readonly zoom = input(12);
  readonly value = input<GeoPoint | null>(null);

  readonly valueChange = output<GeoPoint>();

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private map: L.Map | undefined;
  private marker: L.Marker | undefined;
  private resizeObserver: ResizeObserver | undefined;

  // Leaflet's default marker icon resolves to image paths the bundler doesn't
  // serve; a small inline SVG pin avoids that broken-image issue entirely.
  private readonly pinIcon = L.divIcon({
    className: '',
    html: '<svg width="28" height="36" viewBox="0 0 24 24" fill="#004AAD" stroke="white" stroke-width="1"><path d="M12 0C6.5 0 2 4.5 2 10c0 7 10 14 10 14s10-7 10-14c0-5.5-4.5-10-10-10Zm0 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/></svg>',
    iconSize: [28, 36], iconAnchor: [14, 36],
  });

  constructor() {
    afterNextRender(() => {
      const map = L.map(this.mapEl().nativeElement).setView([this.center().lat, this.center().lng], this.zoom());
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      map.on('click', (e: L.LeafletMouseEvent) => {
        this.valueChange.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      this.map = map;

      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(this.host.nativeElement);

      this.destroyRef.onDestroy(() => {
        this.resizeObserver?.disconnect();
        map.remove();
      });
      this.syncMarker();
    });

    effect(() => {
      this.value();
      if (this.map) this.syncMarker();
    });
  }

  private syncMarker(): void {
    const point = this.value();
    if (!this.map || !point) return;
    if (this.marker) this.marker.setLatLng([point.lat, point.lng]);
    else this.marker = L.marker([point.lat, point.lng], { icon: this.pinIcon }).addTo(this.map);
    this.map.panTo([point.lat, point.lng]);
  }
}
