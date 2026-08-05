import { Component, computed, input } from '@angular/core';
import { formatCompactNumber, formatPercent, formatXaf } from '../../../core/utils/formatters';

export type StatTileTone = 'neutral' | 'good' | 'warning' | 'critical';

@Component({
  selector: 'app-stat-tile',
  template: `
    <div class="card p-4 flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-medium" style="color: var(--text-muted)">{{ label() }}</p>
        @if (badge()) {
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" [style.color]="toneColor()" [style.background]="toneBg()">{{ badge() }}</span>
        }
      </div>
      <p class="text-2xl font-semibold tabular-nums" [style.color]="valueColor()">{{ formattedValue() }}</p>
      <div class="flex items-center justify-between gap-2 min-h-[18px]">
        @if (target() !== undefined) {
          <p class="text-[11px]" style="color: var(--text-muted)">Cible : {{ formatValue(target()!) }}</p>
        }
        @if (trend() !== undefined) {
          <p class="text-[11px] font-medium flex items-center gap-0.5" [style.color]="trend()! >= 0 ? 'var(--status-good)' : 'var(--status-critical)'">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" [style.transform]="trend()! < 0 ? 'rotate(180deg)' : 'none'"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            {{ formatPercent(abs(trend()!)) }}
          </p>
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
