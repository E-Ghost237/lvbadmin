import { Component, inject } from '@angular/core';
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
        <div modal-footer>
          <button type="button" class="btn btn-secondary btn-sm" (click)="confirm.resolve(false)">{{ request.cancelLabel || i18n.t('action.cancel') }}</button>
          <button type="button" [class]="request.danger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'" (click)="confirm.resolve(true)">
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
}
