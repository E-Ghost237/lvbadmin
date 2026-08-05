import { Component, computed, input } from '@angular/core';
import { KpiPoint } from '../../../core/models';

/** Single-series trend line — thin 2px stroke, rounded end anchored to the last value, no axis clutter. */
@Component({
  selector: 'app-sparkline',
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [style.width.px]="width()" [style.height.px]="height()" role="img" [attr.aria-label]="ariaLabel()">
      <path [attr.d]="areaPath()" [attr.fill]="color()" fill-opacity="0.12" stroke="none" />
      <path [attr.d]="linePath()" fill="none" [attr.stroke]="color()" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      @if (lastPoint(); as p) {
        <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3" [attr.fill]="color()" />
      }
    </svg>
    <table class="sr-only">
      <caption>{{ ariaLabel() }}</caption>
      <tbody>
        @for (pt of points(); track pt.label) { <tr><th scope="row">{{ pt.label }}</th><td>{{ pt.value }}</td></tr> }
      </tbody>
    </table>
  `,
})
export class SparklineComponent {
  readonly points = input.required<KpiPoint[]>();
  readonly width = input(160);
  readonly height = input(40);
  readonly color = input('var(--brand)');
  readonly ariaLabel = input('Tendance');

  private readonly scaled = computed(() => {
    const pts = this.points();
    if (!pts.length) return [];
    const values = pts.map((p) => p.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = max - min || 1;
    const w = this.width();
    const h = this.height();
    const stepX = pts.length > 1 ? w / (pts.length - 1) : 0;
    return pts.map((p, i) => ({ x: i * stepX, y: h - ((p.value - min) / range) * (h - 6) - 3 }));
  });

  readonly linePath = computed(() => this.scaled().map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  readonly areaPath = computed(() => {
    const pts = this.scaled();
    if (!pts.length) return '';
    const h = this.height();
    return `M${pts[0].x},${h} ` + pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` L${pts[pts.length - 1].x},${h} Z`;
  });
  readonly lastPoint = computed(() => this.scaled().at(-1) ?? null);
}
