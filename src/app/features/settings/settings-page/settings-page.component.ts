import { Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ProblemDetails, SystemParameter } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import { BreadcrumbsComponent, ToastService, ToggleComponent } from '../../../shared/ui';

const CATEGORY_LABELS: Record<SystemParameter['categorie'], string> = {
  DISPATCH: 'Dispatch', DELAIS: 'Délais', PLAFONDS: 'Plafonds financiers', SLA: 'SLA & qualité de service', TARIFICATION: 'Tarification',
};

@Component({
  selector: 'app-settings-page',
  imports: [ToggleComponent, BreadcrumbsComponent],
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly categories: SystemParameter['categorie'][] = ['DISPATCH', 'DELAIS', 'PLAFONDS', 'SLA', 'TARIFICATION'];
  protected readonly parameters = signal<SystemParameter[]>([]);
  protected readonly loading = signal(true);
  protected readonly drafts = signal<Record<string, number | boolean | string>>({});
  protected readonly saving = signal<string | null>(null);

  constructor() {
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    this.settingsService.list().subscribe((res) => {
      this.parameters.set(res);
      const drafts: Record<string, number | boolean | string> = {};
      for (const p of res) drafts[p.cle] = p.valeur;
      this.drafts.set(drafts);
      this.loading.set(false);
    });
  }

  paramsFor(cat: SystemParameter['categorie']): SystemParameter[] {
    return this.parameters().filter((p) => p.categorie === cat);
  }

  draftValue(cle: string): number | boolean | string {
    return this.drafts()[cle];
  }

  updateDraft(cle: string, value: number | boolean | string): void {
    this.drafts.update((d) => ({ ...d, [cle]: value }));
  }

  isDirty(param: SystemParameter): boolean {
    return this.drafts()[param.cle] !== param.valeur;
  }

  save(param: SystemParameter): void {
    this.saving.set(param.cle);
    this.settingsService.update(param.cle, this.drafts()[param.cle]).subscribe({
      next: () => {
        this.saving.set(null);
        this.fetch();
        this.toast.success('Paramètre mis à jour', 'Effectif immédiatement, sans redéploiement (UC-ADM-13).');
      },
      error: (err: ProblemDetails) => { this.saving.set(null); this.toast.error('Échec', err.detail); },
    });
  }

  formatDateTime(v: string): string { return formatDateTime(v); }
}
