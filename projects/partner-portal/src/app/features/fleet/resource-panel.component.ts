import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ProblemDetails } from '@lvb/models/common.model';
import { FormFeedbackService } from '@lvb/ui/form-feedback/form-feedback.service';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ToastService } from '@lvb/ui/toast/toast.service';
import { ConfirmService } from '@lvb/ui/confirm/confirm.service';
import {
  FleetResource, HoursException, OperatingHours, RentalDocument, RentalDocumentKind, WeeklyHours,
} from '../../core/models';
import { FleetOpsService } from '../../core/services/fleet-ops.service';
import { formatDouala, isoToLocal, localToIso } from '../../core/utils/datetime';

const VEHICLE_KINDS: RentalDocumentKind[] = ['ASSURANCE', 'VISITE_TECHNIQUE', 'CARTE_GRISE', 'JUSTIFICATIF'];
const DRIVER_KINDS: RentalDocumentKind[] = ['PERMIS', 'JUSTIFICATIF'];
const KIND_LABEL: Record<string, string> = {
  ASSURANCE: 'Assurance', VISITE_TECHNIQUE: 'Visite technique', CARTE_GRISE: 'Carte grise', PERMIS: 'Permis de conduire',
  JUSTIFICATIF: 'Autre justificatif', PHOTO: 'Photo',
};
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MAX_BYTES = 10 * 1024 * 1024;

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const s = group.get('starts_at')?.value as string;
  const e = group.get('ends_at')?.value as string;
  if (!s || !e) return null;
  return e > s ? null : { range: true };
}

interface AuthRow { authorization_uuid: string; registration: string; brand: string; model: string; category: string; from: string; until: string | null }
interface DayRow { weekday: number; label: string; open: boolean; opens: string; closes: string; extra: WeeklyHours[] }
interface ExcRow { date: string; closed: boolean; opens: string; closes: string }

/**
 * Detail panel for one vehicle or driver: documents (+ photos for vehicles),
 * operating hours, maintenance (vehicles) and vehicle authorisations (drivers).
 * Everything here maps to `/v1/partner/{vehicles|drivers}/{uuid}/…`.
 */
