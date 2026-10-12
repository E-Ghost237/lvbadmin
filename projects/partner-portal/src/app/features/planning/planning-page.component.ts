import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ProblemDetails } from '@lvb/models/common.model';
import { PageHeaderComponent } from '@lvb/ui/page-header/page-header.component';
import { ConfirmService } from '@lvb/ui/confirm/confirm.service';
import { FormFeedbackService } from '@lvb/ui/form-feedback/form-feedback.service';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ToastService } from '@lvb/ui/toast/toast.service';
import { CalendarHold, FleetCalendar, UnavailabilityKind, UnavailabilityRow } from '../../core/models';
import { FleetOpsService } from '../../core/services/fleet-ops.service';
import { FleetService } from '../../core/services/fleet.service';
import { PartnerContextService } from '../../core/services/partner-context.service';
import { formatDouala, localToIso, nowLocal } from '../../core/utils/datetime';

const KIND_OPTIONS: SelectOption[] = [
  { value: 'MANUEL', label: 'Indisponibilité manuelle' }, { value: 'MAINTENANCE', label: 'Maintenance' }, { value: 'CONGE', label: 'Congé' },
];
const KIND_LABEL: Record<string, string> = { MANUEL: 'Manuel', MAINTENANCE: 'Maintenance', CONGE: 'Congé' };

function endAfterStart(g: AbstractControl): ValidationErrors | null {
  const s = g.get('starts_at')?.value as string; const e = g.get('ends_at')?.value as string;
  return !s || !e || e > s ? null : { range: true };
}
function oneTarget(g: AbstractControl): ValidationErrors | null {
  const v = !!g.get('vehicle_uuid')?.value; const d = !!g.get('driver_uuid')?.value;
  return v || d ? null : { target: true };
}

/**
 * Availability calendar — `GET /partner/calendar` (bookings on hold/reserved + unavailability)
 * and the manual blocks `POST/DELETE /partner/unavailability`. Reading needs `booking.read`
 * (every role); creating or removing a block needs `fleet.vehicle.manage` (responsable).
 */
