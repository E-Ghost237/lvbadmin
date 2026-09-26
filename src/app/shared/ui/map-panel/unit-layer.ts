import * as L from 'leaflet';
import { UNIT_KIND_LABEL, UnitKind, unitSvg } from './unit-icons';

/** A moving unit on the map: a courier or driver with a vehicle. */
export interface FleetUnit {
  id: string;
  point: { lat: number; lng: number };
  kind: UnitKind;
  name: string;
  phone: string | null;
  /** Backend operational status: DISPONIBLE, EN_MISSION, PAUSE, HORS_LIGNE. */
  status: string;
  statusLabel: string;
  /** Second line: matricule / plate / role. */
  subtitle?: string | null;
  updatedAt?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  DISPONIBLE: '#2E9E44', EN_MISSION: '#004AAD', PAUSE: '#E8830C', HORS_LIGNE: '#6B7686',
};
const STATUS_TEXT: Record<string, string> = {
  DISPONIBLE: 'En ligne — disponible', EN_MISSION: 'En livraison', PAUSE: 'En pause', HORS_LIGNE: 'Hors ligne',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!);

function ago(iso: string | null | undefined): string {
  if (!iso) return 'position inconnue';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86_400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86_400)} j`;
}

function bearing(a: L.LatLng, b: L.LatLng): number {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

interface Entry { marker: L.Marker; from: L.LatLng; to: L.LatLng; t0: number; heading: number; kind: UnitKind; color: string }

const MOVE_MS = 1800;

/**
 * Draws units as vehicle icons that (a) slide smoothly to each new position and turn toward the
 * direction of travel, (b) grow/shrink with the map zoom instead of staying one fixed size, and
 * (c) show a small card (name, phone, status) on hover.
 */
export class UnitLayer {
  private readonly group: L.LayerGroup;
  private readonly entries = new Map<string, Entry>();
  private raf = 0;

  constructor(private readonly map: L.Map) {
    this.group = L.layerGroup().addTo(map);
    map.on('zoomend', this.applyScale);
    this.applyScale();
  }

  /** Icon scale by zoom: small when zoomed out (city overview), full size when zoomed in on a street. */
  private readonly applyScale = (): void => {
    const z = this.map.getZoom();
    const s = Math.max(0.42, Math.min(1.25, 0.5 + (z - 11) * 0.11));
    this.map.getContainer().style.setProperty('--unit-scale', String(s));
  };

  update(units: FleetUnit[]): void {
    const seen = new Set<string>();
    for (const u of units) {
      seen.add(u.id);
      const target = L.latLng(u.point.lat, u.point.lng);
      const color = STATUS_COLOR[u.status] ?? '#6B7686';
      const existing = this.entries.get(u.id);
      if (!existing) {
        const marker = L.marker(target, { icon: this.icon(u, color, 0), riseOnHover: true, zIndexOffset: u.status === 'EN_MISSION' ? 500 : 0 })
          .bindTooltip(this.card(u), { direction: 'top', offset: [0, -18], opacity: 1, className: 'unit-card' })
          .on('click', (e) => e.target.openTooltip())
          .addTo(this.group);
        this.entries.set(u.id, { marker, from: target, to: target, t0: 0, heading: 0, kind: u.kind, color });
        continue;
      }
      const cur = existing.marker.getLatLng();
      if (cur.distanceTo(target) > 2) {
        existing.heading = cur.distanceTo(target) > 4 ? bearing(cur, target) : existing.heading;
        existing.from = cur;
        existing.to = target;
        existing.t0 = performance.now();
      }
      if (existing.kind !== u.kind || existing.color !== color) { existing.kind = u.kind; existing.color = color; }
      existing.marker.setIcon(this.icon(u, color, existing.heading));
      existing.marker.setTooltipContent(this.card(u));
      existing.marker.setZIndexOffset(u.status === 'EN_MISSION' ? 500 : 0);
    }
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) { e.marker.remove(); this.entries.delete(id); }
    }
    this.kick();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.map.off('zoomend', this.applyScale);
    this.group.remove();
    this.entries.clear();
  }

  private kick(): void {
    if (this.raf) return;
    const step = (now: number): void => {
      let moving = false;
      for (const e of this.entries.values()) {
        if (!e.t0) continue;
        const t = Math.min(1, (now - e.t0) / MOVE_MS);
        const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
        e.marker.setLatLng([e.from.lat + (e.to.lat - e.from.lat) * k, e.from.lng + (e.to.lng - e.from.lng) * k]);
        if (t < 1) moving = true; else e.t0 = 0;
      }
      this.raf = moving ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }

  private icon(u: FleetUnit, color: string, heading: number): L.DivIcon {
    const off = u.status === 'HORS_LIGNE';
    return L.divIcon({
      className: 'unit-icon',
      html: `<div class="unit${off ? ' unit-off' : ''}" style="--ring:${color}"><span class="unit-ring"></span><span class="unit-body" style="--rot:${Math.round(heading)}deg">${unitSvg(u.kind, color)}</span></div>`,
      iconSize: [48, 48], iconAnchor: [24, 24],
    });
  }

  private card(u: FleetUnit): string {
    const color = STATUS_COLOR[u.status] ?? '#6B7686';
    const text = u.statusLabel || STATUS_TEXT[u.status] || u.status;
    return `<div class="unit-card-body">
      <div class="unit-card-name">${esc(u.name || 'Livreur')}</div>
      <div class="unit-card-sub">${esc(UNIT_KIND_LABEL[u.kind])}${u.subtitle ? ' · ' + esc(u.subtitle) : ''}</div>
      ${u.phone ? `<div class="unit-card-phone">☎ ${esc(u.phone)}</div>` : ''}
      <div class="unit-card-status"><span style="background:${color}"></span>${esc(text)}</div>
      <div class="unit-card-time">${esc(ago(u.updatedAt))}</div>
    </div>`;
  }
}
