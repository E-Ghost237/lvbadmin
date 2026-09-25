import { Component, inject, signal, viewChild } from '@angular/core';
import { CourierAccount, CreateCourierRequest } from '@lvb/models/courier.model';
import { ProblemDetails } from '@lvb/models/common.model';
import { CourierFormComponent } from '@lvb/ui/courier-form/courier-form.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatusBadgeComponent } from '@lvb/ui/status-badge/status-badge.component';
import { ColumnDef, DataTableComponent } from '@lvb/ui/table/data-table.component';
import { TableCellDefDirective } from '@lvb/ui/table/table-cell-def.directive';
import { ToastService } from '@lvb/ui/toast/toast.service';
import { CourierService } from '../../core/services/courier.service';

/** Delivery couriers of the organisation: list + create. Approval of the KYC dossier stays with LVB. */
@Component({
  selector: 'app-couriers-panel',
  imports: [CourierFormComponent, DataTableComponent, TableCellDefDirective, StatusBadgeComponent, ForbiddenStateComponent],
  template: `
    @if (forbidden()) {
      <app-forbidden-state detail="Votre compte n’a pas la permission fleet.driver.manage." />
    } @else {
      <div class="flex justify-end mb-4">
        <button type="button" class="btn btn-primary btn-sm" (click)="formOpen.set(!formOpen())">{{ formOpen() ? 'Fermer' : '+ Nouveau livreur' }}</button>
      </div>
      @if (formOpen()) {
        <div class="card p-5 mb-4">
          <p class="text-sm font-medium mb-3">Nouveau livreur</p>
          <app-courier-form [saving]="saving()" (save)="create($event)" />
        </div>
      }
      <div class="card">
        <app-data-table
          [columns]="columns" [rows]="rows()" [loading]="loading() && rows().length === 0" [trackBy]="trackBy"
          emptyTitle="Aucun livreur" emptyHint="Créez un livreur : il recevra ses accès par email et complétera son dossier KYC."
        >
          <ng-template appCell="statut" let-row><app-status-badge domain="account" [status]="row.statut" /></ng-template>
        </app-data-table>
      </div>
      @if (cursor()) {
        <button type="button" class="btn btn-secondary btn-sm mt-3" [disabled]="loading()" (click)="fetch(cursor()!)">Charger plus</button>
      }
    }
  `,
})
export class CouriersPanelComponent {
  private readonly api = inject(CourierService);
  private readonly toast = inject(ToastService);
  private readonly form = viewChild(CourierFormComponent);

  protected readonly rows = signal<CourierAccount[]>([]);
  protected readonly loading = signal(true);
  protected readonly forbidden = signal(false);
  protected readonly cursor = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly trackBy = (r: CourierAccount) => r.uuid;
  protected readonly columns: ColumnDef<CourierAccount>[] = [
    { key: 'nom', label: 'Livreur', cell: (r) => `${r.prenom ?? ''} ${r.nom}`.trim() },
    { key: 'matricule', label: 'Matricule' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email', cell: (r) => r.email ?? '—' },
    { key: 'statut', label: 'Compte' },
  ];

  constructor() {
    this.fetch();
  }

  fetch(cursor?: string): void {
    this.loading.set(true);
    this.api.list({ cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loading.set(false);
        this.rows.set(cursor ? [...this.rows(), ...page.items] : page.items);
        this.cursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loading.set(false);
        if (err.status === 403) this.forbidden.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  create(req: CreateCourierRequest): void {
    this.saving.set(true);
    this.api.create(req).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.form()?.reset();
        this.formOpen.set(false);
        this.toast.success('Livreur créé', `${c.matricule} — ses accès ont été envoyés par email.`);
        this.fetch();
      },
      error: (err: ProblemDetails) => {
        this.saving.set(false);
        this.form()?.showServerError('Création impossible', err);
      },
    });
  }
}
