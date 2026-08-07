import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateZoneRequest, PricingService, Zone, ZoneType } from '../../../core/services/pricing.service';
import { GeoPoint, ProblemDetails } from '../../../core/models';
import {
  BreadcrumbsComponent, ConfirmService, ForbiddenStateComponent, FormFieldComponent, PolygonPickerComponent, TabDef,
  TabsComponent, ToastService,
} from '../../../shared/ui';

interface CreatedGrille {
  id: number;
  nom: string;
  ville: string;
  activated: boolean;
}

@Component({
  selector: 'app-pricing-page',
  imports: [ReactiveFormsModule, BreadcrumbsComponent, TabsComponent, FormFieldComponent, PolygonPickerComponent, ForbiddenStateComponent],
  templateUrl: './pricing-page.component.html',
})
export class PricingPageComponent {
  private readonly pricing = inject(PricingService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly tabs: TabDef[] = [{ id: 'grilles', label: 'Grilles tarifaires' }, { id: 'zones', label: 'Zones' }];
  protected readonly activeTab = signal('grilles');

  // --- Grilles --------------------------------------------------------
  protected readonly grilleForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(50)]],
    ville: ['Douala', [Validators.required]],
    frais_prise_en_charge: [500, [Validators.required, Validators.min(0)]],
    tarif_km: [150, [Validators.required, Validators.min(0)]],
    tarif_minute: [15, [Validators.required, Validators.min(0)]],
    prix_minimum: [1000, [Validators.required, Validators.min(0)]],
    arrondi: [25, [Validators.required, Validators.min(0)]],
    plafond_remise: [1000],
  });
  protected readonly creatingGrille = signal(false);
  protected readonly sessionGrilles = signal<CreatedGrille[]>([]);
  protected readonly activatingId = signal<number | null>(null);

  createGrille(): void {
    if (this.grilleForm.invalid) {
      this.grilleForm.markAllAsTouched();
      return;
    }
    const v = this.grilleForm.getRawValue();
    this.creatingGrille.set(true);
    this.pricing.createGrille(v).subscribe({
      next: (res) => {
        this.creatingGrille.set(false);
        this.sessionGrilles.update((list) => [{ id: res.id, nom: v.nom, ville: v.ville, activated: false }, ...list]);
        this.toast.success('Grille créée', `#${res.id}`);
        this.grilleForm.reset({ nom: '', ville: v.ville, frais_prise_en_charge: 500, tarif_km: 150, tarif_minute: 15, prix_minimum: 1000, arrondi: 25, plafond_remise: 1000 });
      },
      error: (err: ProblemDetails) => {
        this.creatingGrille.set(false);
        this.toast.error('Échec de la création', err.detail);
      },
    });
  }

  async activateGrille(g: CreatedGrille): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Activer cette grille ?', message: `La grille active actuelle de ${g.ville} sera archivée.` });
    if (!ok) return;
    this.activatingId.set(g.id);
    this.pricing.activateGrille(g.id, g.ville).subscribe({
      next: () => {
        this.activatingId.set(null);
        this.sessionGrilles.update((list) => list.map((x) => (x.id === g.id ? { ...x, activated: true } : x)));
        this.toast.success('Grille activée');
      },
      error: (err: ProblemDetails) => {
        this.activatingId.set(null);
        this.toast.error('Échec de l’activation', err.detail);
      },
    });
  }

  // --- Zones ------------------------------------------------------------
  protected readonly zoneVille = signal<'Douala' | 'Yaoundé'>('Douala');
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
    this.fetchZones();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
  }

  selectVille(v: 'Douala' | 'Yaoundé'): void {
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
      this.zoneForm.markAllAsTouched();
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
}
