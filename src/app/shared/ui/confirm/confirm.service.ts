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

export interface ReasonRequest {
  title: string;
  /** Optional context line above the text field (e.g. who/what is affected). */
  message?: string;
  /** Field label — e.g. "Motif de suspension". */
  label: string;
  placeholder?: string;
  minLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingReason extends ReasonRequest {
  resolve: (value: string | null) => void;
}

/**
 * Imperative confirmation dialogs for irreversible actions ("cette action ne
 * peut pas être annulée"). One `<app-confirm-host>` lives in the shell.
 *
 * - `ask({...})` — plain yes/no confirm, resolves `boolean`.
 * - `askReason({...})` — confirm + a required free-text reason in one modal
 *   (replaces `window.prompt`, which renders as a bare, unstyled browser
 *   dialog and can't be dismissed/styled to match the app); resolves the
 *   trimmed string, or `null` if cancelled.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  private readonly _pendingReason = signal<PendingReason | null>(null);
  readonly pendingReason = this._pendingReason.asReadonly();

  ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._pending.set({ ...request, resolve });
    });
  }

  resolve(value: boolean): void {
    this._pending()?.resolve(value);
    this._pending.set(null);
  }

  askReason(request: ReasonRequest): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      this._pendingReason.set({ ...request, resolve });
    });
  }

  resolveReason(value: string | null): void {
    this._pendingReason()?.resolve(value);
    this._pendingReason.set(null);
  }
}
