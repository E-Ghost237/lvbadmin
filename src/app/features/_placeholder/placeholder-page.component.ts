import { Component, input } from '@angular/core';

/** Temporary scaffolding placeholder — replaced module by module as each feature is built out. */
@Component({
  selector: 'app-placeholder-page',
  template: `
    <div class="card p-10 flex flex-col items-center text-center gap-2">
      <p class="text-sm font-medium">{{ title() }}</p>
      <p class="text-xs" style="color: var(--text-muted)">Ce module est en cours de construction.</p>
    </div>
  `,
})
export class PlaceholderPageComponent {
  readonly title = input('Module');
}
