export default function PrivacyPage() {
    return (
        <div className="container mx-auto max-w-3xl px-4 py-14 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: 14 April 2026</p>

            <section className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p>We collect account details, organization profile information, and financial document data required to provide invoicing services.</p>
                <p>We use this data to generate invoices, compliance summaries, and collaboration features requested by your team.</p>
                <p>We do not sell your personal data. Data processors may include cloud storage, email delivery, and payment processors.</p>
                <p>You can request data export or account deletion by contacting support@myinvoice.ae.</p>
            </section>
        </div>
    );
}