@Component({
  selector: 'app-resource-panel',
  imports: [ReactiveFormsModule, FormFieldComponent, SelectComponent],
  template: `
    <div class="card p-5 mb-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <p class="text-sm font-semibold">{{ label() }}</p>
          <p class="text-xs" style="color: var(--text-muted)">{{ resource() === 'vehicles' ? 'Véhicule' : 'Chauffeur' }}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="closed.emit()">Fermer</button>
      </div>
      <div class="flex flex-wrap gap-1.5 mb-4">
        @for (s of sections(); track s.id) {
          <button type="button" class="px-2.5 py-1 rounded-full text-xs font-medium"
                  [style.background]="section() === s.id ? 'var(--brand)' : 'var(--surface-2)'"
                  [style.color]="section() === s.id ? 'white' : 'var(--text-secondary)'" (click)="open(s.id)">{{ s.label }}</button>
        }
      </div>

      @switch (section()) {
        @case ('documents') {
          @if (forbidden()) { <p class="field-error">Accès refusé pour votre rôle.</p> }
          @if (docs().length === 0 && !loadingDocs()) {
            <p class="text-sm mb-3" style="color: var(--text-muted)">Aucun document déposé.</p>
          }
          <ul class="flex flex-col gap-1.5 mb-4">
            @for (d of docs(); track d.uuid) {
              <li class="flex items-center justify-between gap-3 text-sm">
                <span>{{ kindLabel[d.kind] }} <span class="text-xs" style="color: var(--text-muted)">· {{ size(d.bytes) }} · {{ dt(d.created_at) }}</span></span>
                <button type="button" class="btn btn-secondary btn-sm !py-0.5" [disabled]="opening() === d.uuid" (click)="openDoc(d)">Ouvrir</button>
              </li>
            }
          </ul>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label class="field-label">Type</label>
              <app-select [options]="kindOptions()" [allowClear]="false" [value]="uploadKind()" (valueChange)="uploadKind.set($event)" />
            </div>
            <div class="sm:col-span-2">
              <label class="field-label">Fichier (PDF, JPG ou PNG — 10 Mo max)</label>
              <input type="file" class="input" accept="application/pdf,image/jpeg,image/png" (change)="onFile($event, false)" />
            </div>
          </div>
          @if (fileError()) { <p class="field-error mt-1">{{ fileError() }}</p> }
          <div class="flex flex-wrap gap-2 mt-3">
            <button type="button" class="btn btn-primary btn-sm" [disabled]="uploading()" (click)="upload()">Déposer le document</button>
          </div>
          @if (resource() === 'vehicles') {
            <div class="mt-5 pt-4" style="border-top: 1px solid var(--border)">
              <p class="text-sm font-medium mb-2">Photo du véhicule</p>
              <input type="file" class="input max-w-md" accept="image/jpeg,image/png,image/webp" (change)="onFile($event, true)" />
              @if (photoError()) { <p class="field-error mt-1">{{ photoError() }}</p> }
              <button type="button" class="btn btn-secondary btn-sm mt-2" [disabled]="uploading()" (click)="uploadPhoto()">Envoyer la photo</button>
            </div>
          }
        }

        @case ('hours') {
          @if (loadingHours()) { <div class="skeleton h-24"></div> } @else {
            <p class="text-xs mb-3" style="color: var(--text-muted)">
              {{ hoursConfigured() ? 'Horaires enregistrés.' : 'Aucun horaire défini : la ressource n’est pas restreinte.' }}
              Fuseau : Africa/Douala. Décochez un jour pour le marquer fermé.
            </p>
            <div class="flex flex-col gap-2">
              @for (row of days(); track row.weekday; let i = $index) {
                <div class="flex flex-wrap items-center gap-3 text-sm">
                  <label class="inline-flex items-center gap-2 w-32"><input type="checkbox" [checked]="row.open" (change)="patchDay(i, { open: $any($event.target).checked })" /> {{ row.label }}</label>
                  @if (row.open) {
                    <input type="time" class="input !w-32" [value]="row.opens" (input)="patchDay(i, { opens: $any($event.target).value })" />
                    <span>→</span>
                    <input type="time" class="input !w-32" [value]="row.closes" (input)="patchDay(i, { closes: $any($event.target).value })" />
                    @if (dayError(row); as e) { <span class="field-error">{{ e }}</span> }
                  } @else { <span class="text-xs" style="color: var(--text-muted)">Fermé</span> }
                </div>
              }
            </div>

            <p class="text-sm font-medium mt-5 mb-2">Exceptions (jours fériés, congés…)</p>
            @for (ex of exceptions(); track $index; let i = $index) {
              <div class="flex flex-wrap items-center gap-3 text-sm mb-2">
                <input type="date" class="input !w-44" [value]="ex.date" (input)="patchExc(i, { date: $any($event.target).value })" />
                <label class="inline-flex items-center gap-2"><input type="checkbox" [checked]="ex.closed" (change)="patchExc(i, { closed: $any($event.target).checked })" /> Fermé toute la journée</label>
                @if (!ex.closed) {
                  <input type="time" class="input !w-32" [value]="ex.opens" (input)="patchExc(i, { opens: $any($event.target).value })" />
                  <span>→</span>
                  <input type="time" class="input !w-32" [value]="ex.closes" (input)="patchExc(i, { closes: $any($event.target).value })" />
                }
                <button type="button" class="btn btn-danger-ghost btn-sm !py-0.5" (click)="removeExc(i)">Retirer</button>
              </div>
            }
            <button type="button" class="btn btn-secondary btn-sm" (click)="addExc()">+ Ajouter une exception</button>
            @if (hoursError()) { <p class="field-error mt-3">{{ hoursError() }}</p> }
            <div class="mt-4"><button type="button" class="btn btn-primary btn-sm" [disabled]="savingHours()" (click)="saveHours()">Enregistrer les horaires</button></div>
          }
        }

        @case ('maintenance') {
          <form [formGroup]="rangeForm" (ngSubmit)="submitMaintenance()" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <app-field label="Début" [control]="rangeForm.controls.starts_at" required><input type="datetime-local" class="input" formControlName="starts_at" /></app-field>
            <app-field label="Fin" [control]="rangeForm.controls.ends_at" required><input type="datetime-local" class="input" formControlName="ends_at" /></app-field>
            @if (rangeForm.hasError('range') && rangeForm.controls.ends_at.touched) { <p class="field-error sm:col-span-2">La fin doit être postérieure au début.</p> }
            <app-field class="sm:col-span-2" label="Motif" [control]="rangeForm.controls.reason" required><input class="input" formControlName="reason" placeholder="Vidange, révision, réparation…" /></app-field>
            <div class="sm:col-span-2"><button type="submit" class="btn btn-primary btn-sm" [disabled]="savingRange()">Bloquer pour maintenance</button>
              <span class="text-xs ml-2" style="color: var(--text-muted)">Le véhicule n’est plus réservable sur cette période. Retrouvez le blocage dans « Planning ».</span></div>
          </form>
        }

        @case ('auth') {
          <p class="text-xs mb-3" style="color: var(--text-muted)">Autorisez ce chauffeur à conduire un véhicule précis ou une catégorie de véhicules.</p>
          <form [formGroup]="authForm" (ngSubmit)="submitAuth()" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <app-field label="Véhicule" [control]="authForm.controls.vehicle_uuid" hint="Ou une catégorie ci-contre">
              <app-select [options]="vehicleOptions()" formControlName="vehicle_uuid" />
            </app-field>
            <app-field label="Catégorie de véhicule" [control]="authForm.controls.vehicle_category"><input class="input" formControlName="vehicle_category" /></app-field>
            <app-field label="Valable à partir du" [control]="authForm.controls.starts_at" required><input type="datetime-local" class="input" formControlName="starts_at" /></app-field>
            <app-field label="Jusqu’au (optionnel)" [control]="authForm.controls.ends_at"><input type="datetime-local" class="input" formControlName="ends_at" /></app-field>
            @if (authError()) { <p class="field-error sm:col-span-2">{{ authError() }}</p> }
            <div class="sm:col-span-2"><button type="submit" class="btn btn-primary btn-sm" [disabled]="savingAuth()">Autoriser</button></div>
          </form>
          <p class="text-sm font-medium mt-5 mb-2">Véhicules autorisés pour ce chauffeur</p>
          @if (loadingAuth()) { <div class="skeleton h-10"></div> }
          @else if (authorizations().length === 0) { <p class="text-sm" style="color: var(--text-muted)">Aucune autorisation active.</p> }
          @else {
            <ul class="flex flex-col gap-2">
              @for (a of authorizations(); track a.authorization_uuid) {
                <li class="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span class="font-medium">{{ a.registration || a.category || 'Véhicule' }}</span>@if (a.brand) { <span> — {{ a.brand }} {{ a.model }}</span> }
                    <span class="block text-xs" style="color: var(--text-muted)">Depuis le {{ dt(a.from) }}{{ a.until ? ' jusqu’au ' + dt(a.until) : ' — sans limite de durée' }}</span>
                  </span>
                  <button type="button" class="btn btn-danger-ghost btn-sm !py-0.5" (click)="revoke(a)">Révoquer</button>
                </li>
              }
            </ul>
          }
        }
      }
    </div>
  `,
})
export class ResourcePanelComponent implements OnInit {
  private readonly ops = inject(FleetOpsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly feedback = inject(FormFeedbackService);
  private readonly confirm = inject(ConfirmService);

  readonly resource = input.required<FleetResource>();
  readonly uuid = input.required<string>();
  readonly label = input.required<string>();
  /** Vehicles the driver can be authorised on. */
  readonly vehicles = input<SelectOption[]>([]);
  readonly closed = output<void>();

  protected readonly kindLabel = KIND_LABEL;
  protected readonly section = signal<'documents' | 'hours' | 'maintenance' | 'auth'>('documents');
  protected readonly sections = computed(() => this.resource() === 'vehicles'
    ? [{ id: 'documents', label: 'Documents & photo' }, { id: 'hours', label: 'Horaires' }, { id: 'maintenance', label: 'Maintenance' }]
    : [{ id: 'documents', label: 'Documents' }, { id: 'hours', label: 'Horaires' }, { id: 'auth', label: 'Autorisations véhicule' }]);
  protected readonly vehicleOptions = computed(() => this.vehicles());
  protected readonly dt = formatDouala;

  // Required inputs are not readable in the constructor (NG0950) — load once they are bound.
  ngOnInit(): void {
    this.loadDocs();
  }

  open(id: string): void {
    this.section.set(id as 'documents' | 'hours' | 'maintenance' | 'auth');
    if (id === 'hours' && !this.hoursLoaded) this.loadHours();
    if (id === 'auth') this.loadAuthorizations();
  }

  private fail(title: string, err: ProblemDetails, form?: Parameters<FormFeedbackService['serverError']>[0]): void {
    if (err.status === 403) this.forbidden.set(true);
    this.feedback.serverError(form ?? null, title, err);
  }
  protected readonly forbidden = signal(false);

  // --- Documents ----------------------------------------------------------
  protected readonly docs = signal<RentalDocument[]>([]);
  protected readonly loadingDocs = signal(false);
  protected readonly opening = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadKind = signal<string>('');
  protected readonly kindOptions = computed<SelectOption[]>(() =>
    (this.resource() === 'vehicles' ? VEHICLE_KINDS : DRIVER_KINDS).map((k) => ({ value: k, label: KIND_LABEL[k] })));
  private docFile: File | null = null;
  private photoFile: File | null = null;
  protected readonly fileError = signal('');
  protected readonly photoError = signal('');

  size(b: number): string { return b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`; }

  private loadDocs(): void {
    this.loadingDocs.set(true);
    this.ops.listDocuments(this.resource(), this.uuid()).subscribe({
      next: (r) => { this.loadingDocs.set(false); this.docs.set(r.items); },
      error: (err: ProblemDetails) => { this.loadingDocs.set(false); this.fail('Chargement impossible', err); },
    });
  }

  onFile(ev: Event, photo: boolean): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    const allowed = photo ? ['image/jpeg', 'image/png', 'image/webp'] : ['application/pdf', 'image/jpeg', 'image/png'];
    let error = '';
    if (f && !allowed.includes(f.type)) error = photo ? 'Format refusé : JPG, PNG ou WebP uniquement.' : 'Format refusé : PDF, JPG ou PNG uniquement.';
    else if (f && f.size > MAX_BYTES) error = `Fichier trop lourd (${this.size(f.size)}) : 10 Mo maximum.`;
    if (photo) { this.photoFile = error ? null : f; this.photoError.set(error); } else { this.docFile = error ? null : f; this.fileError.set(error); }
  }

  upload(): void {
    if (!this.uploadKind()) { this.feedback.blocked('Choisissez le type de document.', 'Dépôt incomplet'); return; }
    if (!this.docFile) { this.feedback.blocked(this.fileError() || 'Sélectionnez un fichier à déposer.', 'Dépôt incomplet'); return; }
    this.uploading.set(true);
    this.ops.uploadDocument(this.resource(), this.uuid(), this.uploadKind() as RentalDocumentKind, this.docFile).subscribe({
      next: () => { this.uploading.set(false); this.toast.success('Document déposé'); this.docFile = null; this.loadDocs(); },
      error: (err: ProblemDetails) => { this.uploading.set(false); this.fail('Dépôt refusé', err); },
    });
  }

  uploadPhoto(): void {
    if (!this.photoFile) { this.feedback.blocked(this.photoError() || 'Sélectionnez une photo.', 'Photo manquante'); return; }
    this.uploading.set(true);
    this.ops.uploadVehiclePhoto(this.uuid(), this.photoFile).subscribe({
      next: () => { this.uploading.set(false); this.toast.success('Photo ajoutée'); this.photoFile = null; this.loadDocs(); },
      error: (err: ProblemDetails) => { this.uploading.set(false); this.fail('Envoi refusé', err); },
    });
  }

  openDoc(d: RentalDocument): void {
    this.opening.set(d.uuid);
    this.ops.documentLink(this.resource(), this.uuid(), d.uuid).subscribe({
      next: (l) => { this.opening.set(null); if (typeof window !== 'undefined') window.open(l.url, '_blank', 'noopener'); },
      error: (err: ProblemDetails) => { this.opening.set(null); this.fail('Ouverture impossible', err); },
    });
  }

  // --- Operating hours --------------------------------------------------------
  private hoursLoaded = false;
  protected readonly loadingHours = signal(false);
  protected readonly savingHours = signal(false);
  protected readonly hoursConfigured = signal(false);
  protected readonly hoursError = signal('');
  protected readonly days = signal<DayRow[]>(DAYS.map((label, i) => ({ weekday: i + 1, label, open: false, opens: '08:00', closes: '18:00', extra: [] })));
  protected readonly exceptions = signal<ExcRow[]>([]);

  private loadHours(): void {
    this.loadingHours.set(true);
    this.ops.getHours(this.resource(), this.uuid()).subscribe({
      next: (h) => { this.loadingHours.set(false); this.hoursLoaded = true; this.applyHours(h); },
      error: (err: ProblemDetails) => { this.loadingHours.set(false); this.fail('Chargement impossible', err); },
    });
  }

  private applyHours(h: OperatingHours): void {
    this.hoursConfigured.set(h.configured);
    this.days.set(DAYS.map((label, i) => {
      const slots = h.weekly_hours.filter((w) => w.weekday === i + 1);
      return { weekday: i + 1, label, open: slots.length > 0, opens: slots[0]?.opens_at ?? '08:00', closes: slots[0]?.closes_at ?? '18:00', extra: slots.slice(1) };
    }));
    this.exceptions.set(h.exceptions.map((e: HoursException) => ({
      date: e.date, closed: e.intervals.length === 0, opens: e.intervals[0]?.opens_at ?? '08:00', closes: e.intervals[0]?.closes_at ?? '18:00',
    })));
  }

  patchDay(i: number, p: Partial<DayRow>): void { this.days.update((d) => d.map((r, k) => (k === i ? { ...r, ...p } : r))); }
  patchExc(i: number, p: Partial<ExcRow>): void { this.exceptions.update((d) => d.map((r, k) => (k === i ? { ...r, ...p } : r))); }
  addExc(): void { this.exceptions.update((d) => [...d, { date: '', closed: true, opens: '08:00', closes: '18:00' }]); }
  removeExc(i: number): void { this.exceptions.update((d) => d.filter((_, k) => k !== i)); }

  dayError(r: DayRow): string {
    if (!r.opens || !r.closes) return 'Renseignez l’ouverture et la fermeture.';
    return r.closes > r.opens ? '' : 'La fermeture doit être après l’ouverture.';
  }

  saveHours(): void {
    const weekly: WeeklyHours[] = [];
    for (const r of this.days()) {
      if (!r.open) continue;
      const e = this.dayError(r);
      if (e) { this.hoursError.set(`${r.label} : ${e}`); this.feedback.blocked(`${r.label} : ${e}`, 'Horaires invalides'); return; }
      weekly.push({ weekday: r.weekday, opens_at: r.opens, closes_at: r.closes }, ...r.extra);
    }
    const seen = new Set<string>();
    const exc: HoursException[] = [];
    for (const x of this.exceptions()) {
      if (!x.date) { this.hoursError.set('Chaque exception doit avoir une date.'); this.feedback.blocked('Chaque exception doit avoir une date.', 'Horaires invalides'); return; }
      if (seen.has(x.date)) { this.hoursError.set(`La date ${x.date} est en double.`); this.feedback.blocked(`La date ${x.date} est en double.`, 'Horaires invalides'); return; }
      seen.add(x.date);
      if (!x.closed && x.closes <= x.opens) { this.hoursError.set(`${x.date} : la fermeture doit être après l’ouverture.`); this.feedback.blocked(`${x.date} : la fermeture doit être après l’ouverture.`, 'Horaires invalides'); return; }
      exc.push({ date: x.date, intervals: x.closed ? [] : [{ opens_at: x.opens, closes_at: x.closes }] });
    }
    this.hoursError.set('');
    this.savingHours.set(true);
    this.ops.saveHours(this.resource(), this.uuid(), { timezone: 'Africa/Douala', weekly_hours: weekly, exceptions: exc }).subscribe({
      next: (h) => { this.savingHours.set(false); this.applyHours(h); this.toast.success('Horaires enregistrés'); },
      error: (err: ProblemDetails) => { this.savingHours.set(false); this.hoursError.set(err.detail); this.fail('Enregistrement refusé', err); },
    });
  }

  // --- Maintenance (vehicles) ----------------------------------------------------
  protected readonly savingRange = signal(false);
  protected readonly rangeForm = this.fb.nonNullable.group({
    starts_at: ['', [Validators.required]],
    ends_at: ['', [Validators.required]],
    reason: ['', [Validators.required, Validators.maxLength(255)]],
  }, { validators: [endAfterStart] });

  submitMaintenance(): void {
    if (this.rangeForm.invalid) { this.feedback.invalid(this.rangeForm); return; }
    const v = this.rangeForm.getRawValue();
    this.savingRange.set(true);
    this.ops.recordMaintenance(this.uuid(), { starts_at: localToIso(v.starts_at), ends_at: localToIso(v.ends_at), reason: v.reason.trim() }).subscribe({
      next: () => { this.savingRange.set(false); this.rangeForm.reset({ starts_at: '', ends_at: '', reason: '' }); this.toast.success('Maintenance enregistrée', 'Le véhicule est bloqué sur cette période.'); },
      error: (err: ProblemDetails) => { this.savingRange.set(false); this.fail('Blocage refusé', err, this.rangeForm); },
    });
  }

  // --- Authorisations (drivers) ----------------------------------------------------
  protected readonly savingAuth = signal(false);
  protected readonly authError = signal('');
  protected readonly loadingAuth = signal(false);
  protected readonly authorizations = signal<AuthRow[]>([]);
  protected readonly authForm = this.fb.nonNullable.group({
    vehicle_uuid: [''],
    vehicle_category: ['', [Validators.maxLength(120)]],
    starts_at: ['', [Validators.required]],
    ends_at: [''],
  });

  submitAuth(): void {
    const v = this.authForm.getRawValue();
    if (this.authForm.invalid) { this.feedback.invalid(this.authForm); return; }
    if (!!v.vehicle_uuid === !!v.vehicle_category.trim()) {
      const m = v.vehicle_uuid ? 'Choisissez soit un véhicule, soit une catégorie — pas les deux.' : 'Choisissez un véhicule ou saisissez une catégorie de véhicule.';
      this.authError.set(m); this.feedback.blocked(m, 'Autorisation incomplète'); return;
    }
    if (v.ends_at && v.ends_at <= v.starts_at) { const m = 'La fin doit être postérieure au début.'; this.authError.set(m); this.feedback.blocked(m, 'Autorisation invalide'); return; }
    this.authError.set('');
    this.savingAuth.set(true);
    this.ops.authorizeDriver(this.uuid(), {
      ...(v.vehicle_uuid ? { vehicle_uuid: v.vehicle_uuid } : { vehicle_category: v.vehicle_category.trim() }),
      starts_at: localToIso(v.starts_at), ends_at: v.ends_at ? localToIso(v.ends_at) : null,
    }).subscribe({
      next: () => { this.savingAuth.set(false); this.authForm.reset({ vehicle_uuid: '', vehicle_category: '', starts_at: '', ends_at: '' }); this.toast.success('Chauffeur autorisé'); this.loadAuthorizations(); },
      error: (err: ProblemDetails) => { this.savingAuth.set(false); this.authError.set(err.detail); this.fail('Autorisation refusée', err, this.authForm); },
    });
  }

  private loadAuthorizations(): void {
    this.loadingAuth.set(true);
    this.ops.getResource('drivers', this.uuid()).subscribe({
      next: (d) => {
        this.loadingAuth.set(false);
        const list = Array.isArray(d['vehicles']) ? (d['vehicles'] as Record<string, unknown>[]) : [];
        this.authorizations.set(list.map((v): AuthRow => ({
          authorization_uuid: String(v['authorization_uuid']), registration: (v['registration'] as string) ?? '', brand: (v['brand'] as string) ?? '',
          model: (v['model'] as string) ?? '', category: (v['category'] as string) ?? '', from: (v['authorized_from'] as string) ?? '', until: (v['authorized_until'] as string | null) ?? null,
        })));
      },
      error: () => { this.loadingAuth.set(false); this.authorizations.set([]); },
    });
  }

  async revoke(a: AuthRow): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Révoquer cette autorisation ?', message: `${a.registration || a.category} — ${this.label()}`, danger: true, confirmLabel: 'Révoquer' }))) return;
    this.ops.revokeAuthorization(this.uuid(), a.authorization_uuid).subscribe({
      next: () => { this.toast.success('Autorisation révoquée'); this.loadAuthorizations(); },
      error: (err: ProblemDetails) => this.fail('Révocation refusée', err),
    });
  }
}
