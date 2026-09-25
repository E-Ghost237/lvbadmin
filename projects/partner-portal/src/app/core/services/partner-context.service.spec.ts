import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { Partner } from '@lvb/models/partner.model';
import { PartnerContextService } from './partner-context.service';

function setup(status: Partner['statut_partenaire'], role: 'RESPONSABLE_PARTENAIRE' | 'LECTEUR_PARTENAIRE' | null) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const ctx = TestBed.inject(PartnerContextService);
  ctx.partner.set({ statut_partenaire: status } as Partner);
  ctx.role.set(role);
  ctx.state.set('ready');
  return ctx;
}

describe('PartnerContextService.can', () => {
  it('lets the owner open the dossier screens while onboarding, even though the role is not readable yet', () => {
    // Regression: "Compléter mon dossier" did nothing because the /profile guard denied a null role.
    const ctx = setup('EN_ATTENTE_VALIDATION', null);
    expect(ctx.can('profile.read')).toBe(true);
    expect(ctx.can('profile.write')).toBe(true);
    expect(ctx.can('documents.write')).toBe(true);
  });

  it('keeps business sections closed until the partner is ACTIF', () => {
    const ctx = setup('EN_ATTENTE_VALIDATION', null);
    expect(ctx.can('orders.read')).toBe(false);
    expect(ctx.can('wallet.read')).toBe(false);
  });

  it('applies the role once the partner is ACTIF', () => {
    const ctx = setup('ACTIF', 'LECTEUR_PARTENAIRE');
    expect(ctx.can('orders.read')).toBe(true);
    expect(ctx.can('wallet.read')).toBe(false);
  });

  it('never locks out on uncertainty', () => {
    const ctx = setup('ACTIF', null);
    ctx.state.set('error');
    expect(ctx.can('wallet.read')).toBe(true);
  });
});
