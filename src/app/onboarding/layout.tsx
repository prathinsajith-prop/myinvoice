import { type Metadata } from "next";

export const metadata: Metadata = {
    title: "Onboarding — MyInvoice AE",
    description: "Set up your organization and get started with MyInvoice AE.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
