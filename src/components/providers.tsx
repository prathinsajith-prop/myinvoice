"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TenantProvider } from "@/lib/tenant/context";
import { type ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TenantProvider>
          {children}
          <Toaster position="top-right" />
        </TenantProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
