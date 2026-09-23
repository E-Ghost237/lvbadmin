import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FleetService } from '../../../core/services/fleet.service';
import { SaveDriverRequest, SaveVehicleRequest } from '../../../core/models';
import {
  DRIVER_STATUS_VALUES, Driver, DriverStatus, RentalVehicleType, VEHICLE_STATUS_VALUES, Vehicle, VehicleStatus,
} from '@lvb/models/rental.model';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatDate } from '@lvb/utils/formatters';
import { I18nService } from '@lvb/i18n/i18n.service';
import { BreadcrumbsComponent } from '@lvb/ui/breadcrumbs/breadcrumbs.component';
import { TabDef, TabsComponent } from '@lvb/ui/tabs/tabs.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatusBadgeComponent } from '@lvb/ui/status-badge/status-badge.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ColumnDef, DataTableComponent } from '@lvb/ui/table/data-table.component';
import { TableCellDefDirective } from '@lvb/ui/table/table-cell-def.directive';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { ToastService } from '@lvb/ui/toast/toast.service';

/**
 * Fleet self-service — `/v1/partner/{vehicles,drivers,vehicle-types}`
 * (LVB-CDC-MKT-RENT-2026-V1.0). Only RESPONSABLE_PARTENAIRE has
 * `fleet.vehicle.manage`/`fleet.driver.manage`; other roles see a 403 here.
 * A vehicle/driver under an LVB compliance suspension
 * (`compliance_suspended: true`) rejects every partner edit server-side
 * (ERR-4721) — surfaced as a banner on that row's edit form rather than a
 * confusing generic failure. Changing a driver's `license_*` fields resets
 * their status to `EN_ATTENTE_VALIDATION` automatically; a partner can
 * never set ACTIF/SUSPENDU on a driver coming out of
 * EN_ATTENTE_VALIDATION/SUSPENDU themselves (LVB validation required) — the
 * server enforces this, the form just surfaces the resulting error.
 */
@Component({
  selector: 'app-fleet-page',
  imports: [
    ReactiveFormsModule, BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent,
    SelectComponent, DataTableComponent, TableCellDefDirective, FormFieldComponent,
  ],
  templateUrl: './fleet-page.component.html',
})
export class FleetPageComponent {
  private readonly fleet = inject(FleetService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [{ id: 'vehicles', label: 'Véhicules' }, { id: 'drivers', label: 'Chauffeurs' }];
  protected readonly activeTab = signal('vehicles');

  date(iso: string | null): string {
    return formatDate(iso);
  }

  constructor() {
    this.fetchVehicleTypes();
    this.fetchVehicles();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'drivers' && this.drivers().length === 0 && !this.loadingDrivers()) this.fetchDrivers();
  }

  // --- Vehicle types (read-only reference) ---------------------------------

  protected readonly vehicleTypes = signal<RentalVehicleType[]>([]);
  protected readonly vehicleTypeOptions = signal<SelectOption[]>([]);

  fetchVehicleTypes(): void {
    this.fleet.listVehicleTypes().subscribe({
      next: (page) => {
        this.vehicleTypes.set(page.items);
        this.vehicleTypeOptions.set(page.items.filter((t) => t.active).map((t) => ({ value: t.code, label: t.label })));
      },
      error: () => undefined,
    });
  }

  // --- Vehicles -------------------------------------------------------

