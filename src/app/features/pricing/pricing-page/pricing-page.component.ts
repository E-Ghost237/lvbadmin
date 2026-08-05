import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { PricingService } from '../../../core/services/pricing.service';
import { ZonesService } from '../../../core/services/zones.service';
import { PricingGrid, PricingSimulationResult, ProblemDetails, Zone, ZoneType } from '../../../core/models';
import { integerAmount, requiredTrimmed, uniqueAmong } from '../../../core/utils/validators';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, ConfirmService, EmptyStateComponent, FormFieldComponent, MapMarker,
  MapPanelComponent, MapZoneShape, ModalComponent, TabDef, TabsComponent, ToggleComponent, ToastService,
} from '../../../shared/ui';

const ZONE_TONE: Record<ZoneType, MapZoneShape['color']> = {
  COUVERTURE: 'var(--status-good)', INTERDITE: 'var(--status-critical)', MAJORATION: 'var(--status-warning)', DIFFICILE: 'var(--series-6)',
};

@Component({
  selector: 'app-pricing-page',
  imports: [
    ReactiveFormsModule, TabsComponent, ModalComponent, FormFieldComponent, AlertBannerComponent, EmptyStateComponent,
    BreadcrumbsComponent, MapPanelComponent, ToggleComponent,
  ],
  templateUrl: './pricing-page.component.html',
})
export class PricingPageComponent {
  private readonly pricingService = inject(PricingService);
  private readonly zonesService = inject(ZonesService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [{ id: 'grids', label: 'Grilles tarifaires' }, { id: 'zones', label: 'Zones' }];
  protected readonly activeTab = signal('grids');

  // --- Grilles ------------------------------------------------------------
  protected readonly grids = signal<PricingGrid[]>([]);
  protected readonly loadingGrids = signal(true);
  protected readonly gridVilleFilter = signal<'TOUS' | 'Douala' | 'Yaoundé'>('TOUS');

  protected readonly showGridForm = signal(false);
  protected readonly gridForm = this.fb.nonNullable.group({
    version_label: ['', [requiredTrimmed(), uniqueAmong(() => this.grids().map((g) => g.version_label))]],
    ville: ['Douala' as 'Douala' | 'Yaoundé', [Validators.required]],
    frais_prise_en_charge: [500, [integerAmount(0)]],
    tarif_par_km: [150, [integerAmount(1)]],
    tarif_par_minute: [15, [integerAmount(0)]],
    prix_minimum: [1000, [integerAmount(0)]],
    arrondi: [25, [integerAmount(1)]],
    coef_urgence_express: [1.4, [Validators.min(1), Validators.max(3)]],
    coef_horaire_soir: [1.15, [Validators.min(1), Validators.max(2)]],
    coef_horaire_nuit: [1.3, [Validators.min(1), Validators.max(2)]],
    supplement_poids_kg: [100, [integerAmount(0)]],
    supplement_volume: [500, [integerAmount(0)]],
    supplement_fragile: [300, [integerAmount(0)]],
    plafond_remise: [1000, [integerAmount(0)]],
    demande_dynamique_active: [true],
    demande_plafond: [1.5, [Validators.min(1), Validators.max(1.5)]],
  });
  protected readonly savingGrid = signal(false);

  protected readonly simulateTarget = signal<PricingGrid | null>(null);
  protected readonly simulateForm = this.fb.nonNullable.group({
    distance_km: [5, [Validators.required, Validators.min(0.1)]],
    duree_min: [20, [Validators.required, Validators.min(1)]],
    urgence: ['STANDARD' as 'STANDARD' | 'EXPRESS' | 'PLANIFIE', [Validators.required]],
    heure: ['14:00', [Validators.required]],
    poids_kg: [2, [Validators.required, Validators.min(0.1)]],
    fragile: [false],
    ratio_demande: [1, [Validators.min(0)]],
  });
  protected readonly simulationResult = signal<PricingSimulationResult | null>(null);
  protected readonly simulating = signal(false);

  // --- Zones ---------------------------------------------------------------
  protected readonly zones = signal<Zone[]>([]);
  protected readonly loadingZones = signal(true);
  protected readonly zoneVilleFilter = signal<'Douala' | 'Yaoundé'>('Douala');
  protected readonly showZoneForm = signal(false);
  protected readonly zoneForm = this.fb.nonNullable.group({
    nom: ['', [requiredTrimmed()]],
    ville: ['Douala' as 'Douala' | 'Yaoundé', [Validators.required]],
    type: ['COUVERTURE' as ZoneType, [Validators.required]],
    lat: [4.05, [Validators.required]],
    lng: [9.7, [Validators.required]],
    rayon_km: [3, [Validators.required, Validators.min(0.1)]],
    supplement_fixe: [0, [integerAmount(0)]],
    prix_minimum: [null as number | null, [integerAmount(0)]],
  });
  protected readonly savingZone = signal(false);

  constructor() {
    this.fetchGrids();
    this.fetchZones();
  }

  selectTab(id: string): void { this.activeTab.set(id); }

  // --- Grilles --------------------------------------------------------------
  private fetchGrids(): void {
    this.loadingGrids.set(true);
    this.pricingService.listGrids(this.gridVilleFilter() === 'TOUS' ? undefined : this.gridVilleFilter()).subscribe((res) => {
      this.grids.set(res);
      this.loadingGrids.set(false);
    });
  }

  filterGrids(ville: 'TOUS' | 'Douala' | 'Yaoundé'): void {
    this.gridVilleFilter.set(ville);
    this.fetchGrids();
  }

  openGridForm(): void {
    this.gridForm.reset({
      version_label: '', ville: 'Douala', frais_prise_en_charge: 500, tarif_par_km: 150, tarif_par_minute: 15,
      prix_minimum: 1000, arrondi: 25, coef_urgence_express: 1.4, coef_horaire_soir: 1.15, coef_horaire_nuit: 1.3,
      supplement_poids_kg: 100, supplement_volume: 500, supplement_fragile: 300, plafond_remise: 1000,
      demande_dynamique_active: true, demande_plafond: 1.5,
    });
    this.showGridForm.set(true);
  }

  saveGridDraft(): void {
    if (this.gridForm.invalid) { this.gridForm.markAllAsTouched(); return; }
    this.savingGrid.set(true);
    this.pricingService.createDraft(this.gridForm.getRawValue()).subscribe({
      next: () => {
        this.savingGrid.set(false);
        this.showGridForm.set(false);
        this.fetchGrids();
        this.toast.success('Version créée en brouillon');
      },
      error: (err: ProblemDetails) => { this.savingGrid.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  async activateGrid(grid: PricingGrid): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Activer cette grille', danger: true, confirmLabel: 'Activer',
      message: `${grid.version_label} deviendra la grille active pour ${grid.ville}. La grille actuellement active sera archivée. Continuer ?`,
    });
    if (!ok) return;
    this.pricingService.activate(grid.id).subscribe(() => {
      this.fetchGrids();
      this.toast.success('Grille activée', `${grid.version_label} est maintenant active pour ${grid.ville}.`);
    });
  }

  openSimulate(grid: PricingGrid): void {
    this.simulateTarget.set(grid);
    this.simulationResult.set(null);
    this.simulateForm.reset({ distance_km: 5, duree_min: 20, urgence: 'STANDARD', heure: '14:00', poids_kg: 2, fragile: false, ratio_demande: 1 });
  }

  runSimulation(): void {
    const grid = this.simulateTarget();
    if (!grid || this.simulateForm.invalid) { this.simulateForm.markAllAsTouched(); return; }
    this.simulating.set(true);
    this.pricingService.simulate(grid, this.simulateForm.getRawValue()).subscribe((result) => {
      this.simulating.set(false);
      this.simulationResult.set(result);
    });
  }

  // --- Zones ------------------------------------------------------------------
  private fetchZones(): void {
    this.loadingZones.set(true);
    this.zonesService.list().subscribe((res) => {
      this.zones.set(res);
      this.loadingZones.set(false);
    });
  }

  zonesForCity(ville: 'Douala' | 'Yaoundé'): Zone[] {
    return this.zones().filter((z) => z.ville === ville);
  }

  zoneShapes(ville: 'Douala' | 'Yaoundé'): MapZoneShape[] {
    return this.zonesForCity(ville).map((z) => ({ id: z.id, center: z.centre, radiusKm: z.rayon_km, color: ZONE_TONE[z.type], label: z.nom }));
  }

  toggleZoneActive(zone: Zone): void {
    this.zonesService.toggleActive(zone.id).subscribe(() => this.fetchZones());
  }

  openZoneForm(): void {
    this.zoneForm.reset({ nom: '', ville: this.zoneVilleFilter(), type: 'COUVERTURE', lat: 4.05, lng: 9.7, rayon_km: 3, supplement_fixe: 0, prix_minimum: null });
    this.showZoneForm.set(true);
  }

  saveZone(): void {
    if (this.zoneForm.invalid) { this.zoneForm.markAllAsTouched(); return; }
    const v = this.zoneForm.getRawValue();
    this.savingZone.set(true);
    this.zonesService.create({
      nom: v.nom, ville: v.ville, type: v.type, centre: { lat: v.lat, lng: v.lng }, rayon_km: v.rayon_km,
      supplement_fixe: v.supplement_fixe, prix_minimum: v.prix_minimum ?? undefined, actif: true,
    }).subscribe({
      next: () => {
        this.savingZone.set(false);
        this.showZoneForm.set(false);
        this.fetchZones();
        this.toast.success('Zone créée');
      },
      error: (err: ProblemDetails) => { this.savingZone.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  bboxFor(ville: 'Douala' | 'Yaoundé') {
    return ville === 'Douala'
      ? { latMin: 3.95, latMax: 4.15, lngMin: 9.6, lngMax: 9.85 }
      : { latMin: 3.8, latMax: 3.95, lngMin: 11.44, lngMax: 11.6 };
  }

  formatXaf(v: number): string { return formatXaf(v); }
  formatDateTime(v?: string): string { return formatDateTime(v); }
}
