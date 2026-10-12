import { Component, inject, signal, viewChild } from '@angular/core';
import { CourierAccount, CreateCourierRequest } from '@lvb/models/courier.model';
import { ProblemDetails } from '@lvb/models/common.model';
import { ModalComponent } from '@lvb/ui/modal/modal.component';
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
  imports: [CourierFormComponent, DataTableComponent, TableCellDefDirective, StatusBadgeComponent, ForbiddenStateComponent, ModalComponent],
  template: `
    @if (forbidden()) {
      <app-forbidden-state detail="Votre compte n’a pas la permission fleet.driver.manage." />
    } @else {
      <div class="toolbar">
        <div>
          <p class="section-label">Équipe de livraison</p>
          <p class="text-xs mt-1" style="color: var(--text-muted)">Les dossiers KYC restent vérifiés par LVB</p>
        </div>
        <span class="toolbar-spacer"></span>
        @if (rows().length) { <span class="count-chip">{{ rows().length }} livreur(s)</span> }
        <div class="toolbar-divider"></div>
        <button type="button" class="btn btn-primary btn-sm shrink-0" (click)="formOpen.set(!formOpen())">{{ formOpen() ? 'Fermer' : '+ Nouveau livreur' }}</button>
      </div>

      @if (formOpen()) {
        <section class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">Nouveau livreur</h2>
              <p class="card-sub">Il reçoit ses accès par email et complète son dossier KYC</p>
            </div>
          </div>
          <div class="card-body">
            <app-courier-form [saving]="saving()" (save)="create($event)" />
          </div>
        </section>
      }

      <section class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Livreurs</h2>
            <p class="card-sub">Cliquez sur une ligne pour afficher la fiche complète</p>
          </div>
        </div>
        <div class="card-body-flush">
          <app-data-table
            [columns]="columns" [rows]="rows()" [loading]="loading() && rows().length === 0" [trackBy]="trackBy" [rowClickable]="true" (rowClick)="open($event)"
            emptyTitle="Aucun livreur" emptyHint="Créez un livreur : il recevra ses accès par email et complétera son dossier KYC."
          >
            <ng-template appCell="statut" let-row><app-status-badge domain="account" [status]="row.statut" /></ng-template>
          </app-data-table>
        </div>
        @if (cursor()) {
          <div class="card-foot">
            <span class="text-xs" style="color: var(--text-muted)">Pagination serveur par curseur</span>
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="loading()" (click)="fetch(cursor()!)">Charger plus</button>
          </div>
        }
      </section>

      <app-modal [open]="detail() !== null" title="Livreur" [subtitle]="detail()?.matricule ?? ''" size="md" (closed)="detail.set(null)">
        @if (detail(); as c) {
          <div class="kv-grid kv-grid-2">
            <div class="kv-item"><span class="kv-label">Nom</span><span class="kv-value">{{ c.prenom ?? '' }} {{ c.nom }}</span></div>
            <div class="kv-item"><span class="kv-label">Matricule</span><span class="kv-value">{{ c.matricule }}</span></div>
            <div class="kv-item"><span class="kv-label">Téléphone</span><span class="kv-value">{{ c.telephone }}</span></div>
            <div class="kv-item"><span class="kv-label">Email</span><span class="kv-value">{{ c.email ?? '—' }}</span></div>
            <div class="kv-item"><span class="kv-label">Compte</span><span class="kv-value"><app-status-badge domain="account" [status]="c.statut" /></span></div>
            <div class="kv-item"><span class="kv-label">En service</span><span class="kv-value">{{ c.statut_operationnel }}</span></div>
          </div>
        }
        <div modal-footer><button type="button" class="btn btn-secondary" (click)="detail.set(null)">Fermer</button></div>
      </app-modal>
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
  protected readonly detail = signal<CourierAccount | null>(null);
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

  open(row: CourierAccount): void {
    this.detail.set(row);
    this.api.get(row.uuid).subscribe({ next: (c) => this.detail.set(c), error: () => undefined });
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
