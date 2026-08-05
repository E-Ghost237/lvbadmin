import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  timeoutMs: number;
}

let counter = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(title: string, message?: string): void {
    this.push('success', title, message);
  }

  error(title: string, message?: string): void {
    this.push('error', title, message, 7000);
  }

  info(title: string, message?: string): void {
    this.push('info', title, message);
  }

  warning(title: string, message?: string): void {
    this.push('warning', title, message, 6000);
  }

  dismiss(id: string): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], title: string, message?: string, timeoutMs = 4500): void {
    const id = `toast-${++counter}`;
    this._toasts.update((list) => [...list, { id, kind, title, message, timeoutMs }]);
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => this.dismiss(id), timeoutMs);
    }
  }
}
