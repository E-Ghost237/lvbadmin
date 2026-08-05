import { Component, computed, input } from '@angular/core';
import { initials } from '../../../core/utils/formatters';

const PALETTE = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

@Component({
  selector: 'app-avatar',
  template: `
    <span
      class="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      [style.background]="color()"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.fontSize.px]="size() / 2.4"
    >{{ initials() }}</span>
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(32);

  readonly initials = computed(() => initials(this.name()));
  readonly color = computed(() => hashColor(this.name()));
}
