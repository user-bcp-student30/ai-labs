import { describe, expect, it } from 'vitest';
import { formatTaskLabel } from './legacy-format';

describe('formatTaskLabel', () => {
  it('formats priority and owner', () => {
    expect(formatTaskLabel({ priority: 'high', owner: 'student' })).toBe('HIGH · STUDENT');
  });

  it('returns the fallback label for missing tasks', () => {
    expect(formatTaskLabel(null)).toBe('SIN-DATOS');
  });

  it('uses fallback values when priority and owner are missing', () => {
    expect(formatTaskLabel({})).toBe('NORMAL · SIN-ASIGNAR');
  });
});
