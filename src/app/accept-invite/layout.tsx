import { type Metadata } from "next";

export const metadata: Metadata = {
    title: "Accept Invitation — MyInvoice AE",
    description: "Accept your invitation to join an organization on MyInvoice AE.",
};

export default function AcceptInviteLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
