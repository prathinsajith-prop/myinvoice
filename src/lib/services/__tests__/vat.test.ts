import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateDocumentTotals, effectiveRate } from '@/lib/services/vat';

describe('effectiveRate', () => {
    it('returns the provided rate for STANDARD_RATED', () => {
        expect(effectiveRate('STANDARD_RATED', 5)).toBe(5);
        expect(effectiveRate('STANDARD_RATED', 10)).toBe(10);
    });

    it('returns the provided rate for REVERSE_CHARGE (self-account VAT)', () => {
        expect(effectiveRate('REVERSE_CHARGE', 5)).toBe(5);
    });

    it('returns 0 for ZERO_RATED', () => {
        expect(effectiveRate('ZERO_RATED', 5)).toBe(0);
    });

    it('returns 0 for EXEMPT', () => {
        expect(effectiveRate('EXEMPT', 5)).toBe(0);
    });

    it('returns 0 for OUT_OF_SCOPE', () => {
        expect(effectiveRate('OUT_OF_SCOPE', 5)).toBe(0);
    });

    it('defaults rate to 5% when not provided', () => {
        expect(effectiveRate('STANDARD_RATED')).toBe(5);
    });
});

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

        it('should handle OUT_OF_SCOPE treatment (no VAT)', () => {
            const result = calculateLineItem({
                quantity: 3,
                unitPrice: 50,
                discount: 0,
                vatTreatment: 'OUT_OF_SCOPE',
                vatRate: 5,
            });
            expect(result.subtotal).toBe(150);
            expect(result.vatAmount).toBe(0);
            expect(result.total).toBe(150);
        });

        it('should handle REVERSE_CHARGE treatment (VAT applies at given rate)', () => {
            const result = calculateLineItem({
                quantity: 1,
                unitPrice: 1000,
                discount: 0,
                vatTreatment: 'REVERSE_CHARGE',
                vatRate: 5,
            });
            expect(result.subtotal).toBe(1000);
            expect(result.vatAmount).toBe(50);
            expect(result.total).toBe(1050);
        });

        it('should handle VAT-inclusive pricing (extract VAT from price)', () => {
            const result = calculateLineItem({
                quantity: 1,
                unitPrice: 105,
                discount: 0,
                vatTreatment: 'STANDARD_RATED',
                vatRate: 5,
                vatInclusive: true,
            });
            // 105 / 1.05 = 100 subtotal, 5 VAT
            expect(result.subtotal).toBe(100);
            expect(result.vatAmount).toBe(5);
            expect(result.total).toBe(105);
        });

        it('should clamp discount at 100% (no negative subtotal)', () => {
            const result = calculateLineItem({
                quantity: 1,
                unitPrice: 200,
                discount: 150, // > 100% — should be treated as 100%
                vatTreatment: 'STANDARD_RATED',
                vatRate: 5,
            });
            expect(result.subtotal).toBe(0);
            expect(result.vatAmount).toBe(0);
            expect(result.total).toBe(0);
        });

        it('should clamp discount at 0% (no negative discount amounts)', () => {
            const result = calculateLineItem({
                quantity: 2,
                unitPrice: 100,
                discount: -10, // negative — should be treated as 0
                vatTreatment: 'STANDARD_RATED',
                vatRate: 5,
            });
            expect(result.subtotal).toBe(200);
            expect(result.vatAmount).toBe(10);
            expect(result.total).toBe(210);
        });

        it('defaults to STANDARD_RATED at 5% when treatment omitted', () => {
            const result = calculateLineItem({ quantity: 1, unitPrice: 100 });
            expect(result.vatAmount).toBe(5);
            expect(result.total).toBe(105);
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

        it('correctly aggregates discount amounts', () => {
            const items = [
                calculateLineItem({ quantity: 1, unitPrice: 200, discount: 10, vatTreatment: 'STANDARD_RATED', vatRate: 5 }),
                calculateLineItem({ quantity: 1, unitPrice: 100, discount: 0, vatTreatment: 'ZERO_RATED', vatRate: 0 }),
            ];
            const totals = calculateDocumentTotals(items);
            // Discount: 10% of 200 = 20
            expect(totals.discount).toBe(20);
            // Subtotal: 180 + 100 = 280
            expect(totals.subtotal).toBe(280);
            // VAT: 180 * 5% + 0 = 9
            expect(totals.totalVat).toBe(9);
            expect(totals.total).toBe(289);
        });

        it('returns zeros for empty item list', () => {
            const totals = calculateDocumentTotals([]);
            expect(totals.subtotal).toBe(0);
            expect(totals.totalVat).toBe(0);
            expect(totals.discount).toBe(0);
            expect(totals.total).toBe(0);
        });

        it('handles mixed VAT treatments in one document', () => {
            const items = [
                calculateLineItem({ quantity: 1, unitPrice: 100, vatTreatment: 'STANDARD_RATED', vatRate: 5 }),
                calculateLineItem({ quantity: 1, unitPrice: 100, vatTreatment: 'EXEMPT', vatRate: 0 }),
                calculateLineItem({ quantity: 1, unitPrice: 100, vatTreatment: 'ZERO_RATED', vatRate: 0 }),
            ];
            const totals = calculateDocumentTotals(items);
            expect(totals.totalVat).toBe(5); // only standard-rated contributes
            expect(totals.subtotal).toBe(300);
            expect(totals.total).toBe(305);
        });
    });
});
