import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "myinvoice.ae - UAE E-Invoicing Platform",
    template: "%s | myinvoice.ae",
  },
  description:
    "Professional e-invoicing solution for UAE businesses. FTA compliant, VAT ready, bilingual (English & Arabic).",
  keywords: [
    "UAE invoicing",
    "e-invoicing",
    "FTA compliant",
    "VAT invoice",
    "Dubai invoice software",
    "فواتير الإمارات",
    "الفواتير الإلكترونية",
  ],
  authors: [{ name: "myinvoice.ae" }],
  creator: "myinvoice.ae",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_AE",
    alternateLocale: "ar_AE",
    url: "/",
    siteName: "myinvoice.ae",
    title: "myinvoice.ae - UAE E-Invoicing Platform",
    description:
      "Professional e-invoicing solution for UAE businesses. FTA compliant, VAT ready.",
  },
  twitter: {
    card: "summary_large_image",
    title: "myinvoice.ae - UAE E-Invoicing Platform",
    description:
      "Professional e-invoicing solution for UAE businesses. FTA compliant, VAT ready.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
