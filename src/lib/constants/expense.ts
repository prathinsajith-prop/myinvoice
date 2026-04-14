export const EXPENSE_CATEGORIES = [
    { value: "RENT", label: "Rent" },
    { value: "UTILITIES", label: "Utilities" },
    { value: "TRAVEL", label: "Travel" },
    { value: "MEALS_ENTERTAINMENT", label: "Meals & Entertainment" },
    { value: "OFFICE_SUPPLIES", label: "Office Supplies" },
    { value: "MARKETING", label: "Marketing" },
    { value: "SOFTWARE_SUBSCRIPTIONS", label: "Software Subscriptions" },
    { value: "PROFESSIONAL_FEES", label: "Professional Fees" },
    { value: "INSURANCE", label: "Insurance" },
    { value: "MAINTENANCE_REPAIRS", label: "Maintenance & Repairs" },
    { value: "SALARIES_WAGES", label: "Salaries & Wages" },
    { value: "TAX_PAYMENTS", label: "Tax Payments" },
    { value: "BANK_CHARGES", label: "Bank Charges" },
    { value: "OTHER", label: "Other" },
] as const;

export const EXPENSE_PAYMENT_METHODS = [
    { value: "CASH", label: "Cash" },
    { value: "CARD", label: "Credit / Debit Card" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
    { value: "CHEQUE", label: "Cheque" },
    { value: "STRIPE", label: "Stripe" },
    { value: "OTHER", label: "Other" },
] as const;
