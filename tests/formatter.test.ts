import { describe, expect, it } from 'vitest';
import { displayText, formatNumber, formatPercentage, formatProgressBar, formatRatio, parseInteger, truncate } from '../src/utils/formatter.js';

describe('numeric normalization and presentation', () => {
  it.each([['9,040,962', 9040962], ['0', 0], [42, 42], [' 42 ', 42], ['12,34', null], ['1.000', null], ['-1', null], ['', null], ['1e3', null], [null, null], ['9007199254740992', null]])('normalizes %j', (input, output) => {
    expect(parseInteger(input)).toBe(output);
  });
  it('formats numbers, percentages, and missing values', () => {
    expect(formatNumber(9040962)).toBe('9,040,962');
    expect(formatNumber(null)).toBe('N/A');
    expect(formatPercentage(24.5)).toBe('24.5%');
    expect(formatPercentage(null)).toBe('N/A');
  });
  it('formats K/D and headshot percentages consistently with two decimal places', () => {
    expect(formatRatio(21053 / 11687)).toBe('1.80');
    expect(formatRatio(18968 / 21053 * 100, true)).toBe('90.10%');
    expect(formatRatio(0)).toBe('0.00');
    expect(formatRatio(0, true)).toBe('0.00%');
    expect(formatRatio(null)).toBe('N/A');
    expect(formatRatio(Infinity)).toBe('N/A');
    expect(formatRatio(NaN, true)).toBe('N/A');
  });
  it('escapes Discord markdown and mentions without altering stored data', () => {
    expect(displayText('He`Cans13+TNG')).toContain('\\`');
    expect(displayText('@everyone')).toContain('@\u200b');
    expect(displayText('**x**')).toContain('\\*');
    expect(truncate('a😀abc', 3)).toBe('a…');
  });
  it.each([
    [0, '`░░░░░░░░░░░░` 0%'], [24.5, '`███░░░░░░░░░` 24.5%'], [100, '`████████████` 100%'],
    [null, 'N/A'], [-1, 'N/A'], [101, 'N/A'], [NaN, 'N/A'], [Infinity, 'N/A'],
  ])('formats valid progress and rejects unavailable or invalid values: %s', (value, expected) => {
    expect(formatProgressBar(value as number | null)).toBe(expected);
  });
});
