import type { Metadata } from "next";

export const metadata: Metadata = { title: "Credit Note" };

export default function CreditNoteLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
