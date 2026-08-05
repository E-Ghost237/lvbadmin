import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-status-page',
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center gap-3 text-center p-6" style="background: var(--surface-0)">
      <p class="text-5xl font-bold" style="color: var(--brand)">{{ code() }}</p>
      <h1 class="text-lg font-semibold">{{ title() }}</h1>
      <p class="text-sm max-w-sm" style="color: var(--text-muted)">{{ message() }}</p>
      <a routerLink="/" class="btn btn-primary mt-3">Retour à l’accueil</a>
    </div>
  `,
})
export class StatusPageComponent {
  readonly code = input('404');
  readonly title = input('Page introuvable');
  readonly message = input('La page que vous cherchez n’existe pas ou a été déplacée.');
}
