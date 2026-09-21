import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, booleanAttribute, computed, effect, forwardRef, inject,
  input, output, signal, untracked,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Fully custom single-select — native `<select>` renders its open options
 * list with the OS/browser's own UI, which no app CSS can restyle, so it
 * always looks out of place next to the rest of the design system. This
 * draws both the closed trigger and the open panel itself.
 *
 * Drop-in for either usage style already in the app:
 *   <app-select [options]="opts" formControlName="role" placeholder="…" />
 *   <app-select [options]="opts" [value]="filter()" (valueChange)="onFilter($event)" />
 */
@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
  template: `
    <div class="relative">
      <button
        type="button" class="select flex items-center justify-between gap-2 text-left cursor-pointer"
        role="combobox" aria-haspopup="listbox" [attr.aria-expanded]="open()" [attr.aria-label]="ariaLabel() || null"
        [disabled]="disabled()" (click)="toggle()" (keydown)="onTriggerKeydown($event)"
      >
        <span class="truncate" [style.color]="selectedLabel() ? 'var(--text-primary)' : 'var(--text-muted)'">
          {{ selectedLabel() || placeholder() || i18nSelectPlaceholder }}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          class="shrink-0 transition-transform" [style.transform]="open() ? 'rotate(180deg)' : 'none'"
          style="color: var(--text-muted)" aria-hidden="true"
        ><path d="m6 9 6 6 6-6" /></svg>
      </button>

      @if (open()) {
        <ul
          role="listbox" [attr.aria-activedescendant]="activeId()"
          class="absolute z-40 mt-1.5 w-full max-h-64 overflow-y-auto thin-scroll py-1 rounded-(--radius-sm)"
          style="background: var(--surface-1); border: 1px solid var(--border-strong); box-shadow: var(--shadow-md)"
        >
          @if (placeholder() && allowClear()) {
            <li
              role="option" [id]="optionId('')" [attr.aria-selected]="currentValue() === ''"
              class="px-3 py-2 text-sm cursor-pointer transition-colors" tabindex="-1"
              [style.background]="highlightedIndex() === -1 ? 'var(--surface-2)' : 'transparent'"
              style="color: var(--text-muted)" (mouseenter)="highlightedIndex.set(-1)" (click)="select('')"
            >{{ placeholder() }}</li>
          }
          @for (opt of options(); track opt.value; let i = $index) {
            <li
              role="option" [id]="optionId(opt.value)" [attr.aria-selected]="currentValue() === opt.value"
              class="px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between gap-2" tabindex="-1"
              [style.background]="highlightedIndex() === i ? 'var(--surface-2)' : 'transparent'"
              [style.color]="currentValue() === opt.value ? 'var(--brand)' : 'var(--text-primary)'"
              [style.fontWeight]="currentValue() === opt.value ? 600 : 400"
              (mouseenter)="highlightedIndex.set(i)" (click)="select(opt.value)"
            >
              <span class="truncate">{{ opt.label }}</span>
              @if (currentValue() === opt.value) {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              }
            </li>
          } @empty {
            <li class="px-3 py-2 text-sm" style="color: var(--text-muted)">Aucune option.</li>
          }
        </ul>
      }
    </div>
  `,
})
export class SelectComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private static nextId = 0;
  private readonly instanceId = `app-select-${SelectComponent.nextId++}`;

  protected readonly i18nSelectPlaceholder = 'Sélectionner…';

  readonly options = input.required<SelectOption[]>();
  readonly placeholder = input<string>('');
  readonly ariaLabel = input<string>('');
  /** Whether the placeholder itself is a selectable "clear" option (e.g. "Tous les statuts"). Defaults to true. */
  readonly allowClear = input(true, { transform: booleanAttribute });
  readonly value = input<string>('');
  readonly valueChange = output<string>();
  /** Plain-binding disabled, e.g. `[disabled]="loading()"` outside a reactive form. */
  readonly disabledInput = input(false, { alias: 'disabled', transform: booleanAttribute });

  protected readonly open = signal(false);
  protected readonly highlightedIndex = signal(-1);
  private readonly cvaDisabled = signal(false);
  protected readonly disabled = computed(() => this.disabledInput() || this.cvaDisabled());

  private onChange: ((value: string) => void) | null = null;
  private onTouched: (() => void) | null = null;
  /** True only once Angular forms actually binds this control (`registerOnChange` ran) — otherwise the plain `value()` input stays the single source of truth, so it keeps tracking external updates after a selection. */
  private readonly isFormControlled = signal(false);
  private readonly formValue = signal('');

  protected readonly currentValue = computed(() => (this.isFormControlled() ? this.formValue() : this.value()));

  protected readonly selectedLabel = computed(() => {
    const current = this.currentValue();
    return this.options().find((o) => o.value === current)?.label ?? '';
  });

  protected readonly activeId = computed(() => {
    const i = this.highlightedIndex();
    if (i === -1) return this.optionId('');
    return this.optionId(this.options()[i]?.value ?? '');
  });

  constructor() {
    effect(() => {
      // Keep the highlighted row in sync with the current value whenever the panel opens.
      if (!this.open()) return;
      const current = untracked(() => this.currentValue());
      const idx = this.options().findIndex((o) => o.value === current);
      this.highlightedIndex.set(idx);
    });
  }

  optionId(value: string): string {
    return `${this.instanceId}-${value || 'clear'}`;
  }

  toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (!this.open()) this.onTouched?.();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
      this.onTouched?.();
    }
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const options = this.options();
    if (!this.open()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.open.set(true);
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex.update((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update((i) => Math.max(i - 1, this.placeholder() && this.allowClear() ? -1 : 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        { const i = this.highlightedIndex(); this.select(i === -1 ? '' : options[i].value); }
        break;
      case 'Escape':
        event.preventDefault();
        this.open.set(false);
        this.onTouched?.();
        break;
    }
  }

  select(value: string): void {
    this.formValue.set(value);
    this.open.set(false);
    this.onChange?.(value);
    this.onTouched?.();
    this.valueChange.emit(value);
  }

  // --- ControlValueAccessor ---------------------------------------------

  writeValue(value: string | null): void {
    this.formValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.isFormControlled.set(true);
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }
}
