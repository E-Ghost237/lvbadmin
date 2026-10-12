import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-status-page',
  imports: [RouterLink],
  template: `
    <div class="flex min-h-[62vh] flex-col items-center justify-center gap-3.5 text-center py-10">
      <span class="icon-chip" style="height: 54px; width: 54px; border-radius: 17px; background: var(--app-accent-soft); color: var(--app-accent-ink)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
        </svg>
      </span>
      <p class="font-heading text-4xl font-extrabold tracking-tight" style="color: var(--app-accent)">{{ code() }}</p>
      <h1 class="text-lg font-semibold">{{ title() }}</h1>
      <p class="text-sm max-w-sm leading-relaxed" style="color: var(--text-muted)">{{ message() }}</p>
      <a routerLink="/" class="btn btn-primary mt-2">Retour à l’accueil</a>
    </div>
  `,
})
export class StatusPageComponent {
  readonly code = input('404');
  readonly title = input('Page introuvable');
  readonly message = input('La page que vous cherchez n’existe pas ou a été déplacée.');
}
