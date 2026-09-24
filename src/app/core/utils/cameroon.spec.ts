import {
  advisoryFor, analyzeCmPhone, analyzeEmail, analyzeName, detectOperator, niuMatches, normalizeCmPhone, plateMatches,
  rccmMatches, ribMatches,
} from './cameroon';

describe('analyzeCmPhone', () => {
  it.each([
    ['+237651234567', '+237651234567', 'mobile'],
    ['651234567', '+237651234567', 'mobile'],
    ['237651234567', '+237651234567', 'mobile'],
    ['00237651234567', '+237651234567', 'mobile'],
    ['+237 6 51 23 45 67', '+237651234567', 'mobile'],
    ['(+237) 651-234-567', '+237651234567', 'mobile'],
    ['+237233123456', '+237233123456', 'landline'],
  ])('accepts %s', (input, e164, kind) => {
    const a = analyzeCmPhone(input);
    expect(a.ok).toBe(true);
    expect(a.e164).toBe(e164);
    expect(a.kind).toBe(kind);
  });

  it('reports how many digits are missing / in excess', () => {
    expect(analyzeCmPhone('65123456')).toMatchObject({ ok: false, issue: 'short', delta: 1 });
    expect(analyzeCmPhone('+23765123456')).toMatchObject({ ok: false, issue: 'short', delta: 1 });
    expect(analyzeCmPhone('6512345678')).toMatchObject({ ok: false, issue: 'long', delta: 1 });
  });

  it('explains other failures', () => {
    expect(analyzeCmPhone('')).toMatchObject({ ok: false, issue: 'empty' });
    expect(analyzeCmPhone('65abc4567')).toMatchObject({ ok: false, issue: 'chars' });
    expect(analyzeCmPhone('+33612345678')).toMatchObject({ ok: false, issue: 'country' });
    expect(analyzeCmPhone('751234567')).toMatchObject({ ok: false, issue: 'prefix' });
  });
});

describe('normalizeCmPhone', () => {
  it('canonicalises valid numbers and leaves invalid ones alone', () => {
    expect(normalizeCmPhone('651 23 45 67')).toBe('+237651234567');
    expect(normalizeCmPhone('12345')).toBe('12345');
    expect(normalizeCmPhone(null)).toBe('');
  });
});

describe('detectOperator', () => {
  it('maps common prefixes (hint only)', () => {
    expect(detectOperator('+237671234567')).toBe('MTN');
    expect(detectOperator('+237651234567')).toBe('MTN');
    expect(detectOperator('+237691234567')).toBe('ORANGE');
    expect(detectOperator('+237657234567')).toBe('ORANGE');
    expect(detectOperator('+237661234567')).toBe('NEXTTEL');
    expect(detectOperator('+237233123456')).toBeNull();
  });
});

describe('analyzeName / analyzeEmail', () => {
  it('accepts real Cameroonian names', () => {
    expect(analyzeName("N'Guessan Ébélé-Mballa").ok).toBe(true);
    expect(analyzeName('Fotso').ok).toBe(true);
  });

  it('rejects digits, symbols and single letters', () => {
    expect(analyzeName('A')).toMatchObject({ ok: false, issue: 'short' });
    expect(analyzeName('Jean3')).toMatchObject({ ok: false, issue: 'chars' });
    expect(analyzeName('<script>')).toMatchObject({ ok: false, issue: 'chars' });
  });

  it('validates email shape and domain', () => {
    expect(analyzeEmail('nom@exemple.cm').ok).toBe(true);
    expect(analyzeEmail('nom@exemple')).toMatchObject({ ok: false, issue: 'domain' });
    expect(analyzeEmail('nomexemple.cm')).toMatchObject({ ok: false, issue: 'format' });
    expect(analyzeEmail('nom @exemple.cm')).toMatchObject({ ok: false, issue: 'spaces' });
  });
});

describe('advisory formats (never blocking)', () => {
  it('recognises common shapes', () => {
    expect(rccmMatches('RC/DLA/2020/B/1234')).toBe(true);
    expect(rccmMatches('rc / dla / 2020 / b / 1234')).toBe(true);
    expect(niuMatches('M012345678901A')).toBe(true);
    expect(niuMatches('m0123 4567 8901 a')).toBe(true);
    expect(plateMatches('LT 123 AB')).toBe(true);
    expect(plateMatches('CE-1234-A')).toBe(true);
    expect(ribMatches('12345678901234567890123')).toBe(true);
    expect(ribMatches('CM21' + '1'.repeat(23))).toBe(true);
  });

  it('warns on unusual values, stays silent on empty or correct ones', () => {
    expect(advisoryFor('rccm', '1234')).toEqual({ key: 'advisory.rccm' });
    expect(advisoryFor('niu', 'ABC')).toEqual({ key: 'advisory.niu' });
    expect(advisoryFor('plate', 'XYZ')).toEqual({ key: 'advisory.plate' });
    expect(advisoryFor('rib', '123')).toEqual({ key: 'advisory.rib' });
    expect(advisoryFor('rccm', '')).toBeNull();
    expect(advisoryFor('rccm', 'RC/DLA/2020/B/1234')).toBeNull();
  });

  it('flags a Mobile Money operator mismatch only', () => {
    expect(advisoryFor('operator', '+237691234567', { operator: 'MTN_MOMO' })).toMatchObject({ key: 'advisory.operator' });
    expect(advisoryFor('operator', '+237671234567', { operator: 'MTN_MOMO' })).toBeNull();
    expect(advisoryFor('operator', '+237691234567', { operator: 'BANK' })).toBeNull();
  });
});
