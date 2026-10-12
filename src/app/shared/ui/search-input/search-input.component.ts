import { Component, DestroyRef, inject, input, output } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-search-input',
  template: `
    <div class="relative">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-muted)" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search" class="input !pl-9 !pr-9" [placeholder]="placeholder() || i18n.t('action.search')"
        [value]="value" (input)="onInput($event)" [attr.aria-label]="placeholder() || i18n.t('action.search')"
      />
      @if (value) {
        <button
          type="button" class="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-(--surface-2)"
          style="color: var(--text-muted)" [attr.aria-label]="i18n.t('action.clear')" (click)="clear()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      }
    </div>
  `,
})
export class SearchInputComponent {
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly placeholder = input<string>('');
  readonly debounceMs = input(300);
  readonly searchChange = output<string>();

  value = '';
  private readonly input$ = new Subject<string>();

  constructor() {
    const sub = this.input$.pipe(debounceTime(this.debounceMs()), distinctUntilChanged()).subscribe((v) => this.searchChange.emit(v.trim().length < 2 ? '' : v.trim()));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  onInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.input$.next(this.value);
  }

  clear(): void {
    this.value = '';
    this.input$.next('');
  }
}
