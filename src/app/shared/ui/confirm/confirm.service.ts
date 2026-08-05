import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (value: boolean) => void;
}

/**
 * Imperative confirmation dialog for irreversible actions ("cette action ne peut
 * pas être annulée"). One `<app-confirm-host>` lives in the shell; call
 * `confirmService.ask({...})` and `await`/subscribe the resulting promise.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._pending.set({ ...request, resolve });
    });
  }

  resolve(value: boolean): void {
    this._pending()?.resolve(value);
    this._pending.set(null);
  }
}
