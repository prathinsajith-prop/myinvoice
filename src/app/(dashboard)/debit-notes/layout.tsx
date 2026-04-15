import type { Metadata } from "next";

export const metadata: Metadata = { title: "Debit Notes" };

export default function DebitNotesLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
