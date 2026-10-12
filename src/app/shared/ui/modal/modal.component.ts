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
      <div class="fixed inset-0 z-2000 flex items-center justify-center p-4" role="presentation">
        <div class="absolute inset-0 backdrop-blur-[2px]" style="background: rgba(8, 20, 38, 0.45)" (click)="dismiss()" aria-hidden="true"></div>
        <div
          cdkTrapFocus cdkTrapFocusAutoCapture
          class="relative w-full card modal-panel shadow-(--shadow-lg) flex flex-col max-h-[90vh]"
          [class]="sizeClass()"
          role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId"
        >
          <div class="modal-head">
            <div class="min-w-0">
              <h2 [id]="titleId" class="modal-title">{{ title() }}</h2>
              @if (subtitle()) { <p class="modal-sub">{{ subtitle() }}</p> }
            </div>
            <button type="button" class="btn btn-ghost btn-sm !px-1.5 -mr-1 -mt-0.5" (click)="dismiss()" [attr.aria-label]="i18n.t('action.close')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="overflow-y-auto thin-scroll flex-1">
            <div class="modal-body">
              <ng-content></ng-content>
            </div>
          </div>
          @if (hasFooter()) {
            <div class="modal-foot">
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
