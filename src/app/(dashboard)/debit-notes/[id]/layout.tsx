import type { Metadata } from "next";

export const metadata: Metadata = { title: "Debit Note" };

export default function DebitNoteLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
