import { Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatXaf } from '@lvb/utils/formatters';
import { intRange } from '@lvb/utils/validators';
import { FormFeedbackService } from '@lvb/ui/form-feedback/form-feedback.service';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { RatePlanMode, SimulationResult } from '../../core/models';
import { FleetOpsService } from '../../core/services/fleet-ops.service';
import { localToIso, nowLocal } from '../../core/utils/datetime';

const OPTIONS = [
  { id: 'handling', label: 'Manutention' }, { id: 'fuel', label: 'Carburant' }, { id: 'toll', label: 'Péage' }, { id: 'insurance', label: 'Assurance' },
] as const;
const COMPONENT_LABEL: Record<string, string> = {
  base: 'Montant de base', duration: 'Durée', distance: 'Distance', trip: 'Trajet', driver: 'Chauffeur', handling: 'Manutention',
  fuel: 'Carburant', toll: 'Péage', insurance: 'Assurance', waiting: 'Attente',
};

function endAfterStart(g: AbstractControl): ValidationErrors | null {
  const s = g.get('starts_at')?.value as string; const e = g.get('ends_at')?.value as string;
  return !s || !e || e > s ? null : { range: true };
}

/** Quote preview for a tariff — `POST /partner/rate-plans/{uuid}/simulate` (nothing is saved or booked). */
@Component({
  selector: 'app-rate-plan-simulator',
  imports: [ReactiveFormsModule, FormFieldComponent],
  template: `
    <div class="inset-panel">
      <div class="inset-panel-head">
        <div>
          <p class="card-title">Simuler le tarif « {{ name() }} »</p>
          <p class="card-sub">Aperçu du prix pour une location : rien n’est enregistré.</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="closed.emit()">Fermer</button>
      </div>
      <form [formGroup]="form" (ngSubmit)="run()" class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4">
        <app-field label="Début" [control]="form.controls.starts_at" required><input type="datetime-local" class="input" formControlName="starts_at" /></app-field>
        <app-field label="Fin" [control]="form.controls.ends_at" required><input type="datetime-local" class="input" formControlName="ends_at" /></app-field>
        @if (form.hasError('range') && form.controls.ends_at.touched) { <p class="field-error sm:col-span-2">La fin doit être postérieure au début.</p> }
        @if (needsDistance()) {
          <app-field label="Distance prévue (km)" [control]="form.controls.distance_km" required hint="Requis pour ce mode de tarification."><input type="number" min="0" class="input" formControlName="distance_km" /></app-field>
        }
        <app-field label="Attente (minutes)" [control]="form.controls.waiting_minutes"><input type="number" min="0" class="input" formControlName="waiting_minutes" /></app-field>
        <app-field label="Zone" [control]="form.controls.zone"><input class="input" formControlName="zone" /></app-field>
        <div class="sm:col-span-2 flex flex-wrap items-center gap-4 text-sm">
          <label class="inline-flex items-center gap-2"><input type="checkbox" formControlName="with_driver" /> Avec chauffeur</label>
          @for (o of options; track o.id) {
            <label class="inline-flex items-center gap-2"><input type="checkbox" [checked]="chosen().includes(o.id)" (change)="toggle(o.id, $any($event.target).checked)" /> {{ o.label }}</label>
          }
        </div>
        <div class="sm:col-span-2"><button type="submit" class="btn btn-primary btn-sm" [disabled]="running()">Calculer</button></div>
      </form>
      @if (result(); as r) {
        <div class="p-4 text-sm" style="border-top: 1px solid var(--border)">
          <p class="section-label mb-2.5">Détail du calcul</p>
          <ul class="flex flex-col gap-1.5">
            @for (c of components(r); track c[0]) {
              <li class="flex justify-between gap-4"><span style="color: var(--text-secondary)">{{ c[0] }}</span><span class="tabular-nums">{{ xaf(c[1]) }}</span></li>
            }
            @if (r.discount_amount) { <li class="flex justify-between gap-4"><span style="color: var(--text-secondary)">Remise</span><span class="tabular-nums">− {{ xaf(r.discount_amount) }}</span></li> }
            @if (r.tax_amount) { <li class="flex justify-between gap-4"><span style="color: var(--text-secondary)">Taxe</span><span class="tabular-nums">{{ xaf(r.tax_amount) }}</span></li> }
            <li class="flex justify-between gap-4 font-semibold pt-2 mt-1" style="border-top: 1px solid var(--border)"><span>Total client</span><span class="tabular-nums">{{ xaf(r.total_amount) }}</span></li>
            <li class="flex justify-between gap-4 text-xs" style="color: var(--text-muted)"><span>Commission LVB</span><span class="tabular-nums">− {{ xaf(r.commission_amount) }}</span></li>
            <li class="flex justify-between gap-4 font-bold" style="color: var(--status-good)"><span>Vous percevez</span><span class="tabular-nums">{{ xaf(r.partner_amount) }}</span></li>
          </ul>
        </div>
      }
    </div>
  `,
})
export class RatePlanSimulatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ops = inject(FleetOpsService);
  private readonly feedback = inject(FormFeedbackService);

  readonly planUuid = input.required<string>();
  readonly name = input.required<string>();
  readonly mode = input.required<RatePlanMode>();
  readonly closed = output<void>();

  protected readonly options = OPTIONS;
  protected readonly xaf = formatXaf;
  protected readonly running = signal(false);
  protected readonly result = signal<SimulationResult | null>(null);
  protected readonly chosen = signal<string[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    starts_at: [nowLocal(1), [Validators.required]],
    ends_at: [nowLocal(5), [Validators.required]],
    distance_km: [null as number | null, [intRange(0, 100_000)]],
    waiting_minutes: [0, [intRange(0, 525_600)]],
    zone: ['', [Validators.maxLength(120)]],
    with_driver: [false],
  }, { validators: [endAfterStart] });

  protected needsDistance = () => this.mode() === 'KILOMETRIQUE' || this.mode() === 'MIXTE';
  protected components = (r: SimulationResult): [string, number][] =>
    Object.entries(r.detail_calcul).filter(([, v]) => v).map(([k, v]) => [COMPONENT_LABEL[k] ?? k, v]);

  toggle(id: string, on: boolean): void { this.chosen.update((l) => (on ? [...l, id] : l.filter((x) => x !== id))); }

  run(): void {
    const v = this.form.getRawValue();
    if (this.needsDistance() && v.distance_km === null) { this.form.controls.distance_km.setErrors({ required: true }); this.form.controls.distance_km.markAsTouched(); }
    if (this.form.invalid || (this.needsDistance() && v.distance_km === null)) { this.feedback.invalid(this.form); return; }
    this.running.set(true);
    this.ops.simulate(this.planUuid(), {
      starts_at: localToIso(v.starts_at), ends_at: localToIso(v.ends_at), with_driver: v.with_driver,
      ...(v.distance_km !== null ? { distance_meters: v.distance_km * 1000 } : {}),
      ...(v.waiting_minutes ? { waiting_minutes: v.waiting_minutes } : {}),
      ...(v.zone.trim() ? { zone: v.zone.trim() } : {}),
      ...(this.chosen().length ? { options: this.chosen() as never } : {}),
    }).subscribe({
      next: (r) => { this.running.set(false); this.result.set(r); },
      error: (err: ProblemDetails) => { this.running.set(false); this.result.set(null); this.feedback.serverError(this.form, 'Simulation impossible', err); },
    });
  }
}
