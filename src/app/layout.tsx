import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_URL } from "@/lib/constants/env";
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
    APP_URL
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
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "ar" ? "ar" : "en";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
