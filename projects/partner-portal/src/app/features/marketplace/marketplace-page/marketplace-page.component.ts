import { Component, inject, signal } from '@angular/core';
import { intRange, requireOneOf, xafAmount } from '@lvb/utils/validators';
import { LabelsService } from '../../../core/services/labels.service';
import { RatePlanSimulatorComponent } from '../rate-plan-simulator.component';
import { PartnerContextService } from '../../../core/services/partner-context.service';
import { FormFeedbackService } from '@lvb/ui/form-feedback/form-feedback.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RatePlanService } from '../../../core/services/rate-plan.service';
import { OfferService } from '../../../core/services/offer.service';
import { FleetService } from '../../../core/services/fleet.service';
import {
  RATE_PLAN_MODE_VALUES, RatePlan, RatePlanMode, RoundingMode, SaveOfferRequest, SaveRatePlanRequest,
} from '../../../core/models';
import {
  MARKETPLACE_OFFER_STATUS_VALUES, MarketplaceCategory, MarketplaceOffer, MarketplaceOfferStatus, OfferBookingMode,
} from '@lvb/models/marketplace.model';
import { Vehicle } from '@lvb/models/rental.model';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatXaf } from '@lvb/utils/formatters';
import { I18nService } from '@lvb/i18n/i18n.service';
import { BreadcrumbsComponent } from '@lvb/ui/breadcrumbs/breadcrumbs.component';
import { TabDef, TabsComponent } from '@lvb/ui/tabs/tabs.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatusBadgeComponent } from '@lvb/ui/status-badge/status-badge.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ColumnDef, DataTableComponent } from '@lvb/ui/table/data-table.component';
import { TableCellDefDirective } from '@lvb/ui/table/table-cell-def.directive';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { ConfirmService } from '@lvb/ui/confirm/confirm.service';
import { ToastService } from '@lvb/ui/toast/toast.service';

const BOOKING_MODE_OPTIONS: SelectOption[] = [
  { value: 'AUTO_CONFIRM', label: 'Confirmation automatique' },
  { value: 'PARTNER_CONFIRM', label: 'Confirmation par le partenaire' },
];

/**
 * The partner-reachable subset of `OfferPublication::TRANSITIONS` —
 * `PUBLIEE`/`REJETEE` are admin-only targets, and `SUSPENDUE → PUBLIEE`
 * (present in the raw backend table) is blocked for a non-admin actor by
 * `assertTransition()`'s `!$admin` guard even though it's a legal edge in
 * the table itself.
 */
const OFFER_TRANSITIONS: Record<MarketplaceOfferStatus, MarketplaceOfferStatus[]> = {
  BROUILLON: ['EN_REVUE', 'ARCHIVEE'],
  EN_REVUE: ['BROUILLON', 'ARCHIVEE'],
  PUBLIEE: ['SUSPENDUE', 'EN_REVUE', 'ARCHIVEE'],
  SUSPENDUE: ['EN_REVUE', 'ARCHIVEE'],
  REJETEE: ['BROUILLON', 'ARCHIVEE'],
  ARCHIVEE: [],
};
const TRANSITION_LABEL: Record<MarketplaceOfferStatus, string> = {
  BROUILLON: 'Renvoyer en brouillon', EN_REVUE: 'Soumettre pour revue', PUBLIEE: 'Publier',
  SUSPENDUE: 'Suspendre', ARCHIVEE: 'Archiver', REJETEE: 'Rejeter',
};
const TRANSITION_DANGER: Partial<Record<MarketplaceOfferStatus, boolean>> = { SUSPENDUE: true, ARCHIVEE: true };

interface OfferAction {
  target: MarketplaceOfferStatus;
  label: string;
  danger: boolean;
}

/**
 * Marketplace self-service — `/v1/partner/{offers,rate-plans}*`
 * (LVB-CDC-MKT-RENT-2026-V1.0). Only RESPONSABLE_PARTENAIRE has
 * `marketplace.offer.*`/`pricing.manage`. An offer requires an active rate
 * plan (and, for a rental listing, a vehicle or vehicle category) before it
 * can be published — rate plans are managed in the first tab so one exists
 * before creating an offer in the second.
 */
