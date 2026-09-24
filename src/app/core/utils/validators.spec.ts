import { FormControl } from '@angular/forms';
import { cmMobilePhone, e164Phone, emailAddress, minAge, momoAccount, notInPast, personName, xafAmount } from './validators';

const run = (validator: ReturnType<typeof e164Phone>, value: unknown) => validator(new FormControl(value));

describe('phone validators', () => {
  it('e164Phone accepts mobile and landline, blank is left to `required`', () => {
    expect(run(e164Phone(), '651234567')).toBeNull();
    expect(run(e164Phone(), '+237233123456')).toBeNull();
    expect(run(e164Phone(), '')).toBeNull();
    expect(run(e164Phone(), '6512')).toEqual({ phone: { reason: 'short', delta: 5 } });
  });

  it('cmMobilePhone refuses landlines with a specific reason', () => {
    expect(run(cmMobilePhone(), '651234567')).toBeNull();
    expect(run(cmMobilePhone(), '233123456')).toEqual({ phone: { reason: 'landline', delta: 0 } });
  });

  it('momoAccount only applies to MTN / Orange', () => {
    expect(run(momoAccount(() => 'BANK'), 'FR7630006000011234567890189')).toBeNull();
    expect(run(momoAccount(() => 'MTN_MOMO'), '671234567')).toBeNull();
    expect(run(momoAccount(() => 'MTN_MOMO'), '12345')).toMatchObject({ phone: { reason: 'short' } });
  });
});

describe('other validators', () => {
  it('emailAddress requires a dotted domain', () => {
    expect(run(emailAddress(), 'a@b.cm')).toBeNull();
    expect(run(emailAddress(), 'a@b')).toEqual({ email: { reason: 'domain' } });
  });

  it('personName', () => {
    expect(run(personName(), 'Ndjock')).toBeNull();
    expect(run(personName(), 'X1')).toEqual({ personName: { reason: 'chars' } });
  });

  it('xafAmount enforces whole numbers and bounds', () => {
    expect(run(xafAmount(1000, 1_000_000), 5000)).toBeNull();
    expect(run(xafAmount(1000, 1_000_000), 500)).toMatchObject({ min: { min: 1000 } });
    expect(run(xafAmount(1000, 1_000_000), 2_000_000)).toMatchObject({ max: { max: 1_000_000 } });
    expect(run(xafAmount(), 10.5)).toEqual({ integer: true });
  });

  it('minAge / notInPast', () => {
    const year = new Date().getFullYear();
    expect(run(minAge(18), `${year - 30}-01-01`)).toBeNull();
    expect(run(minAge(18), `${year - 10}-01-01`)).toEqual({ minAge: { years: 18 } });
    expect(run(notInPast(), `${year + 1}-06-01`)).toBeNull();
    expect(run(notInPast(), `${year - 1}-06-01`)).toEqual({ pastDate: { reason: 'past' } });
    expect(run(notInPast(true), new Date().toISOString().slice(0, 10))).toEqual({ pastDate: { reason: 'strict' } });
  });
});