  protected readonly vehicleStatusOptions: SelectOption[] = VEHICLE_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.rentalVehicle.' + s),
  }));
  protected readonly vehicleColumns: ColumnDef<Vehicle>[] = [
    { key: 'registration', label: 'Immatriculation' },
    { key: 'brand', label: 'Marque / modèle', cell: (r) => `${r.brand} ${r.model}` },
    { key: 'vehicle_type', label: 'Type' },
    { key: 'status', label: 'Statut' },
    { key: 'compliance_suspended', label: 'Conformité', cell: (r) => (r.compliance_suspended ? 'Suspendu par LVB' : 'OK') },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByVehicleUuid = (row: Vehicle) => row.uuid;

  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly loadingVehicles = signal(true);
  protected readonly forbiddenVehicles = signal(false);
  protected readonly vehiclesCursor = signal<number | null>(null);
  protected readonly vehicleStatusFilter = signal<VehicleStatus | ''>('');

  protected readonly vehicleFormOpen = signal(false);
  protected readonly editingVehicle = signal<Vehicle | null>(null);
  protected readonly savingVehicle = signal(false);
  protected readonly vehicleForm = this.fb.nonNullable.group({
    registration: ['', [Validators.required]],
    brand: [''],
    model: [''],
    year: [null as number | null],
    vehicle_type: ['', [Validators.required]],
    category: [''],
    license_category: [''],
    color: [''],
    capacity_kg: [0, [Validators.required, Validators.min(0)]],
    volume_liters: [0, [Validators.required, Validators.min(0)]],
    seats: [null as number | null],
    fuel: [''],
    transmission: [''],
    mileage: [null as number | null],
    condition: [''],
    status: ['' as VehicleStatus | ''],
  });

  fetchVehicles(cursor?: number): void {
    this.loadingVehicles.set(true);
    this.forbiddenVehicles.set(false);
    this.fleet.listVehicles({ status: this.vehicleStatusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingVehicles.set(false);
        this.vehicles.set(cursor ? [...this.vehicles(), ...page.items] : page.items);
        this.vehiclesCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingVehicles.set(false);
        if (err.status === 403) this.forbiddenVehicles.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onVehicleStatusFilterChange(value: string): void {
    this.vehicleStatusFilter.set(value as VehicleStatus | '');
    this.fetchVehicles();
  }

  openNewVehicleForm(): void {
    this.editingVehicle.set(null);
    this.vehicleForm.reset({
      registration: '', brand: '', model: '', year: null, vehicle_type: '', category: '', license_category: '',
      color: '', capacity_kg: 0, volume_liters: 0, seats: null, fuel: '', transmission: '', mileage: null,
      condition: '', status: '',
    });
    this.vehicleFormOpen.set(true);
  }

  openEditVehicleForm(vehicle: Vehicle): void {
    this.editingVehicle.set(vehicle);
    this.vehicleForm.reset({
      registration: vehicle.registration, brand: vehicle.brand, model: vehicle.model, year: vehicle.year,
      vehicle_type: vehicle.vehicle_type, category: vehicle.category, license_category: vehicle.license_category,
      color: vehicle.color ?? '', capacity_kg: vehicle.capacity_kg, volume_liters: vehicle.volume_liters,
      seats: vehicle.seats ?? null, fuel: vehicle.fuel ?? '', transmission: vehicle.transmission ?? '',
      mileage: vehicle.mileage ?? null, condition: vehicle.condition ?? '', status: vehicle.status,
    });
    this.vehicleFormOpen.set(true);
  }

  submitVehicleForm(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }
    const v = this.vehicleForm.getRawValue();
    const req: SaveVehicleRequest = {
      registration: v.registration, brand: v.brand || undefined, model: v.model || undefined,
      year: v.year ?? undefined, vehicle_type: v.vehicle_type, category: v.category || undefined,
      license_category: v.license_category || undefined, color: v.color || undefined,
      capacity_kg: v.capacity_kg, volume_liters: v.volume_liters, seats: v.seats ?? undefined,
      fuel: v.fuel || undefined, transmission: v.transmission || undefined, mileage: v.mileage ?? undefined,
      condition: v.condition || undefined, status: v.status || undefined,
    };
    this.savingVehicle.set(true);
    const editing = this.editingVehicle();
    const obs = editing ? this.fleet.updateVehicle(editing.uuid, req) : this.fleet.createVehicle(req);
    obs.subscribe({
      next: () => {
        this.savingVehicle.set(false);
        this.vehicleFormOpen.set(false);
        this.toast.success(editing ? 'Véhicule mis à jour' : 'Véhicule créé');
        this.fetchVehicles();
      },
      error: (err: ProblemDetails) => { this.savingVehicle.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Drivers --------------------------------------------------------

  protected readonly driverStatusOptions: SelectOption[] = DRIVER_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.rentalDriver.' + s),
  }));
  protected readonly driverColumns: ColumnDef<Driver>[] = [
    { key: 'name', label: 'Chauffeur', cell: (r) => `${r.first_name} ${r.last_name}` },
    { key: 'phone', label: 'Téléphone' },
    { key: 'license_expires_at', label: 'Permis expire le', cell: (r) => this.date(r.license_expires_at) },
    { key: 'status', label: 'Statut' },
    { key: 'compliance_suspended', label: 'Conformité', cell: (r) => (r.compliance_suspended ? 'Suspendu par LVB' : 'OK') },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByDriverUuid = (row: Driver) => row.uuid;

  protected readonly drivers = signal<Driver[]>([]);
  protected readonly loadingDrivers = signal(false);
  protected readonly forbiddenDrivers = signal(false);
  protected readonly driversCursor = signal<number | null>(null);
  protected readonly driverStatusFilter = signal<DriverStatus | ''>('');

  protected readonly driverFormOpen = signal(false);
  protected readonly editingDriver = signal<Driver | null>(null);
  protected readonly savingDriver = signal(false);
  protected readonly driverForm = this.fb.nonNullable.group({
    first_name: ['', [Validators.required]],
    last_name: ['', [Validators.required]],
    birth_date: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    address: [''],
    photo_url: [''],
    license_number: [''],
    license_categories: ['', [Validators.required]],
    license_expires_at: ['', [Validators.required]],
    experience_years: [null as number | null],
    vehicle_types: [''],
    status: ['' as DriverStatus | ''],
  });

  fetchDrivers(cursor?: number): void {
    this.loadingDrivers.set(true);
    this.forbiddenDrivers.set(false);
    this.fleet.listDrivers({ status: this.driverStatusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingDrivers.set(false);
        this.drivers.set(cursor ? [...this.drivers(), ...page.items] : page.items);
        this.driversCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingDrivers.set(false);
        if (err.status === 403) this.forbiddenDrivers.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onDriverStatusFilterChange(value: string): void {
    this.driverStatusFilter.set(value as DriverStatus | '');
    this.fetchDrivers();
  }

  openNewDriverForm(): void {
    this.editingDriver.set(null);
    this.driverForm.reset({
      first_name: '', last_name: '', birth_date: '', phone: '', address: '', photo_url: '', license_number: '',
      license_categories: '', license_expires_at: '', experience_years: null, vehicle_types: '', status: '',
    });
    this.driverFormOpen.set(true);
  }

  openEditDriverForm(driver: Driver): void {
    this.editingDriver.set(driver);
    this.driverForm.reset({
      first_name: driver.first_name, last_name: driver.last_name, birth_date: driver.birth_date ?? '',
      phone: driver.phone, address: driver.address ?? '', photo_url: driver.photo_url ?? '', license_number: '',
      license_categories: driver.license_categories.join(', '), license_expires_at: driver.license_expires_at,
      experience_years: driver.experience_years ?? null, vehicle_types: (driver.vehicle_types ?? []).join(', '),
      status: driver.status,
    });
    this.driverFormOpen.set(true);
  }

  submitDriverForm(): void {
    if (this.driverForm.invalid) {
      this.driverForm.markAllAsTouched();
      return;
    }
    const v = this.driverForm.getRawValue();
    const req: SaveDriverRequest = {
      first_name: v.first_name, last_name: v.last_name, birth_date: v.birth_date || undefined,
      phone: v.phone, address: v.address || undefined, photo_url: v.photo_url || undefined,
      license_number: v.license_number || undefined,
      license_categories: v.license_categories.split(',').map((c) => c.trim()).filter(Boolean),
      license_expires_at: v.license_expires_at,
      experience_years: v.experience_years ?? undefined,
      vehicle_types: v.vehicle_types ? v.vehicle_types.split(',').map((c) => c.trim()).filter(Boolean) : undefined,
      status: v.status || undefined,
    };
    this.savingDriver.set(true);
    const editing = this.editingDriver();
    const obs = editing ? this.fleet.updateDriver(editing.uuid, req) : this.fleet.createDriver(req);
    obs.subscribe({
      next: () => {
        this.savingDriver.set(false);
        this.driverFormOpen.set(false);
        this.toast.success(editing ? 'Chauffeur mis à jour' : 'Chauffeur créé');
        this.fetchDrivers();
      },
      error: (err: ProblemDetails) => { this.savingDriver.set(false); this.toast.error('Échec', err.detail); },
    });
  }
}
