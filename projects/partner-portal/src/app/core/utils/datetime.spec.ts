import { describe, expect, it } from 'vitest';
import { isoToLocal, localToIso } from './datetime';

describe('Douala date helpers', () => {
  it('turns a datetime-local value into an ISO instant at UTC+1', () => {
    expect(localToIso('2026-09-25T14:30')).toBe('2026-09-25T14:30:00+01:00');
  });
  it('round-trips through the instant', () => {
    expect(isoToLocal(localToIso('2026-09-25T14:30'))).toBe('2026-09-25T14:30');
  });
});
