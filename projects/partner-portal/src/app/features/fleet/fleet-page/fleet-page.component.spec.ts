import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@lvb/http/api.config';
import { Vehicle } from '@lvb/models/rental.model';
import { FleetPageComponent } from './fleet-page.component';

const vehicle = {
  uuid: 'v1', registration: 'LT406B', brand: 'Sinotruck', model: 'Chine', year: null, vehicle_type: 'CAMION_BENNE', category: 'CAMION BENNE 10 t',
  license_category: 'C', color: null, capacity_kg: 10000, volume_liters: 12000, seats: null, fuel: null, transmission: null, mileage: null,
  condition: null, status: 'BROUILLON', compliance_suspended: false,
} as unknown as Vehicle;

describe('FleetPageComponent — vehicle form', () => {
  it('opens the edit form for an existing vehicle without throwing and renders it', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/v1' }],
    });
    const fixture = TestBed.createComponent(FleetPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { openEditVehicleForm(v: Vehicle): void; vehicleFormOpen(): boolean };
    expect(() => cmp.openEditVehicleForm(vehicle)).not.toThrow();
    fixture.detectChanges();
    expect(cmp.vehicleFormOpen()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Modifier le véhicule');
    TestBed.inject(HttpTestingController);
  });

  it('opens the management panel (documents, hours, maintenance) when "Gérer" is pressed', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/v1' }],
    });
    const fixture = TestBed.createComponent(FleetPageComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { manage(r: 'vehicles' | 'drivers', uuid: string, label: string): void };
    cmp.manage('vehicles', 'v1', 'LT406B');
    await new Promise((r) => setTimeout(r, 20));
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-resource-panel')).not.toBeNull();
    expect(el.textContent).toContain('LT406B');
  });
});
