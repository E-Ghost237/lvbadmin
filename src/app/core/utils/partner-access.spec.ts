import { describe, expect, it } from 'vitest';
import { computeReadiness, partnerCan, roleAllows } from './partner-access';

describe('partner access rules (mirror of PartnerRole::allows)', () => {
  it('lets every role read, but only the responsable write', () => {
    expect(roleAllows('LECTEUR_PARTENAIRE', 'orders.read')).toBe(true);
    expect(roleAllows('LECTEUR_PARTENAIRE', 'booking.accept')).toBe(false);
    expect(roleAllows('OPERATEUR_PARTENAIRE', 'booking.accept')).toBe(true);
    expect(roleAllows('OPERATEUR_PARTENAIRE', 'wallet.read')).toBe(false);
    expect(roleAllows('RESPONSABLE_PARTENAIRE', 'wallet.withdraw')).toBe(true);
    expect(roleAllows(null, 'orders.read')).toBe(false);
  });

  it('only allows the dossier screens until the partner is ACTIF', () => {
    expect(partnerCan('RESPONSABLE_PARTENAIRE', 'EN_ATTENTE_VALIDATION', 'documents.write')).toBe(true);
    expect(partnerCan('RESPONSABLE_PARTENAIRE', 'EN_ATTENTE_VALIDATION', 'orders.read')).toBe(false);
    expect(partnerCan('RESPONSABLE_PARTENAIRE', 'SUSPENDU', 'profile.read')).toBe(false);
    expect(partnerCan('RESPONSABLE_PARTENAIRE', 'ACTIF', 'orders.read')).toBe(true);
  });
});

describe('computeReadiness', () => {
  const profile = {
    raison_sociale: 'ACME SARL', numero_contribuable: 'M123456789012A', nom_commercial: 'Acme', rccm: 'RC/DLA/2020/B/1234',
    responsable_nom: 'Jean Dupont', responsable_telephone: '+237651234567',
  };
  const docs = (statuses: Record<string, string>) =>
    Object.entries(statuses).map(([type_document, statut_verification]) => ({ type_document: type_document as never, statut_verification }));

  it('is ready only when all four documents are accepted and the profile is complete', () => {
    const ok = computeReadiness(profile, docs({ RCCM: 'VALIDE', FISCAL: 'VALIDE', ID_RESPONSABLE: 'VALIDE', CONTRAT_LVB: 'VALIDE' }));
    expect(ok.ready).toBe(true);
  });

  it('lists what is missing with a reason', () => {
    const r = computeReadiness({ ...profile, rccm: '' }, docs({ RCCM: 'VALIDE', FISCAL: 'EN_ATTENTE', ID_RESPONSABLE: 'REJETE' }));
    expect(r.ready).toBe(false);
    expect(r.missing.join('|')).toContain('non déposé');
    expect(r.missing.join('|')).toContain('en attente de vérification');
    expect(r.missing.join('|')).toContain('refusé');
    expect(r.missing).toContain('RCCM');
  });
});
