import { Component, input } from '@angular/core';

/**
 * The backend never hands the frontend a role/permission list, so nothing is
 * gated speculatively client-side — every `permission:xxx` middleware on the
 * server is the real gate. When it rejects a call with a 403, this is what
 * the page shows instead of a blank screen or a broken table.
 */
@Component({
  selector: 'app-forbidden-state',
  template: `
    <div class="card">
      <div class="state-block">
        <div class="state-icon" style="background: var(--status-critical-bg); color: var(--status-critical)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <div>
          <p class="state-title">Accès refusé</p>
          <p class="state-hint mt-1">{{ detail() || 'Votre compte n’a pas la permission nécessaire pour cette action.' }}</p>
        </div>
      </div>
    </div>
  `,
})
export class ForbiddenStateComponent {
  readonly detail = input<string>('');
}

/** Type guard: is this ProblemDetails-shaped error a 403 from the server? */
export function isForbidden(err: unknown): err is { status: number; detail: string } {
  return typeof err === 'object' && err !== null && 'status' in err && (err as { status: unknown }).status === 403;
}
