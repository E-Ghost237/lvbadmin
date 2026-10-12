import { Component, computed, input } from '@angular/core';
import { formatCompactNumber, formatPercent, formatXaf } from '../../../core/utils/formatters';

export type StatTileTone = 'neutral' | 'good' | 'warning' | 'critical';

/**
 * KPI tile: micro-label, big figure, optional target/trend footline and an
 * extra content slot (sparkline, breakdown…). A 3px accent strip only
 * appears when the value carries a tone, so neutral rows stay calm.
 */
@Component({
  selector: 'app-stat-tile',
  template: `
    <div class="card stat-tile transition-shadow hover:shadow-(--shadow-md)" [style.--tone]="toneStrip()">
      <div class="stat-tile-head">
        <p class="stat-tile-label">{{ label() }}</p>
        @if (badge()) {
          <span class="stat-tile-badge" [style.color]="toneColor()" [style.background]="toneBg()">{{ badge() }}</span>
        }
      </div>
      <p class="stat-tile-value" [style.color]="valueColor()">{{ formattedValue() }}</p>
      <div class="stat-tile-foot">
        @if (target() !== undefined) {
          <span>Cible : {{ formatValue(target()!) }}</span>
        }
        @if (trend() !== undefined) {
          <span class="inline-flex items-center gap-1 font-semibold" [style.color]="trend()! >= 0 ? 'var(--status-good)' : 'var(--status-critical)'">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" [style.transform]="trend()! < 0 ? 'rotate(180deg)' : 'none'" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            {{ formatPercent(abs(trend()!)) }}
          </span>
        }
      </div>
      <ng-content></ng-content>
    </div>
  `,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly unit = input<'%' | 'XAF' | 'min' | 's' | 'count'>('count');
  readonly target = input<number | undefined>(undefined);
  readonly trend = input<number | undefined>(undefined);
  readonly badge = input<string>('');
  readonly alertBelow = input<number | undefined>(undefined);
  readonly alertAbove = input<number | undefined>(undefined);

  readonly tone = computed<StatTileTone>(() => {
    const v = this.value();
    if (this.alertBelow() !== undefined && v < this.alertBelow()!) return 'critical';
    if (this.alertAbove() !== undefined && v > this.alertAbove()!) return 'critical';
    if (this.target() !== undefined) return v >= this.target()! ? 'good' : 'warning';
    return 'neutral';
  });

  readonly valueColor = computed(() => (this.tone() === 'neutral' ? 'var(--text-primary)' : `var(--status-${this.tone()})`));
  readonly toneColor = computed(() => `var(--status-${this.tone() === 'neutral' ? 'good' : this.tone()})`);
  readonly toneBg = computed(() => `var(--status-${this.tone() === 'neutral' ? 'good' : this.tone()}-bg)`);
  readonly toneStrip = computed(() =>
    this.tone() === 'neutral' ? 'transparent' : `color-mix(in srgb, var(--status-${this.tone()}) 70%, transparent)`,
  );

  readonly formattedValue = computed(() => this.formatValue(this.value()));

  formatValue(v: number): string {
    if (this.unit() === 'XAF') return formatXaf(v);
    if (this.unit() === '%') return formatPercent(v);
    if (this.unit() === 'min') return `${Math.round(v)} min`;
    if (this.unit() === 's') return `${Math.round(v)} s`;
    return formatCompactNumber(v);
  }

  formatPercent(v: number): string {
    return formatPercent(v);
  }

  abs(v: number): number {
    return Math.abs(v);
  }
}
