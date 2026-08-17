import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ModalComponent } from '../modal/modal.component';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-host',
  imports: [ModalComponent],
  template: `
    @if (confirm.pending(); as request) {
      <app-modal [open]="true" [title]="request.title" size="sm" [dismissible]="false" (closed)="confirm.resolve(false)">
        <p class="text-sm" style="color: var(--text-secondary)">{{ request.message }}</p>
        <div modal-footer class="flex gap-2">
          <button type="button" class="btn btn-secondary btn-sm" (click)="confirm.resolve(false)">{{ request.cancelLabel || i18n.t('action.cancel') }}</button>
          <button type="button" [class]="request.danger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'" (click)="confirm.resolve(true)">
            {{ request.confirmLabel || i18n.t('action.confirm') }}
          </button>
        </div>
      </app-modal>
    }

    @if (confirm.pendingReason(); as request) {
      <app-modal [open]="true" [title]="request.title" size="sm" [dismissible]="false" (closed)="cancelReason()">
        @if (request.message) { <p class="text-sm mb-3" style="color: var(--text-secondary)">{{ request.message }}</p> }
        <label class="field-label">{{ request.label }}</label>
        <textarea
          class="textarea" rows="3" [placeholder]="request.placeholder || ''"
          [value]="reasonValue()" (input)="reasonValue.set($any($event.target).value)"
        ></textarea>
        @if ((request.minLength || 0) > 0) {
          <p class="field-hint">Minimum {{ request.minLength }} caractères.</p>
        }
        <div modal-footer class="flex gap-2">
          <button type="button" class="btn btn-secondary btn-sm" (click)="cancelReason()">{{ request.cancelLabel || i18n.t('action.cancel') }}</button>
          <button
            type="button" [class]="request.danger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'"
            [disabled]="reasonValue().trim().length < (request.minLength || 1)" (click)="submitReason()"
          >
            {{ request.confirmLabel || i18n.t('action.confirm') }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly reasonValue = signal('');

  submitReason(): void {
    const value = this.reasonValue().trim();
    this.reasonValue.set('');
    this.confirm.resolveReason(value);
  }

  cancelReason(): void {
    this.reasonValue.set('');
    this.confirm.resolveReason(null);
  }
}
