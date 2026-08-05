import { A11yModule } from '@angular/cdk/a11y';
import { Component, HostListener, inject, input, output } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ModalSize, string> = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

/**
 * Declarative modal: `<app-modal [open]="show()" title="…" (closed)="show.set(false)">…</app-modal>`.
 * Traps focus (cdkTrapFocus), closes on Escape/backdrop click, restores scroll — WEB-06 keyboard access.
 */
@Component({
  selector: 'app-modal',
  imports: [A11yModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
        <div class="absolute inset-0 bg-black/40" (click)="dismiss()" aria-hidden="true"></div>
        <div
          cdkTrapFocus cdkTrapFocusAutoCapture
          class="relative w-full card shadow-(--shadow-lg) flex flex-col max-h-[90vh]"
          [class]="sizeClass()"
          role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId"
        >
          <div class="flex items-start justify-between gap-4 px-5 py-4 border-b" style="border-color: var(--border)">
            <div>
              <h2 [id]="titleId" class="text-base font-semibold">{{ title() }}</h2>
              @if (subtitle()) { <p class="text-xs mt-0.5" style="color: var(--text-muted)">{{ subtitle() }}</p> }
            </div>
            <button type="button" class="btn btn-ghost btn-sm !px-1.5" (click)="dismiss()" [attr.aria-label]="i18n.t('action.close')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="overflow-y-auto px-5 py-4 thin-scroll">
            <ng-content></ng-content>
          </div>
          @if (hasFooter()) {
            <div class="flex items-center justify-end gap-2 px-5 py-3.5 border-t" style="border-color: var(--border)">
              <ng-content select="[modal-footer]"></ng-content>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;

  readonly open = input(false);
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly size = input<ModalSize>('md');
  readonly hasFooter = input(true);
  readonly dismissible = input(true);

  readonly closed = output<void>();

  protected readonly sizeClass = () => SIZE_CLASS[this.size()];

  dismiss(): void {
    if (this.dismissible()) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.dismiss();
  }
}
