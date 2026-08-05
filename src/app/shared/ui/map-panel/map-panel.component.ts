import { Component, computed, input, output } from '@angular/core';
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

const TONE_COLOR: Record<MapMarker['tone'], string> = {
  good: 'var(--status-good)', warning: 'var(--status-warning)', critical: 'var(--status-critical)',
  neutral: 'var(--status-neutral)', info: 'var(--brand)',
};

/**
 * Abstracted city map — normalizes lat/lng into an SVG viewport (no external
 * mapping provider wired yet, per §11.5). Swap for MapLibre/Google Maps SDK
 * once API keys and OSRM/MapLibre are provisioned; markers/zones inputs are
 * already provider-agnostic so only this component's internals would change.
 */
@Component({
  selector: 'app-map-panel',
  template: `
    <div class="relative w-full overflow-hidden rounded-(--radius-md)" [style.height.px]="height()" style="background: var(--surface-2)">
      <svg [attr.viewBox]="'0 0 100 100'" preserveAspectRatio="none" class="w-full h-full">
        <defs>
          <pattern id="grid-pattern" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" [attr.stroke]="'var(--grid)'" stroke-width="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid-pattern)" />
        @for (zone of zones(); track zone.id) {
          <circle [attr.cx]="project(zone.center).x" [attr.cy]="project(zone.center).y" [attr.r]="zone.radiusKm * kmScale()" [attr.fill]="zone.color" fill-opacity="0.12" [attr.stroke]="zone.color" stroke-width="0.4" stroke-opacity="0.5" />
        }
        @for (marker of markers(); track marker.id) {
          <circle
            [attr.cx]="project(marker.point).x" [attr.cy]="project(marker.point).y" r="1.6"
            [attr.fill]="toneColor(marker.tone)" stroke="white" stroke-width="0.5"
            class="cursor-pointer" (click)="markerClick.emit(marker.id)"
          >
            <title>{{ marker.label }}</title>
          </circle>
        }
      </svg>
      <div class="absolute bottom-2 left-2 flex flex-wrap gap-2 px-2 py-1.5 rounded-(--radius-sm) text-[10px]" style="background: var(--surface-1); border: 1px solid var(--border)">
        <ng-content select="[legend]"></ng-content>
      </div>
      @if (markers().length === 0 && zones().length === 0) {
        <div class="absolute inset-0 flex items-center justify-center text-xs" style="color: var(--text-muted)">Aucune position à afficher</div>
      }
    </div>
  `,
})
export class MapPanelComponent {
  readonly bbox = input.required<{ latMin: number; latMax: number; lngMin: number; lngMax: number }>();
  readonly markers = input<MapMarker[]>([]);
  readonly zones = input<MapZoneShape[]>([]);
  readonly height = input(320);

  readonly markerClick = output<string>();

  readonly kmScale = computed(() => {
    const b = this.bbox();
    const latSpanKm = (b.latMax - b.latMin) * 111;
    return latSpanKm > 0 ? 100 / latSpanKm : 1;
  });

  project(point: GeoPoint): { x: number; y: number } {
    const b = this.bbox();
    const x = ((point.lng - b.lngMin) / (b.lngMax - b.lngMin || 1)) * 100;
    const y = 100 - ((point.lat - b.latMin) / (b.latMax - b.latMin || 1)) * 100;
    return { x: Math.min(98, Math.max(2, x)), y: Math.min(98, Math.max(2, y)) };
  }

  toneColor(tone: MapMarker['tone']): string {
    return TONE_COLOR[tone];
  }
}
