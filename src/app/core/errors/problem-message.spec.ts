import { ERROR_CODES } from './error-codes';
import { buildFriendlyProblem, fieldLabel, reasonFromServerMessage } from './problem-message';

describe('buildFriendlyProblem', () => {
  it('lists refused fields with plain reasons (French)', () => {
    const p = buildFriendlyProblem({
      status: 400, code: 'ERR-4001', detail: 'Un ou plusieurs champs sont invalides.',
      errors: [
        { field: 'email', message: 'The email has already been taken.', code: 'invalid' },
        { field: 'rccm', message: 'The rccm field is required.', code: 'invalid' },
      ],
    }, 'fr');
    expect(p.kind).toBe('validation');
    expect(p.fieldErrors).toHaveLength(2);
    expect(p.message).toContain('Email (déjà utilisé)');
    expect(p.message).toContain('RCCM (obligatoire)');
  });

  it('translates the same failure to English', () => {
    const p = buildFriendlyProblem({
      status: 400, code: 'ERR-4001',
      errors: [{ field: 'telephone', message: 'The telephone field must be a valid email address.', code: 'invalid' }],
    }, 'en');
    expect(p.message).toContain('Phone');
  });

  it('prefers the backend French detail for a known code, but not in English', () => {
    const input = { status: 409, code: 'ERR-4097', detail: 'Cette demande a déjà été traitée.' };
    expect(buildFriendlyProblem(input, 'fr').message).toBe('Cette demande a déjà été traitée.');
    expect(buildFriendlyProblem(input, 'en').message).toContain('Cette demande a déjà été traitée.');
    expect(buildFriendlyProblem(input, 'en').message).toContain('not possible');
  });

  it('ignores generic backend details', () => {
    const p = buildFriendlyProblem({ status: 500, code: 'ERR-5000', detail: 'Une erreur inattendue est survenue.' }, 'fr');
    expect(p.message).toBe(ERROR_CODES['ERR-5000'].fr);
    expect(p.needsReference).toBe(true);
  });

  it('distinguishes offline, session, permission, missing-module and rate limit', () => {
    expect(buildFriendlyProblem({ status: 0 }, 'fr')).toMatchObject({ kind: 'network' });
    expect(buildFriendlyProblem({ status: 0 }, 'fr').message).toContain('connexion');
    expect(buildFriendlyProblem({ status: 401, code: 'ERR-4011' }, 'fr').message).toBe('Email ou mot de passe incorrect.');
    expect(buildFriendlyProblem({ status: 403, code: 'ERR-4038' }, 'fr').kind).toBe('forbidden');
    expect(buildFriendlyProblem({ status: 404, code: 'ERR-4040' }, 'fr').message).toContain('non activée');
    expect(buildFriendlyProblem({ status: 429, code: 'ERR-4291' }, 'fr').kind).toBe('rateLimit');
  });

  it('falls back on the HTTP status for unknown codes and proxy errors', () => {
    expect(buildFriendlyProblem({ status: 413 }, 'fr').message).toContain('volumineux');
    expect(buildFriendlyProblem({ status: 502, code: 'ERR-9999' }, 'fr').needsReference).toBe(true);
  });

  it('caps the number of listed fields', () => {
    const errors = Array.from({ length: 9 }, (_, i) => ({ field: `f${i}`, message: 'The f field is required.', code: 'invalid' }));
    const p = buildFriendlyProblem({ status: 400, code: 'ERR-4001', errors }, 'fr');
    expect(p.fieldErrors).toHaveLength(9);
    expect(p.message).toContain('et 3 autre(s)');
  });
});

describe('reasonFromServerMessage', () => {
  it.each([
    ['The email field must be a valid email address.', 'email'],
    ['The email has already been taken.', 'taken'],
    ['The password field must be at least 12 characters.', 'min'],
    ['The nom field must not be greater than 100 characters.', 'max'],
    ['The rccm field is required.', 'required'],
    ['The password field confirmation does not match.', 'confirmed'],
    ['The password field is prohibited.', 'prohibited'],
    ['The foo field must be missing.', 'missing'],
    ['The given password has appeared in a data leak.', 'compromised'],
    ['The selected role is invalid.', 'in'],
  ])('%s -> %s', (message, reason) => {
    expect(reasonFromServerMessage(message)).toBe(reason);
  });
});

describe('fieldLabel', () => {
  it('uses curated labels, ignores array indexes, and falls back to a readable name', () => {
    expect(fieldLabel('nom_commercial', 'fr')).toBe('Nom commercial');
    expect(fieldLabel('nom_commercial', 'en')).toBe('Trade name');
    expect(fieldLabel('roles.0', 'fr')).toBe('Rôles');
    expect(fieldLabel('some_unknown_field', 'fr')).toBe('Some unknown field');
  });

  it('turns failed dispatch criteria (RG-050) into readable reasons instead of field errors', () => {
    const p = buildFriendlyProblem({
      status: 409, code: 'ERR-4093', detail: 'Livreur non éligible à cette commande.',
      errors: [
        { field: '', message: 'Critère RG-050 #3 non satisfait', code: 'RG-050-3' },
        { field: '', message: 'Critère RG-050 #5 non satisfait', code: 'RG-050-5' },
      ],
    }, 'fr');
    expect(p.message).toContain('Livreur non éligible');
    expect(p.message).toContain('plus de 2 minutes');
    expect(p.message).toContain('véhicule');
    expect(p.fieldErrors).toEqual([]);
  });

  it('gives the English wording for a failed COD ceiling', () => {
    const p = buildFriendlyProblem({ status: 409, code: 'ERR-4093', errors: [{ field: '', message: 'x', code: 'RG-050-6' }] }, 'en');
    expect(p.message).toContain('cash-on-delivery ceiling');
  });
});
