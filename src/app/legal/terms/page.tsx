export default function TermsPage() {
    return (
        <div className="container mx-auto max-w-3xl px-4 py-14 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Last updated: 14 April 2026</p>

            <section className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p>By using myinvoice.ae, you agree to use the service lawfully and maintain accurate financial records.</p>
                <p>You remain responsible for tax filings, invoice content accuracy, and third-party integrations configured on your account.</p>
                <p>Subscription fees are billed monthly unless otherwise stated and can be changed with prior notice.</p>
                <p>We may suspend abusive or fraudulent usage to protect platform security and customer data.</p>
            </section>
        </div>
    );
}
