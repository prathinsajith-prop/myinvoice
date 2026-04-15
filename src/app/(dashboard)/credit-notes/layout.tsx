import type { Metadata } from "next";

export const metadata: Metadata = { title: "Credit Notes" };

export default function CreditNotesLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
