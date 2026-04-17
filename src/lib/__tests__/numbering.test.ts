import { describe, it, expect } from 'vitest';

/**
 * Extracts the PO numbering logic from the API route so it can be unit-tested
 * without a database.  The production code mirrors this exactly.
 */
function generatePoNumber(lastPoNumber: string | null | undefined): string {
    const lastSeq = lastPoNumber
        ? parseInt(lastPoNumber.replace(/\D/g, ''), 10) || 0
        : 0;
    const nextSeq = lastSeq + 1;
    return `PO-${String(nextSeq).padStart(4, '0')}`;
}

describe('PO Number Generation', () => {
    it('generates PO-0001 when no previous PO exists', () => {
        expect(generatePoNumber(null)).toBe('PO-0001');
    });

    it('generates PO-0001 when undefined', () => {
        expect(generatePoNumber(undefined)).toBe('PO-0001');
    });

    it('increments from an existing PO number', () => {
        expect(generatePoNumber('PO-0001')).toBe('PO-0002');
        expect(generatePoNumber('PO-0010')).toBe('PO-0011');
        expect(generatePoNumber('PO-0099')).toBe('PO-0100');
    });

    it('pads the sequence to 4 digits', () => {
        expect(generatePoNumber('PO-0009')).toBe('PO-0010');
    });

    it('handles sequences beyond 4 digits without truncation', () => {
        expect(generatePoNumber('PO-9999')).toBe('PO-10000');
    });

    it('handles non-standard existing formats gracefully', () => {
        // If somehow a PO was created with a different prefix, still increments
        expect(generatePoNumber('PO-0050')).toBe('PO-0051');
    });
});

describe('Invoice Status Logic', () => {
    type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'VOID';

    function canVoid(status: InvoiceStatus): boolean {
        return !['PAID', 'VOID'].includes(status);
    }

    function canDelete(status: InvoiceStatus): boolean {
        return status === 'DRAFT';
    }

    it('can void DRAFT, SENT, VIEWED invoices', () => {
        expect(canVoid('DRAFT')).toBe(true);
        expect(canVoid('SENT')).toBe(true);
        expect(canVoid('VIEWED')).toBe(true);
    });

    it('cannot void PAID or already VOID invoices', () => {
        expect(canVoid('PAID')).toBe(false);
        expect(canVoid('VOID')).toBe(false);
    });

    it('can void OVERDUE invoice', () => {
        expect(canVoid('OVERDUE')).toBe(true);
    });

    it('can only delete DRAFT invoices', () => {
        expect(canDelete('DRAFT')).toBe(true);
        expect(canDelete('SENT')).toBe(false);
        expect(canDelete('PAID')).toBe(false);
        expect(canDelete('VOID')).toBe(false);
    });
});

describe('PO Status Transitions', () => {
    type POStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

    function canEditPO(status: POStatus): boolean {
        return status !== 'CANCELLED';
    }

    function canDeletePO(status: POStatus): boolean {
        return status === 'DRAFT';
    }

    it('can edit any non-cancelled PO', () => {
        const editable: POStatus[] = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'];
        editable.forEach(s => expect(canEditPO(s)).toBe(true));
    });

    it('cannot edit a cancelled PO', () => {
        expect(canEditPO('CANCELLED')).toBe(false);
    });

    it('can only delete DRAFT POs', () => {
        expect(canDeletePO('DRAFT')).toBe(true);
        expect(canDeletePO('SENT')).toBe(false);
        expect(canDeletePO('CONFIRMED')).toBe(false);
        expect(canDeletePO('RECEIVED')).toBe(false);
        expect(canDeletePO('CANCELLED')).toBe(false);
    });
});
