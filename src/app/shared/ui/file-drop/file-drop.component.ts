import { Component, computed, inject, output, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * Drag/click file picker with client-side type+size validation (SEC-26 posture:
 * whitelist MIME types, size cap — the real upload endpoint re-validates server-side).
 */
@Component({
  selector: 'app-file-drop',
  template: `
    <div
      class="flex flex-col items-center justify-center gap-2 rounded-(--radius-md) border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors"
      [style.borderColor]="dragOver() ? 'var(--brand)' : 'var(--border-strong)'"
      [style.background]="dragOver() ? 'var(--brand-50)' : 'transparent'"
      (click)="fileInput.click()"
      (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)"
      tabindex="0" role="button" [attr.aria-label]="'Téléverser un fichier'"
      (keydown.enter)="fileInput.click()"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.6" aria-hidden="true"><path d="M12 16V4M12 4 7 9M12 4l5 5" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></svg>
      @if (selected(); as file) {
        <p class="text-xs font-medium">{{ file.name }}</p>
        <p class="text-[11px]" style="color: var(--text-muted)">{{ (file.size / 1024 / 1024).toFixed(2) }} Mo</p>
      } @else {
        <p class="text-xs font-medium">Glissez un fichier ou cliquez pour parcourir</p>
        <p class="text-[11px]" style="color: var(--text-muted)">JPEG, PNG ou PDF — 5 Mo maximum</p>
      }
      @if (error()) { <p class="text-[11px]" style="color: var(--status-critical)">{{ error() }}</p> }
      <input #fileInput type="file" class="sr-only" accept="image/jpeg,image/png,application/pdf" (change)="onFileSelected($event)" />
    </div>
  `,
})
export class FileDropComponent {
  protected readonly i18n = inject(I18nService);
  readonly fileSelected = output<File>();

  readonly selected = signal<File | null>(null);
  readonly error = signal<string>('');
  readonly dragOver = signal(false);

  private readonly acceptedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  private readonly maxSizeMb = 5;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.validateAndEmit(file);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.validateAndEmit(file);
  }

  private validateAndEmit(file: File): void {
    if (!this.acceptedTypes.includes(file.type)) {
      this.error.set(this.i18n.t('validation.fileType'));
      return;
    }
    if (file.size > this.maxSizeMb * 1024 * 1024) {
      this.error.set(this.i18n.t('validation.fileSize', { max: this.maxSizeMb }));
      return;
    }
    this.error.set('');
    this.selected.set(file);
    this.fileSelected.emit(file);
  }
}
