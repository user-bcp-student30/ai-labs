import { describe, expect, it } from 'vitest';
import { isAuthenticatedUser } from './auth.model';
import { isRecord } from '../utils/type-guards';

describe('isAuthenticatedUser', () => {
  it('accepts observed optional string fields', () => {
    expect(isAuthenticatedUser({ username: 'student', displayName: 'Student', role: 'USER' })).toBe(true);
    expect(isAuthenticatedUser({})).toBe(true);
  });

  it('rejects non-record values and fields with invalid types', () => {
    expect(isAuthenticatedUser(null)).toBe(false);
    expect(isAuthenticatedUser([])).toBe(false);
    expect(isAuthenticatedUser({ username: 12 })).toBe(false);
  });
});

describe('isRecord', () => {
  it('accepts non-null, non-array objects', () => {
    expect(isRecord({})).toBe(true);
  });

  it('rejects null, arrays, and primitive values', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('value')).toBe(false);
  });
});