@Component({
  selector: 'app-marketplace-page',
  imports: [
    ReactiveFormsModule, BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent,
    SelectComponent, DataTableComponent, TableCellDefDirective, FormFieldComponent,
    RatePlanSimulatorComponent,
  ],
  templateUrl: './marketplace-page.component.html',
})
export class MarketplacePageComponent {
  private readonly ratePlanSvc = inject(RatePlanService);
  private readonly offerSvc = inject(OfferService);
  private readonly fleet = inject(FleetService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  protected readonly i18n = inject(I18nService);

  protected readonly ctx = inject(PartnerContextService);
  protected readonly simulating = signal<RatePlan | null>(null);
  protected readonly canPricing = this.ctx.can('pricing.manage');
  protected readonly canCreateOffer = this.ctx.can('marketplace.offer.create');
  protected readonly canUpdateOffer = this.ctx.can('marketplace.offer.update');
  // Rate plans need `pricing.manage` (responsable only); other roles just see the offers.
  protected readonly tabs: TabDef[] = this.canPricing
    ? [{ id: 'ratePlans', label: 'Tarifs' }, { id: 'offers', label: 'Offres' }]
    : [{ id: 'offers', label: 'Offres' }];
  protected readonly activeTab = signal(this.canPricing ? 'ratePlans' : 'offers');
  protected readonly bookingModeOptions = BOOKING_MODE_OPTIONS;

  xaf(amount: number | null | undefined): string {
    return formatXaf(amount ?? null);
  }

  protected readonly labels = inject(LabelsService);

  constructor() {
    this.labels.ensure('vehicle', 'ratePlan');
    if (this.canPricing) {
      this.fetchRatePlans();
      this.fetchVehicles();
    } else {
      this.selectTab('offers');
    }
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'offers' && this.offers().length === 0 && !this.loadingOffers()) {
      this.fetchOffers();
      this.fetchCategories();
    }
  }

  // --- Rate plans -----------------------------------------------------

