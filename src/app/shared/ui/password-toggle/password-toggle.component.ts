import { Component, ElementRef, inject, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * Wraps a password `<input>` and adds an eye button that reveals/hides what was typed:
 *
 *   <app-password-toggle><input type="password" formControlName="password" /></app-password-toggle>
 *
 * The input keeps its own form binding; only its `type` attribute is switched.
 */
@Component({
  selector: 'app-password-toggle',
  template: `
    <div class="relative">
      <ng-content />
      <button
        type="button" class="absolute inset-y-0 right-0 flex items-center px-3" style="color: var(--text-muted)"
        [attr.aria-label]="visible() ? i18n.t('auth.password.hide') : i18n.t('auth.password.show')"
        [attr.aria-pressed]="visible()" [title]="visible() ? i18n.t('auth.password.hide') : i18n.t('auth.password.show')"
        (click)="toggle()"
      >
        @if (visible()) {
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22" />
          </svg>
        } @else {
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        }
      </button>
    </div>
  `,
  styles: [`:host { display: block; } :host ::ng-deep input { padding-right: 2.75rem; }`],
})
export class PasswordToggleComponent {
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly visible = signal(false);

  toggle(): void {
    const input = this.host.nativeElement.querySelector('input');
    if (!input) return;
    this.visible.update((v) => !v);
    input.type = this.visible() ? 'text' : 'password';
    input.focus();
  }
}
