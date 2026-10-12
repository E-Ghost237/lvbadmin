import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Parametre, ParametreType, SettingSummary, SettingsService } from '../../../core/services/settings.service';
import { ProblemDetails } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import {
  AlertBannerComponent,
  ForbiddenStateComponent,
  FormFeedbackService,
  FormFieldComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  ToastService,
} from '../../../shared/ui';

const PARAMETRE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'string', label: 'Texte' }, { value: 'integer', label: 'Entier' }, { value: 'decimal', label: 'Décimal' },
  { value: 'boolean', label: 'Booléen' }, { value: 'json', label: 'JSON' },
];

@Component({
  selector: 'app-settings-page',
  imports: [
  AlertBannerComponent,
  ForbiddenStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  ReactiveFormsModule,
  SelectComponent,
],
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  protected readonly parametreTypeOptions = PARAMETRE_TYPE_OPTIONS;

  protected readonly key = signal('');
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly current = signal<Parametre | null>(null);

  protected readonly settingsList = signal<SettingSummary[]>([]);
  protected readonly loadingList = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly listCursor = signal<string | null>(null);

  protected readonly editForm = this.fb.nonNullable.group({
    valeur: ['', [Validators.required]],
    type: ['string' as ParametreType, [Validators.required]],
    description: [''],
  });
  protected readonly saving = signal(false);

  constructor() {
    this.fetchList();
  }

  fetchList(cursor?: string): void {
    this.loadingList.set(true);
    this.forbidden.set(false);
    this.settings.list(cursor).subscribe({
      next: (page) => {
        this.loadingList.set(false);
        this.settingsList.set(cursor ? [...this.settingsList(), ...page.items] : page.items);
        this.listCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingList.set(false);
        if (err.status === 403) this.forbidden.set(true);
      },
    });
  }

  selectKey(k: string): void {
    this.key.set(k);
    this.lookup();
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  onKeyInput(value: string): void {
    this.key.set(value);
  }

  lookup(): void {
    if (!this.key().trim()) return;
    this.loading.set(true);
    this.notFound.set(false);
    this.current.set(null);
    this.settings.get(this.key().trim()).subscribe({
      next: (p) => {
        this.loading.set(false);
        this.current.set(p);
        this.editForm.reset({ valeur: p.valeur, type: 'string', description: '' });
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 404) this.notFound.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  save(): void {
    if (this.editForm.invalid) {
      this.feedback.invalid(this.editForm);
      return;
    }
    const v = this.editForm.getRawValue();
    this.saving.set(true);
    this.settings.set(this.key().trim(), v.valeur, v.type, v.description || undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Paramètre enregistré');
        this.notFound.set(false);
        this.current.set({ cle: this.key().trim(), valeur: v.valeur });
        this.fetchList();
      },
      error: (err: ProblemDetails) => {
        this.saving.set(false);
        this.toast.error('Échec de l’enregistrement', err.detail);
      },
    });
  }
}
