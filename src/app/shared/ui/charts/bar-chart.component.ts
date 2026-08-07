import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

export interface ChartPoint {
  label: string;
  value: number;
}

/** Small vertical bar chart — single hue, 4px rounded data-ends, 2px surface gap, hover tooltip. */
@Component({
  selector: 'app-bar-chart',
  imports: [DecimalPipe],
  template: `
    <div class="relative">
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [style.width.%]="100" [style.height.px]="height()" role="img" [attr.aria-label]="ariaLabel()" preserveAspectRatio="none">
        <line x1="0" [attr.y1]="height() - 16" [attr.x2]="width()" [attr.y2]="height() - 16" [attr.stroke]="'var(--grid)'" stroke-width="1" />
        @for (bar of bars(); track bar.label; let i = $index) {
          <rect
            [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="barWidth()" [attr.height]="bar.h"
            [attr.rx]="3" [attr.fill]="color()" [attr.opacity]="hovered() === i ? 1 : 0.85"
            (mouseenter)="hovered.set(i)" (mouseleave)="hovered.set(null)" (focus)="hovered.set(i)" (blur)="hovered.set(null)"
            tabindex="0" [attr.aria-label]="bar.label + ': ' + bar.value"
          />
        }
      </svg>
      <div class="flex text-[10px] mt-1" style="color: var(--text-muted)">
        @for (bar of bars(); track bar.label) {
          <span class="text-center" [style.width.%]="100 / bars().length">{{ bar.label }}</span>
        }
      </div>
      @if (hovered() !== null && bars()[hovered()!]; as b) {
        <div class="absolute -top-7 px-2 py-1 rounded-(--radius-sm) text-[11px] font-medium tabular-nums shadow-(--shadow-md) pointer-events-none"
             style="background: var(--surface-2); border: 1px solid var(--border); transform: translateX(-50%)"
             [style.left.px]="b.x + barWidth() / 2">
          {{ b.value | number:'1.0-0' }}
        </div>
      }
    </div>
  `,
})
export class BarChartComponent {
  readonly points = input.required<ChartPoint[]>();
  readonly width = input(320);
  readonly height = input(120);
  readonly color = input('var(--brand)');
  readonly ariaLabel = input('Graphique');

  readonly hovered = signal<number | null>(null);

  readonly barWidth = computed(() => {
    const n = this.points().length || 1;
    const gap = 3;
    return Math.max(4, this.width() / n - gap);
  });

  readonly bars = computed(() => {
    const pts = this.points();
    const max = Math.max(...pts.map((p) => p.value), 1);
    const chartH = this.height() - 16;
    const n = pts.length || 1;
    const slot = this.width() / n;
    return pts.map((p, i) => {
      const h = (p.value / max) * (chartH - 4);
      return { label: p.label, value: p.value, x: i * slot + (slot - this.barWidth()) / 2, y: chartH - h, h: Math.max(h, 1) };
    });
  });
}
