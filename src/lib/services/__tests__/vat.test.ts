import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateDocumentTotals } from '@/lib/services/vat';

describe('VAT Calculation Service', () => {
    describe('calculateLineItem', () => {
        it('should calculate standard-rated line item with VAT', () => {
            const result = calculateLineItem({
                quantity: 2,
                unitPrice: 100,
                discount: 0,
                vatTreatment: 'STANDARD_RATED',
                vatRate: 5,
            });

            expect(result.subtotal).toBe(200);
            expect(result.vatAmount).toBe(10); // 200 * 5%
            expect(result.total).toBe(210);
        });

        it('should apply discount before VAT calculation', () => {
            const result = calculateLineItem({
                quantity: 1,
                unitPrice: 100,
                discount: 10, // 10%
                vatTreatment: 'STANDARD_RATED',
                vatRate: 5,
            });

            expect(result.subtotal).toBe(90); // 100 - 10%
            expect(result.vatAmount).toBe(4.5); // 90 * 5%
            expect(result.total).toBe(94.5);
        });

        it('should handle zero-rated items (no VAT)', () => {
            const result = calculateLineItem({
                quantity: 1,
                unitPrice: 100,
                discount: 0,
                vatTreatment: 'ZERO_RATED',
                vatRate: 0,
            });

            expect(result.subtotal).toBe(100);
            expect(result.vatAmount).toBe(0);
            expect(result.total).toBe(100);
        });

        it('should handle exempt items', () => {
            const result = calculateLineItem({
                quantity: 1,
                unitPrice: 100,
                discount: 0,
                vatTreatment: 'EXEMPT',
                vatRate: 0,
            });

            expect(result.subtotal).toBe(100);
            expect(result.vatAmount).toBe(0);
            expect(result.total).toBe(100);
        });
    });

    describe('calculateDocumentTotals', () => {
        it('should sum multiple line items correctly', () => {
            const items = [
                {
                    quantity: 1,
                    unitPrice: 100,
                    discount: 0,
                    discountAmount: 0,
                    subtotal: 100,
                    vatAmount: 5,
                    total: 105,
                    vatTreatment: 'STANDARD_RATED' as const,
                    vatRate: 5,
                    effectiveVatRate: 5,
                },
                {
                    quantity: 2,
                    unitPrice: 50,
                    discount: 0,
                    discountAmount: 0,
                    subtotal: 100,
                    vatAmount: 5,
                    total: 105,
                    vatTreatment: 'STANDARD_RATED' as const,
                    vatRate: 5,
                    effectiveVatRate: 5,
                },
            ];

            const result = calculateDocumentTotals(items);

            expect(result.subtotal).toBe(200);
            expect(result.totalVat).toBe(10);
            expect(result.total).toBe(210);
        });
    });
});
