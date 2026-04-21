/**
 * Shared types for PDF generation across all templates.
 */

export interface InvoicePdfLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    vatAmount: number;
    total: number;
}

export interface InvoicePdfData {
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date;
    currency: string;
    subtotal: number;
    totalVat: number;
    total: number;
    outstanding: number;
    customerName: string;
    customerEmail?: string | null;
    organizationName: string;
    organizationTrn?: string | null;
    organizationLogo?: string | null;
    organizationPhone?: string | null;
    organizationWebsite?: string | null;
    organizationAddress?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    notes?: string | null;
    lineItems: InvoicePdfLineItem[];
    qrCodeData?: string | null;
}

export interface DocLineItem {
    description: string;
    quantity: number;
    unitPrice?: number;
    discount?: number;
    vatAmount?: number;
    total?: number;
    unitOfMeasure?: string;
    notes?: string;
}

export interface DocumentPdfData {
    docType: "BILL" | "QUOTATION" | "CREDIT_NOTE" | "DEBIT_NOTE" | "PURCHASE_ORDER" | "DELIVERY_NOTE";
    docNumber: string;
    status?: string;
    currency: string;
    issueDate: Date;
    dueDate?: Date | null;
    expiryDate?: Date | null;
    expectedDate?: Date | null;
    deliveryDate?: Date | null;
    subtotal?: number;
    totalVat?: number;
    totalDiscount?: number;
    total?: number;
    outstanding?: number;
    partyName: string;
    partyEmail?: string | null;
    partyType: "customer" | "supplier";
    organizationName: string;
    organizationTrn?: string | null;
    organizationLogo?: string | null;
    organizationPhone?: string | null;
    organizationWebsite?: string | null;
    organizationAddress?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    reference?: string | null;
    shippingAddress?: string | null;
    trackingNumber?: string | null;
    carrier?: string | null;
    driverName?: string | null;
    vehicleNumber?: string | null;
    notes?: string | null;
    terms?: string | null;
    lineItems: DocLineItem[];
}
