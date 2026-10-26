import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './error-message';

describe('getErrorMessage', () => {
  it('prefers the configured backend response field', () => {
    expect(getErrorMessage({ response: { data: { detail: 'Unavailable' } } }, 'detail', 'Fallback'))
      .toBe('Unavailable');
  });

  it('uses an Error message when no backend message is present', () => {
    expect(getErrorMessage(new Error('Offline'), 'message', 'Fallback')).toBe('Offline');
  });

  it('uses the fallback for unknown error values', () => {
    expect(getErrorMessage(null, 'message', 'Fallback')).toBe('Fallback');
  });
});