@Component({
  selector: 'app-planning-page',
  imports: [ReactiveFormsModule, PageHeaderComponent, FormFieldComponent, SelectComponent, ForbiddenStateComponent],
  template: `
    <div class="page">
      <app-page-header
        [crumbs]="[{ label: 'Planning' }]"
        title="Planning de la flotte"
        subtitle="Réservations en cours et périodes d’indisponibilité de vos véhicules et chauffeurs."
      />

    @if (forbidden()) {
      <app-forbidden-state detail="Votre compte n’a pas la permission booking.read." />
    } @else {
      <div class="toolbar items-end">
        <div><label class="field-label">Du</label><input type="datetime-local" class="input" [value]="from()" (input)="from.set($any($event.target).value)" /></div>
        <div><label class="field-label">Au</label><input type="datetime-local" class="input" [value]="to()" (input)="to.set($any($event.target).value)" /></div>
        <div class="w-56"><label class="field-label">Véhicule</label><app-select [options]="vehicleOptions()" placeholder="Tous" [value]="vehicleFilter()" (valueChange)="vehicleFilter.set($event)" /></div>
        <div class="w-56"><label class="field-label">Chauffeur</label><app-select [options]="driverOptions()" placeholder="Tous" [value]="driverFilter()" (valueChange)="driverFilter.set($event)" /></div>
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-primary btn-sm" [disabled]="loading()" (click)="load()">Afficher</button>
      </div>
      @if (rangeError()) { <p class="field-error">{{ rangeError() }}</p> }

      @if (canManage) {
        <section class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">Bloquer une période</h2>
              <p class="card-sub">Indisponibilité planifiée d’un véhicule, d’un chauffeur ou des deux</p>
            </div>
          </div>
          <form [formGroup]="blockForm" (ngSubmit)="submitBlock()" class="card-body grid grid-cols-1 sm:grid-cols-2 gap-3">
            <app-field label="Véhicule" [control]="blockForm.controls.vehicle_uuid" hint="Véhicule ou chauffeur (au moins un)"><app-select [options]="vehicleOptions()" formControlName="vehicle_uuid" /></app-field>
            <app-field label="Chauffeur" [control]="blockForm.controls.driver_uuid"><app-select [options]="driverOptions()" formControlName="driver_uuid" /></app-field>
            <app-field label="Début" [control]="blockForm.controls.starts_at" required><input type="datetime-local" class="input" formControlName="starts_at" /></app-field>
            <app-field label="Fin" [control]="blockForm.controls.ends_at" required><input type="datetime-local" class="input" formControlName="ends_at" /></app-field>
            <app-field label="Type" [control]="blockForm.controls.kind"><app-select [options]="kindOptions" [allowClear]="false" formControlName="kind" /></app-field>
            <app-field label="Motif" [control]="blockForm.controls.reason" required><input class="input" formControlName="reason" /></app-field>
            @if (blockForm.hasError('target') && blockTried()) { <p class="field-error sm:col-span-2">Choisissez un véhicule ou un chauffeur à bloquer.</p> }
            @if (blockForm.hasError('range') && blockTried()) { <p class="field-error sm:col-span-2">La fin doit être postérieure au début.</p> }
            <div class="sm:col-span-2"><button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">Bloquer</button></div>
          </form>
        </section>
      }

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <section class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">Indisponibilités</h2>
              <p class="card-sub">Périodes bloquées sur la plage affichée</p>
            </div>
            <span class="count-chip">{{ calendar()?.unavailability?.length ?? 0 }}</span>
          </div>
          <div class="card-body">
          @if (loading()) { <div class="skeleton h-16"></div> }
          @else if ((calendar()?.unavailability?.length ?? 0) === 0) { <div class="inline-empty">Aucune indisponibilité sur la période.</div> }
          @else {
            <div class="stack">
              @for (u of calendar()!.unavailability; track u.uuid) {
                <div class="list-row items-start">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold">{{ target(u) }} <span class="font-normal" style="color: var(--text-muted)">· {{ kindLabel[u.kind] }}</span></p>
                    <p class="text-xs mt-0.5" style="color: var(--text-muted)">{{ dt(u.starts_at) }} → {{ dt(u.ends_at) }} — {{ u.reason }}</p>
                  </div>
                  @if (canManage) {
                    <button type="button" class="btn btn-danger-ghost btn-sm !py-1 shrink-0" [disabled]="removing() === u.uuid" (click)="unblock(u)">Retirer</button>
                  }
                </div>
              }
            </div>
          }
          </div>
        </section>
        <section class="card">
          <div class="card-head">
            <div>
              <h2 class="card-title">Réservations</h2>
              <p class="card-sub">Créneaux retenus ou en attente de paiement</p>
            </div>
            <span class="count-chip">{{ calendar()?.bookings?.items?.length ?? 0 }}</span>
          </div>
          <div class="card-body">
          @if (loading()) { <div class="skeleton h-16"></div> }
          @else if ((calendar()?.bookings?.items?.length ?? 0) === 0) { <div class="inline-empty">Aucune réservation sur la période.</div> }
          @else {
            <div class="stack">
              @for (b of calendar()!.bookings.items; track b.uuid) {
                <div class="list-row">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold">{{ holdTarget(b) }}</p>
                    <p class="text-xs mt-0.5" style="color: var(--text-muted)">{{ dt(b.starts_at) }} → {{ dt(b.ends_at) }}</p>
                  </div>
                  <span class="status-pill shrink-0" [style.background]="b.status === 'RESERVED' ? 'var(--status-good-bg)' : 'var(--status-warning-bg)'" [style.color]="b.status === 'RESERVED' ? 'var(--status-good)' : 'var(--status-warning)'">{{ b.status === 'RESERVED' ? 'Réservé' : 'En attente de paiement' }}</span>
                </div>
              }
            </div>
          }
          </div>
        </section>
      </div>
    }
    </div>
  `,
})
export class PlanningPageComponent {
  private readonly ops = inject(FleetOpsService);
  private readonly fleet = inject(FleetService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly feedback = inject(FormFeedbackService);
  private readonly confirm = inject(ConfirmService);

  protected readonly canManage = inject(PartnerContextService).can('fleet.vehicle.manage');
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly kindLabel = KIND_LABEL;
  protected readonly dt = formatDouala;

  protected readonly forbidden = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly blockTried = signal(false);
  protected readonly rangeError = signal('');
  protected readonly calendar = signal<FleetCalendar | null>(null);
  protected readonly from = signal(nowLocal(-24));
  protected readonly to = signal(nowLocal(24 * 30));
  protected readonly vehicleFilter = signal('');
  protected readonly driverFilter = signal('');
  private readonly vehicleNames = signal<Record<string, string>>({});
  private readonly driverNames = signal<Record<string, string>>({});
  protected readonly vehicleOptions = computed<SelectOption[]>(() => Object.entries(this.vehicleNames()).map(([value, label]) => ({ value, label })));
  protected readonly driverOptions = computed<SelectOption[]>(() => Object.entries(this.driverNames()).map(([value, label]) => ({ value, label })));

  protected readonly blockForm = this.fb.nonNullable.group({
    vehicle_uuid: [''], driver_uuid: [''], starts_at: ['', [Validators.required]], ends_at: ['', [Validators.required]],
    kind: ['MANUEL' as UnavailabilityKind], reason: ['', [Validators.required, Validators.maxLength(255)]],
  }, { validators: [endAfterStart, oneTarget] });

  constructor() {
    this.load();
    if (this.canManage) {
      this.fleet.listVehicles({ limit: 100 }).subscribe({ next: (p) => this.vehicleNames.set(Object.fromEntries(p.items.map((v) => [v.uuid, v.registration]))), error: () => undefined });
      this.fleet.listDrivers({ limit: 100 }).subscribe({ next: (p) => this.driverNames.set(Object.fromEntries(p.items.map((d) => [d.uuid, `${d.first_name} ${d.last_name}`]))), error: () => undefined });
    }
  }

  protected target(u: UnavailabilityRow): string {
    return [u.vehicle_uuid && (this.vehicleNames()[u.vehicle_uuid] ?? 'Véhicule'), u.driver_uuid && (this.driverNames()[u.driver_uuid] ?? 'Chauffeur')].filter(Boolean).join(' + ');
  }
  protected holdTarget(b: CalendarHold): string {
    return [b.vehicle_uuid && (this.vehicleNames()[b.vehicle_uuid] ?? 'Véhicule'), b.driver_uuid && (this.driverNames()[b.driver_uuid] ?? 'Chauffeur')].filter(Boolean).join(' + ') || 'Réservation';
  }

  load(): void {
    if (!this.from() || !this.to()) { this.rangeError.set('Renseignez les deux dates.'); return; }
    if (this.to() <= this.from()) { this.rangeError.set('La date de fin doit être postérieure à la date de début.'); return; }
    this.rangeError.set('');
    this.loading.set(true);
    this.ops.calendar({
      starts_at: localToIso(this.from()), ends_at: localToIso(this.to()),
      vehicle_uuid: this.vehicleFilter() || undefined, driver_uuid: this.driverFilter() || undefined,
    }).subscribe({
      next: (c) => { this.loading.set(false); this.calendar.set(c); },
      error: (err: ProblemDetails) => { this.loading.set(false); if (err.status === 403) this.forbidden.set(true); else this.feedback.serverError(null, 'Chargement impossible', err); },
    });
  }

  submitBlock(): void {
    this.blockTried.set(true);
    if (this.blockForm.invalid) { this.feedback.invalid(this.blockForm); return; }
    const v = this.blockForm.getRawValue();
    this.saving.set(true);
    this.ops.block({
      ...(v.vehicle_uuid ? { vehicle_uuid: v.vehicle_uuid } : {}), ...(v.driver_uuid ? { driver_uuid: v.driver_uuid } : {}),
      starts_at: localToIso(v.starts_at), ends_at: localToIso(v.ends_at), reason: v.reason.trim(), kind: v.kind,
    }).subscribe({
      next: () => { this.saving.set(false); this.blockTried.set(false); this.blockForm.reset({ vehicle_uuid: '', driver_uuid: '', starts_at: '', ends_at: '', kind: 'MANUEL', reason: '' }); this.toast.success('Période bloquée'); this.load(); },
      error: (err: ProblemDetails) => { this.saving.set(false); this.feedback.serverError(this.blockForm, 'Blocage refusé', err); },
    });
  }

  async unblock(u: UnavailabilityRow): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Retirer ce blocage ?', message: `${this.target(u)} — ${u.reason}`, danger: true, confirmLabel: 'Retirer' }))) return;
    this.removing.set(u.uuid);
    this.ops.unblock(u.uuid).subscribe({
      next: () => { this.removing.set(null); this.toast.success('Blocage retiré'); this.load(); },
      error: (err: ProblemDetails) => { this.removing.set(null); this.feedback.serverError(null, 'Suppression refusée', err); },
    });
  }
}
