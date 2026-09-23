import {
  ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, effect, forwardRef, inject, input,
  output, signal, untracked, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';

export interface SelectOption {
  value: string;
  label: string;
}

const PANEL_POSITIONS: ConnectionPositionPair[] = [
  new ConnectionPositionPair({ originX: 'start', originY: 'bottom' }, { overlayX: 'start', overlayY: 'top' }, 0, 4),
  new ConnectionPositionPair({ originX: 'start', originY: 'top' }, { overlayX: 'start', overlayY: 'bottom' }, 0, -4),
];

/**
 * Fully custom single-select — native `<select>` renders its open options
 * list with the OS/browser's own UI, which no app CSS can restyle, so it
 * always looks out of place next to the rest of the design system. This
 * draws both the closed trigger and the open panel itself.
 *
 * The open panel is portaled through the CDK overlay container (a single
 * element appended once to `<body>`, see `.cdk-overlay-container` in
 * styles.css) rather than `position: absolute` inside this component's own
 * wrapper — otherwise any scrollable ancestor (most notably `app-modal`'s
 * own `overflow-y-auto` content area) would silently clip the panel
 * whenever it needed more room than was left in the visible area.
 *
 * Drop-in for either usage style already in the app:
 *   <app-select [options]="opts" formControlName="role" placeholder="…" />
 *   <app-select [options]="opts" [value]="filter()" (valueChange)="onFilter($event)" />
 */
@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [OverlayModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
  template: `
    <div class="relative">
      <button
        #trigger cdkOverlayOrigin #origin="cdkOverlayOrigin"
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

      <ng-template
        cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
        [cdkConnectedOverlayWidth]="panelWidth()" [cdkConnectedOverlayPositions]="positions"
        (overlayOutsideClick)="onOverlayOutsideClick($event)" (detach)="open.set(false)"
      >
        <ul
          role="listbox" [attr.aria-activedescendant]="activeId()"
          class="max-h-64 overflow-y-auto thin-scroll py-1 rounded-(--radius-sm)"
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
      </ng-template>
    </div>
  `,
})
export class SelectComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private static nextId = 0;
  private readonly instanceId = `app-select-${SelectComponent.nextId++}`;

  protected readonly i18nSelectPlaceholder = 'Sélectionner…';
  protected readonly positions = PANEL_POSITIONS;

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
  protected readonly panelWidth = signal(0);
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
    const next = !this.open();
    if (next) this.panelWidth.set(this.triggerRef()?.nativeElement.offsetWidth ?? this.host.nativeElement.offsetWidth);
    this.open.set(next);
    if (!next) this.onTouched?.();
  }

  onOverlayOutsideClick(event: MouseEvent): void {
    // The trigger button's own (click) already toggles — treat a click back on it as "handled there", not as an outside click that would immediately re-close what toggle() just opened.
    if (this.triggerRef()?.nativeElement.contains(event.target as Node)) return;
    this.open.set(false);
    this.onTouched?.();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const options = this.options();
    if (!this.open()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.toggle();
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
