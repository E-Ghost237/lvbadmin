import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateZoneRequest, PricingGridStatus, PricingGridSummary, PricingService, Zone, ZoneType } from '../../../core/services/pricing.service';
import { CommissionService } from '../../../core/services/commission.service';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { PartnersService } from '../../../core/services/partners.service';
import { CreateCommissionRuleRequest, GeoPoint, MarketplaceCategory, PartnerCommissionRule, ProblemDetails } from '../../../core/models';
import { formatDate, formatPercent, formatXaf } from '../../../core/utils/formatters';
import {
  ColumnDef,
  ConfirmService,
  DataTableComponent,
  ForbiddenStateComponent,
  FormFeedbackService,
  FormFieldComponent,
  PageHeaderComponent,
  PolygonPickerComponent,
  SegmentOption,
  SegmentedControlComponent,
  SelectComponent,
  SelectOption,
  TabDef,
  TabsComponent,
  ToastService,
} from '../../../shared/ui';

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  COUVERTURE: 'Couverture', INTERDITE: 'Interdite', MAJORATION: 'Majoration', DIFFICILE: 'Difficile',
};
const ZONE_TYPE_OPTIONS: SelectOption[] = (Object.keys(ZONE_TYPE_LABELS) as ZoneType[])
  .map((value) => ({ value, label: ZONE_TYPE_LABELS[value] }));

const CITY_SEGMENT_OPTIONS: SegmentOption[] = [{ value: 'Douala', label: 'Douala' }, { value: 'Yaoundé', label: 'Yaoundé' }];
const CITY_SELECT_OPTIONS: SelectOption[] = [{ value: 'Douala', label: 'Douala' }, { value: 'Yaoundé', label: 'Yaoundé' }];

const GRID_STATUS_LABELS: Record<PricingGridStatus, string> = {
  BROUILLON: 'Brouillon', ACTIVE: 'Active', ARCHIVEE: 'Archivée',
};
const GRID_STATUS_COLORS: Record<PricingGridStatus, string> = {
  BROUILLON: 'var(--text-muted)', ACTIVE: 'var(--status-good)', ARCHIVEE: 'var(--text-muted)',
};

import { xafAmount } from '../../../core/utils/validators';

@Component({
  selector: 'app-pricing-page',
  imports: [
  DataTableComponent,
  ForbiddenStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  PolygonPickerComponent,
  ReactiveFormsModule,
  SegmentedControlComponent,
  SelectComponent,
  TabsComponent,
],
  templateUrl: './pricing-page.component.html',
})
export class PricingPageComponent {
  private readonly pricing = inject(PricingService);
  private readonly commissionSvc = inject(CommissionService);
  private readonly marketplace = inject(MarketplaceService);
  private readonly partners = inject(PartnersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);

  protected readonly tabs: TabDef[] = [
    { id: 'grilles', label: 'Grilles tarifaires' }, { id: 'zones', label: 'Zones' }, { id: 'commissions', label: 'Commissions' },
  ];
  protected readonly activeTab = signal('grilles');
  protected readonly zoneTypeLabel = ZONE_TYPE_LABELS;
  protected readonly zoneTypeOptions = ZONE_TYPE_OPTIONS;
  protected readonly citySegmentOptions = CITY_SEGMENT_OPTIONS;
  protected readonly citySelectOptions = CITY_SELECT_OPTIONS;
  protected readonly gridStatusLabel = GRID_STATUS_LABELS;
  protected readonly gridStatusColor = GRID_STATUS_COLORS;

  xaf(amount: number): string {
    return formatXaf(amount);
  }