  protected readonly ratePlanModeOptions: SelectOption[] = RATE_PLAN_MODE_VALUES.map((m) => ({ value: m, label: m }));
  protected readonly ratePlanColumns: ColumnDef<RatePlan>[] = [
    { key: 'name', label: 'Nom' },
    { key: 'mode', label: 'Mode' },
    { key: 'active', label: 'Actif', cell: (r) => (r.active ? 'Oui' : 'Non') },
    { key: 'version', label: 'Version' },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByRatePlanUuid = (row: RatePlan) => row.uuid;

  protected readonly ratePlans = signal<RatePlan[]>([]);
  protected readonly loadingRatePlans = signal(true);
  protected readonly forbiddenRatePlans = signal(false);
  protected readonly ratePlansCursor = signal<number | null>(null);
  protected readonly activatingRatePlan = signal<string | null>(null);

  protected readonly ratePlanFormOpen = signal(false);
  protected readonly editingRatePlan = signal<RatePlan | null>(null);
  protected readonly savingRatePlan = signal(false);
  protected readonly ratePlanForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    mode: ['' as RatePlanMode | '', [Validators.required]],
    active: [false],
    base_amount: [0, [xafAmount(0, 1_000_000_000)]],
    duration_amount: [0, [xafAmount(0, 1_000_000_000)]],
    kilometer_amount: [0, [xafAmount(0, 1_000_000_000)]],
    trip_amount: [0, [xafAmount(0, 1_000_000_000)]],
    minimum_amount: [0, [xafAmount(0, 1_000_000_000)]],
    driver_amount: [0, [xafAmount(0, 1_000_000_000)]],
    handling_amount: [0, [xafAmount(0, 1_000_000_000)]],
    fuel_amount: [0, [xafAmount(0, 1_000_000_000)]],
    toll_amount: [0, [xafAmount(0, 1_000_000_000)]],
    insurance_amount: [0, [xafAmount(0, 1_000_000_000)]],
    waiting_hour_amount: [0, [xafAmount(0, 1_000_000_000)]],
    discount_amount: [0, [xafAmount(0, 1_000_000_000)]],
    tax_bps: [0, [intRange(0, 10000)]],
    minimum_minutes: [1, [intRange(1, 525600)]],
    maximum_minutes: [null as number | null, [intRange(1, 525600)]],
    increment_minutes: [1, [intRange(1, 525600)]],
    unit_minutes: [1, [intRange(1, 525600)]],
    rounding: ['NEAREST' as RoundingMode],
  });

  protected readonly ratePlansForOfferOptions = signal<SelectOption[]>([]);

  fetchRatePlans(cursor?: number): void {
    this.loadingRatePlans.set(true);
    this.forbiddenRatePlans.set(false);
    this.ratePlanSvc.list({ cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingRatePlans.set(false);
        const items = cursor ? [...this.ratePlans(), ...page.items] : page.items;
        this.ratePlans.set(items);
        this.ratePlansCursor.set(page.next_cursor);
        this.ratePlansForOfferOptions.set(items.map((p) => ({ value: p.uuid, label: `${p.name} (${p.mode})` })));
      },
      error: (err: ProblemDetails) => {
        this.loadingRatePlans.set(false);
        if (err.status === 403) this.forbiddenRatePlans.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  openNewRatePlanForm(): void {
    this.editingRatePlan.set(null);
    this.ratePlanForm.reset({
      name: '', mode: '', active: false, base_amount: 0, duration_amount: 0, kilometer_amount: 0, trip_amount: 0,
      minimum_amount: 0, driver_amount: 0, handling_amount: 0, fuel_amount: 0, toll_amount: 0, insurance_amount: 0,
      waiting_hour_amount: 0, discount_amount: 0, tax_bps: 0, minimum_minutes: 1, maximum_minutes: null,
      increment_minutes: 1, unit_minutes: 1, rounding: 'NEAREST',
    });
    this.ratePlanFormOpen.set(true);
  }

  openEditRatePlanForm(plan: RatePlan): void {
    this.editingRatePlan.set(plan);
    const p = plan.parameters;
    this.ratePlanForm.reset({
      name: plan.name, mode: plan.mode, active: plan.active,
      base_amount: p.base_amount ?? 0, duration_amount: p.duration_amount ?? 0, kilometer_amount: p.kilometer_amount ?? 0,
      trip_amount: p.trip_amount ?? 0, minimum_amount: p.minimum_amount ?? 0, driver_amount: p.driver_amount ?? 0,
      handling_amount: p.handling_amount ?? 0, fuel_amount: p.fuel_amount ?? 0, toll_amount: p.toll_amount ?? 0,
      insurance_amount: p.insurance_amount ?? 0, waiting_hour_amount: p.waiting_hour_amount ?? 0,
      discount_amount: p.discount_amount ?? 0, tax_bps: p.tax_bps ?? 0, minimum_minutes: p.minimum_minutes ?? 1,
      maximum_minutes: p.maximum_minutes ?? null, increment_minutes: p.increment_minutes ?? 1,
      unit_minutes: p.unit_minutes ?? 1, rounding: p.rounding ?? 'NEAREST',
    });
    this.ratePlanFormOpen.set(true);
  }

  submitRatePlanForm(): void {
    if (this.ratePlanForm.invalid) {
      this.feedback.invalid(this.ratePlanForm);
      return;
    }
    const v = this.ratePlanForm.getRawValue();
    const req: SaveRatePlanRequest = {
      name: v.name, mode: v.mode || undefined, active: v.active,
      parameters: {
        base_amount: v.base_amount, duration_amount: v.duration_amount, kilometer_amount: v.kilometer_amount,
        trip_amount: v.trip_amount, minimum_amount: v.minimum_amount, driver_amount: v.driver_amount,
        handling_amount: v.handling_amount, fuel_amount: v.fuel_amount, toll_amount: v.toll_amount,
        insurance_amount: v.insurance_amount, waiting_hour_amount: v.waiting_hour_amount,
        discount_amount: v.discount_amount, tax_bps: v.tax_bps, minimum_minutes: v.minimum_minutes,
        maximum_minutes: v.maximum_minutes ?? undefined, increment_minutes: v.increment_minutes,
        unit_minutes: v.unit_minutes, rounding: v.rounding,
      },
    };
    this.savingRatePlan.set(true);
    const editing = this.editingRatePlan();
    const obs = editing ? this.ratePlanSvc.update(editing.uuid, req) : this.ratePlanSvc.create(req);
    obs.subscribe({
      next: () => {
        this.savingRatePlan.set(false);
        this.ratePlanFormOpen.set(false);
        this.toast.success(editing ? 'Tarif mis à jour' : 'Tarif créé');
        this.fetchRatePlans();
      },
      error: (err: ProblemDetails) => { this.savingRatePlan.set(false); this.feedback.serverError(this.ratePlanForm, 'Échec', err); },
    });
  }

  activateRatePlan(plan: RatePlan): void {
    this.activatingRatePlan.set(plan.uuid);
    this.ratePlanSvc.activate(plan.uuid).subscribe({
      next: () => { this.activatingRatePlan.set(null); this.toast.success('Tarif activé'); this.fetchRatePlans(); },
      error: (err: ProblemDetails) => { this.activatingRatePlan.set(null); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Vehicles (for the offer form's vehicle picker) ----------------------

  protected readonly vehicleOptions = signal<SelectOption[]>([]);

  fetchVehicles(): void {
    this.fleet.listVehicles({ limit: 100 }).subscribe({
      next: (page) => this.vehicleOptions.set(page.items.map((v: Vehicle) => ({ value: v.uuid, label: `${v.registration} — ${v.brand} ${v.model}` }))),
      error: () => undefined,
    });
  }

  // --- Offers -----------------------------------------------------------

  protected readonly offerStatusOptions: SelectOption[] = MARKETPLACE_OFFER_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.marketplaceOffer.' + s),
  }));
  protected readonly categories = signal<MarketplaceCategory[]>([]);
  protected readonly categoryOptions = signal<SelectOption[]>([]);

  protected readonly offerColumns: ColumnDef<MarketplaceOffer>[] = [
    { key: 'title', label: 'Offre' },
    // The backend's offer rows carry only a numeric category id (no name, no uuid), so the category can't be named here yet.
    { key: 'vehicle_uuid', label: 'Véhicule', cell: (r) => (r.vehicle_uuid ? this.labels.label('vehicle', r.vehicle_uuid) : (r.vehicle_category ?? '—')) },
    { key: 'rate_plan_uuid', label: 'Tarif', cell: (r) => this.labels.label('ratePlan', r.rate_plan_uuid) },
    { key: 'city', label: 'Ville' },
    { key: 'status', label: 'Statut' },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByOfferUuid = (row: MarketplaceOffer) => row.uuid;

  protected readonly offers = signal<MarketplaceOffer[]>([]);
  protected readonly loadingOffers = signal(false);
  protected readonly forbiddenOffers = signal(false);
  protected readonly offersCursor = signal<string | null>(null);
  protected readonly offerStatusFilter = signal<MarketplaceOfferStatus | ''>('');
  protected readonly transitioning = signal<string | null>(null);

  protected readonly offerFormOpen = signal(false);
  protected readonly editingOffer = signal<MarketplaceOffer | null>(null);
  protected readonly savingOffer = signal(false);
  protected readonly offerForm = this.fb.nonNullable.group({
    category_uuid: [''],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    description: ['', [Validators.required, Validators.maxLength(10000)]],
    city: ['', [Validators.required, Validators.maxLength(120)]],
    service_zones: ['', [Validators.required]],
    vehicle_uuid: [''],
    vehicle_category: [''],
    rate_plan_uuid: ['', [Validators.required]],
    booking_mode: ['AUTO_CONFIRM' as OfferBookingMode],
    with_driver: [false],
    indicative_amount: [null as number | null, [xafAmount(0, 1_000_000_000)]],
    conditions: [''],
    cancellation_free_hours: [24, [intRange(0, 8760)]],
    cancellation_fee_bps: [0, [intRange(0, 10000)]],
    cancellation_fixed_fee: [0, [xafAmount(0, 1_000_000_000)]],
    cancellation_description: ['', [Validators.required, Validators.maxLength(2000)]],
  }, { validators: [requireOneOf(['vehicle_uuid', 'vehicle_category'], 'vehicle')] });

  protected readonly categoriesLoaded = signal(false);
  protected readonly categoriesError = signal('');

  fetchCategories(): void {
    this.categoriesError.set('');
    this.offerSvc.listCategories().subscribe({
      next: (page) => {
        this.categoriesLoaded.set(true);
        this.categories.set(page.items);
        this.categoryOptions.set(// The public feed only lists active categories and omits the `active` flag entirely (the admin feed includes it).
        page.items.filter((c) => (c as { active?: boolean }).active !== false).map((c) => ({ value: c.uuid, label: c.name })));
      },
      error: (err: ProblemDetails) => { this.categoriesLoaded.set(true); this.categoriesError.set(err.detail); },
    });
  }

  fetchOffers(cursor?: string): void {
    this.loadingOffers.set(true);
    this.forbiddenOffers.set(false);
    this.offerSvc.list({ status: this.offerStatusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingOffers.set(false);
        this.offers.set(cursor ? [...this.offers(), ...page.items] : page.items);
        this.offersCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingOffers.set(false);
        if (err.status === 403) this.forbiddenOffers.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onOfferStatusFilterChange(value: string): void {
    this.offerStatusFilter.set(value as MarketplaceOfferStatus | '');
    this.fetchOffers();
  }

  actionsFor(offer: MarketplaceOffer): OfferAction[] {
    return OFFER_TRANSITIONS[offer.status].map((target) => ({
      target, label: TRANSITION_LABEL[target], danger: !!TRANSITION_DANGER[target],
    }));
  }

  async applyTransition(offer: MarketplaceOffer, action: OfferAction): Promise<void> {
    const ok = await this.confirm.ask({
      title: `${action.label} cette offre ?`, message: offer.title, danger: action.danger, confirmLabel: action.label,
    });
    if (!ok) return;
    this.transitioning.set(offer.uuid);
    this.offerSvc.transition(offer.uuid, action.target).subscribe({
      next: () => { this.transitioning.set(null); this.toast.success('Statut mis à jour'); this.fetchOffers(); },
      error: (err: ProblemDetails) => { this.transitioning.set(null); this.toast.error('Échec', err.detail); },
    });
  }

  openNewOfferForm(): void {
    this.editingOffer.set(null);
    this.offerForm.controls.category_uuid.setValidators([Validators.required]);
    this.offerForm.reset({
      category_uuid: '', title: '', description: '', city: '', service_zones: '', vehicle_uuid: '',
      vehicle_category: '', rate_plan_uuid: '', booking_mode: 'AUTO_CONFIRM', with_driver: false,
      indicative_amount: null, conditions: '', cancellation_free_hours: 24, cancellation_fee_bps: 0,
      cancellation_fixed_fee: 0, cancellation_description: '',
    });
    this.offerFormOpen.set(true);
  }

  openEditOfferForm(offer: MarketplaceOffer): void {
    this.editingOffer.set(offer);
    this.offerForm.controls.category_uuid.clearValidators();
    this.offerForm.reset({
      category_uuid: '', title: offer.title, description: offer.description, city: offer.city,
      service_zones: offer.service_zones.join(', '), vehicle_uuid: offer.vehicle_uuid ?? '',
      vehicle_category: offer.vehicle_category ?? '', rate_plan_uuid: offer.rate_plan_uuid,
      booking_mode: offer.booking_mode ?? 'AUTO_CONFIRM', with_driver: offer.with_driver ?? false,
      indicative_amount: offer.indicative_amount ?? null, conditions: offer.conditions ?? '',
      cancellation_free_hours: 24, cancellation_fee_bps: 0, cancellation_fixed_fee: 0, cancellation_description: '',
    });
    this.offerFormOpen.set(true);
  }

  submitOfferForm(): void {
    const editing = this.editingOffer();
    if (this.offerForm.invalid) {
      this.feedback.invalid(this.offerForm);
      return;
    }
    const v = this.offerForm.getRawValue();
    const req: SaveOfferRequest = {
      title: v.title, description: v.description, city: v.city,
      service_zones: v.service_zones.split(',').map((z) => z.trim()).filter(Boolean),
      vehicle_uuid: v.vehicle_uuid || null, vehicle_category: v.vehicle_category || null,
      rate_plan_uuid: v.rate_plan_uuid, booking_mode: v.booking_mode, with_driver: v.with_driver,
      indicative_amount: v.indicative_amount ?? undefined, conditions: v.conditions || null,
      cancellation_policy: {
        free_cancellation_hours: v.cancellation_free_hours, fee_basis_points: v.cancellation_fee_bps,
        fixed_fee_xaf: v.cancellation_fixed_fee, description: v.cancellation_description,
      },
    };
    if (!editing) req.category_uuid = v.category_uuid;
    this.savingOffer.set(true);
    const obs = editing ? this.offerSvc.update(editing.uuid, req) : this.offerSvc.create(req);
    obs.subscribe({
      next: () => {
        this.savingOffer.set(false);
        this.offerFormOpen.set(false);
        this.toast.success(editing ? 'Offre mise à jour' : 'Offre créée');
        this.fetchOffers();
      },
      error: (err: ProblemDetails) => { this.savingOffer.set(false); this.feedback.serverError(this.offerForm, 'Échec', err); },
    });
  }
}
