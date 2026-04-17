import { describe, it, expect } from 'vitest';
import { formatCurrency, formatAmount, formatDate } from '@/lib/format';

describe('formatCurrency', () => {
    it('formats AED with 2 decimal places', () => {
        const result = formatCurrency(1234.5, 'AED', 'en');
        expect(result).toBe('AED 1,234.50');
    });

    it('formats zero correctly', () => {
        expect(formatCurrency(0, 'AED', 'en')).toBe('AED 0.00');
    });

    it('formats large amounts with thousands separator', () => {
        const result = formatCurrency(1000000, 'AED', 'en');
        expect(result).toBe('AED 1,000,000.00');
    });

    it('puts currency after amount for Arabic locale', () => {
        const result = formatCurrency(100, 'AED', 'ar');
        expect(result).toMatch(/100\.00 AED/);
    });

    it('handles string input', () => {
        expect(formatCurrency('500.00', 'USD', 'en')).toBe('USD 500.00');
    });

    it('defaults currency to AED', () => {
        expect(formatCurrency(50)).toBe('AED 50.00');
    });

    it('handles USD currency', () => {
        const result = formatCurrency(99.99, 'USD', 'en');
        expect(result).toBe('USD 99.99');
    });
});

describe('formatAmount', () => {
    it('returns 2 decimal places', () => {
        expect(formatAmount(100)).toBe('100.00');
    });

    it('handles decimal values', () => {
        expect(formatAmount(1234.567)).toBe('1,234.57');
    });

    it('handles zero', () => {
        expect(formatAmount(0)).toBe('0.00');
    });

    it('handles string input', () => {
        expect(formatAmount('200.5')).toBe('200.50');
    });

    it('handles NaN-like strings by passing through NaN', () => {
        // Number('not-a-number') === NaN — the function does not guard against this
        expect(formatAmount('not-a-number')).toBe('NaN');
    });

    it('uses western digits for Arabic locale', () => {
        // ar-AE-u-nu-latn forces western (latin) digits
        const result = formatAmount(123, 'ar');
        expect(result).toMatch(/123/);
    });
});

describe('formatDate', () => {
    // Use a fixed date to avoid timezone drift in CI: 2025-03-15
    const dateStr = '2025-03-15T00:00:00.000Z';

    it('formats DD/MM/YYYY', () => {
        const result = formatDate(dateStr, 'DD/MM/YYYY');
        expect(result).toMatch(/15\/03\/2025/);
    });

    it('formats MM/DD/YYYY', () => {
        const result = formatDate(dateStr, 'MM/DD/YYYY');
        expect(result).toMatch(/03\/15\/2025/);
    });

    it('formats YYYY-MM-DD', () => {
        const result = formatDate(dateStr, 'YYYY-MM-DD');
        expect(result).toMatch(/2025-03-15/);
    });

    it('formats DD-MM-YYYY', () => {
        const result = formatDate(dateStr, 'DD-MM-YYYY');
        expect(result).toMatch(/15-03-2025/);
    });

    it('formats DD MMM YYYY', () => {
        const result = formatDate(dateStr, 'DD MMM YYYY');
        expect(result).toMatch(/15 Mar 2025/);
    });

    it('returns original string for invalid date', () => {
        expect(formatDate('not-a-date')).toBe('not-a-date');
    });

    it('accepts Date objects', () => {
        const d = new Date('2024-06-01T00:00:00.000Z');
        const result = formatDate(d, 'YYYY-MM-DD');
        expect(result).toMatch(/2024-06-0[12]/); // allow 1 or 2 due to UTC offset
    });

    it('falls back to locale format when no pattern given', () => {
        const result = formatDate(dateStr);
        // Just check it returns a non-empty string that isn't the original
        expect(result).toBeTruthy();
        expect(result).not.toBe(dateStr);
    });
});