  // --- Grilles --------------------------------------------------------
  protected readonly grilleForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(50)]],
    ville: ['Douala', [Validators.required]],
    frais_prise_en_charge: [500, [Validators.required, xafAmount(0)]],
    tarif_km: [150, [Validators.required, xafAmount(0)]],
    tarif_minute: [15, [Validators.required, xafAmount(0)]],
    prix_minimum: [1000, [Validators.required, xafAmount(0)]],
    arrondi: [25, [Validators.required, xafAmount(0)]],
    plafond_remise: [1000],
  });
  protected readonly creatingGrille = signal(false);

  protected readonly gridCity = signal('Douala');
  protected readonly grids = signal<PricingGridSummary[]>([]);
  protected readonly loadingGrids = signal(true);
  protected readonly forbiddenGrids = signal(false);
  protected readonly activatingUuid = signal<string | null>(null);

  selectGridCity(v: string): void {
    this.gridCity.set(v);
    this.fetchGrids();
  }

  fetchGrids(): void {
    this.loadingGrids.set(true);
    this.forbiddenGrids.set(false);
    this.pricing.listPricingGrids({ city: this.gridCity() }).subscribe({
      next: (page) => {
        this.loadingGrids.set(false);
        this.grids.set(page.items);
      },
      error: (err: ProblemDetails) => {
        this.loadingGrids.set(false);
        if (err.status === 403) this.forbiddenGrids.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  createGrille(): void {
    if (this.grilleForm.invalid) {
      this.feedback.invalid(this.grilleForm);
      return;
    }
    const v = this.grilleForm.getRawValue();
    this.creatingGrille.set(true);
    this.pricing.createGrille(v).subscribe({
      next: () => {
        this.creatingGrille.set(false);
        this.toast.success('Grille créée (brouillon)');
        this.grilleForm.reset({ nom: '', ville: v.ville, frais_prise_en_charge: 500, tarif_km: 150, tarif_minute: 15, prix_minimum: 1000, arrondi: 25, plafond_remise: 1000 });
        if (v.ville === this.gridCity()) this.fetchGrids();
      },
      error: (err: ProblemDetails) => {
        this.creatingGrille.set(false);
        this.toast.error('Échec de la création', err.detail);
      },
    });
  }

  async activateGrid(g: PricingGridSummary): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Activer cette grille ?', message: `La grille active actuelle de ${g.city} sera archivée.` });
    if (!ok) return;
    this.activatingUuid.set(g.uuid);
    this.pricing.activateGrille(g.uuid, g.city).subscribe({
      next: () => {
        this.activatingUuid.set(null);
        this.toast.success('Grille activée');
        this.fetchGrids();
      },
      error: (err: ProblemDetails) => {
        this.activatingUuid.set(null);
        this.toast.error('Échec de l’activation', err.detail);
      },
    });
  }

  // --- Zones ------------------------------------------------------------
  protected readonly zoneVille = signal('Douala');
  protected readonly zones = signal<Zone[]>([]);
  protected readonly loadingZones = signal(true);
  protected readonly forbiddenZones = signal(false);

  protected readonly zoneFormOpen = signal(false);
  protected readonly zoneForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['COUVERTURE' as ZoneType, [Validators.required]],
    supplement_fixe: [0],
    prix_minimum: [0],
  });
  protected readonly zonePoints = signal<GeoPoint[]>([]);
  protected readonly savingZone = signal(false);

  constructor() {
    this.fetchGrids();
    this.fetchZones();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'commissions' && this.commissionRules().length === 0 && !this.loadingCommissions()) {
      this.fetchCommissions();
      this.fetchCommissionCategories();
    }
  }

  selectVille(v: string): void {
    this.zoneVille.set(v);
    this.fetchZones();
  }

  fetchZones(): void {
    this.loadingZones.set(true);
    this.forbiddenZones.set(false);
    this.pricing.listZones(this.zoneVille()).subscribe({
      next: (zones) => {
        this.loadingZones.set(false);
        this.zones.set(zones);
      },
      error: (err: ProblemDetails) => {
        this.loadingZones.set(false);
        if (err.status === 403) this.forbiddenZones.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  openZoneForm(): void {
    this.zoneForm.reset({ nom: '', type: 'COUVERTURE', supplement_fixe: 0, prix_minimum: 0 });
    this.zonePoints.set([]);
    this.zoneFormOpen.set(true);
  }

  onPolygonPoints(points: GeoPoint[]): void {
    this.zonePoints.set(points);
  }

  resetPolygon(): void {
    this.zonePoints.set([]);
  }

  createZone(): void {
    if (this.zoneForm.invalid || this.zonePoints().length < 3) {
      this.feedback.invalid(this.zoneForm);
      return;
    }
    const v = this.zoneForm.getRawValue();
    const req: CreateZoneRequest = {
      nom: v.nom, ville: this.zoneVille(), type: v.type, points: this.zonePoints(),
      supplement_fixe: v.supplement_fixe || null, prix_minimum: v.prix_minimum || null,
    };
    this.savingZone.set(true);
    this.pricing.createZone(req).subscribe({
      next: () => {
        this.savingZone.set(false);
        this.zoneFormOpen.set(false);
        this.toast.success('Zone créée');
        this.fetchZones();
      },
      error: (err: ProblemDetails) => {
        this.savingZone.set(false);
        this.toast.error('Échec de la création', err.detail);
      },
    });
  }

  async deleteZone(zone: Zone): Promise<void> {
    const ok = await this.confirm.ask({ title: `Supprimer la zone ${zone.nom} ?`, message: 'Cette zone sera désactivée.', danger: true });
    if (!ok) return;
    this.pricing.deleteZone(zone.id).subscribe({
      next: () => { this.toast.success('Zone supprimée'); this.fetchZones(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  // --- Commissions (PartnerLedger, RG-PWL-011) -----------------------------
  // Rules are append-only/immutable — no edit/delete, only "create a new,
  // higher-version rule for the same scope" (see CommissionService docblock).

  protected readonly commissionForm = this.fb.nonNullable.group({
    partner_uuid: [''],
    category_uuid: [''],
    basis_points: [1000, [Validators.required, xafAmount(0, 10000)]],
    valid_from: [PricingPageComponent.todayIso(), [Validators.required]],
    valid_to: [''],
    reason: ['', [Validators.required, Validators.maxLength(1000)]],
  });
  protected readonly creatingCommission = signal(false);
  protected readonly commissionPartnerName = signal<string | null>(null);
  protected readonly lookingUpCommissionPartner = signal(false);

  protected readonly commissionCategories = signal<MarketplaceCategory[]>([]);
  protected readonly commissionCategoryOptions = signal<SelectOption[]>([]);

  protected readonly commissionRules = signal<PartnerCommissionRule[]>([]);
  protected readonly loadingCommissions = signal(false);
  protected readonly forbiddenCommissions = signal(false);

  protected readonly commissionColumns: ColumnDef<PartnerCommissionRule>[] = [
    { key: 'scope', label: 'Portée', cell: (r) => (r.partner_uuid ? `Partenaire ${r.partner_uuid.slice(0, 8)}…` : 'Global') },
    { key: 'category_uuid', label: 'Catégorie', cell: (r) => this.categoryName(r.category_uuid) },
    { key: 'basis_points', label: 'Taux', cell: (r) => formatPercent(r.basis_points / 100) },
    { key: 'valid_from', label: 'Valide du', cell: (r) => formatDate(r.valid_from) },
    { key: 'valid_to', label: 'Valide jusqu’au', cell: (r) => (r.valid_to ? formatDate(r.valid_to) : 'Sans fin') },
    { key: 'version', label: 'Version' },
    { key: 'reason', label: 'Motif' },
  ];
  protected readonly trackByCommissionUuid = (row: PartnerCommissionRule) => row.uuid;

  private static todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  categoryName(uuid: string | null): string {
    if (!uuid) return 'Toutes catégories';
    return this.commissionCategories().find((c) => c.uuid === uuid)?.name ?? uuid;
  }

  fetchCommissions(): void {
    this.loadingCommissions.set(true);
    this.forbiddenCommissions.set(false);
    this.commissionSvc.list().subscribe({
      next: (page) => { this.loadingCommissions.set(false); this.commissionRules.set(page.items); },
      error: (err: ProblemDetails) => {
        this.loadingCommissions.set(false);
        if (err.status === 403) this.forbiddenCommissions.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  fetchCommissionCategories(): void {
    this.marketplace.listCategories().subscribe({
      next: (page) => {
        this.commissionCategories.set(page.items);
        this.commissionCategoryOptions.set(page.items.map((c) => ({ value: c.uuid, label: c.name })));
      },
      error: () => undefined,
    });
  }

  onCommissionPartnerUuidInput(): void {
    this.commissionPartnerName.set(null);
  }

  lookupCommissionPartner(): void {
    const uuid = this.commissionForm.controls.partner_uuid.value.trim();
    if (!uuid) { this.commissionPartnerName.set(null); return; }
    this.lookingUpCommissionPartner.set(true);
    this.partners.get(uuid).subscribe({
      next: (p) => { this.lookingUpCommissionPartner.set(false); this.commissionPartnerName.set(p.nom_commercial); },
      error: (err: ProblemDetails) => {
        this.lookingUpCommissionPartner.set(false);
        this.commissionPartnerName.set(null);
        this.toast.error('Partenaire introuvable', err.detail);
      },
    });
  }

  createCommission(): void {
    if (this.commissionForm.invalid) {
      this.feedback.invalid(this.commissionForm);
      return;
    }
    const v = this.commissionForm.getRawValue();
    const req: CreateCommissionRuleRequest = {
      partner_uuid: v.partner_uuid.trim() || null,
      category_uuid: v.category_uuid || null,
      basis_points: v.basis_points,
      valid_from: v.valid_from,
      valid_to: v.valid_to || null,
      reason: v.reason,
    };
    this.creatingCommission.set(true);
    this.commissionSvc.create(req).subscribe({
      next: () => {
        this.creatingCommission.set(false);
        this.toast.success('Règle de commission créée');
        this.commissionForm.reset({
          partner_uuid: '', category_uuid: '', basis_points: 1000, valid_from: PricingPageComponent.todayIso(), valid_to: '', reason: '',
        });
        this.commissionPartnerName.set(null);
        this.fetchCommissions();
      },
      error: (err: ProblemDetails) => { this.creatingCommission.set(false); this.toast.error('Échec de la création', err.detail); },
    });
  }
}
