import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import * as L from 'leaflet';
import { API_BASE_URL } from '../../../core/http/api.config';
import { GeoPoint } from '../../../core/models';

/** `GET /v1/lieux` — places and points of interest in Douala and Yaoundé (public). */
interface Lieu { id: number; nom: string; type: string; quartier: string | null; ville: string; latitude: number; longitude: number }

/**
 * Pickup/drop-off selection: a map click, or a search over the backend's places catalogue
 * (`GET /v1/lieux`, Douala & Yaoundé) that drops the pin on the chosen place. `POST /v1/quotes`
 * itself only needs lat/lng. Free OSM road tiles, no API key.
 */
@Component({
  selector: 'app-location-picker',
  template: `
    <div class="relative w-full h-full overflow-hidden rounded-(--radius-md)" style="background: var(--surface-2)">
      <div #mapEl class="absolute inset-0"></div>
      <div class="absolute left-2 right-2 top-2 z-[500]">
        <input
          type="search" class="input !py-1.5 text-sm shadow" placeholder="Rechercher un lieu (quartier, marché, hôpital…)"
          aria-label="Rechercher un lieu" autocomplete="off" [value]="query()" (input)="onQuery($any($event.target).value)"
        />
        @if (results().length > 0) {
          <ul class="mt-1 rounded-(--radius-md) overflow-hidden shadow-lg max-h-56 overflow-y-auto" style="background: var(--surface-1); border: 1px solid var(--border-strong)">
            @for (r of results(); track r.id) {
              <li>
                <button type="button" class="w-full text-left px-3 py-2 text-sm hover:opacity-80" (click)="choose(r)">
                  <span class="font-medium">{{ r.nom }}</span>
                  <span class="block text-xs" style="color: var(--text-muted)">{{ r.quartier ? r.quartier + ' · ' : '' }}{{ r.ville }} · {{ r.type }}</span>
                </button>
              </li>
            }
          </ul>
        } @else if (searched() && query().trim().length >= 2) {
          <p class="mt-1 px-3 py-2 text-xs rounded-(--radius-md)" style="background: var(--surface-1); border: 1px solid var(--border-strong); color: var(--text-muted)">Aucun lieu trouvé — cliquez sur la carte pour placer le point.</p>
        }
      </div>
      @if (!value()) {
        <div class="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
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

  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly search$ = new Subject<string>();
  protected readonly query = signal('');
  protected readonly results = signal<Lieu[]>([]);
  protected readonly searched = signal(false);

  protected onQuery(v: string): void {
    this.query.set(v);
    if (v.trim().length < 2) { this.results.set([]); this.searched.set(false); }
    this.search$.next(v.trim());
  }

  protected choose(r: Lieu): void {
    this.results.set([]);
    this.query.set(r.nom);
    this.map?.setView([r.latitude, r.longitude], Math.max(this.map.getZoom(), 16));
    this.valueChange.emit({ lat: r.latitude, lng: r.longitude });
  }

  constructor() {
    this.search$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap((q) => (q.length < 2 ? of(null) : this.http.get<{ data: Lieu[] }>(`${this.baseUrl}/lieux`, { params: { q, limit: 8 } }).pipe(catchError(() => of(null))))),
      takeUntilDestroyed(),
    ).subscribe((res) => { this.results.set(res?.data ?? []); this.searched.set(res !== null); });

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
