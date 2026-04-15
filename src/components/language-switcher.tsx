"use client";

import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
    const pathname = usePathname();
    const isArabic = typeof document !== "undefined" && document.documentElement.lang === "ar";

    function switchLocale(next: "en" | "ar") {
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;

        // Normalize legacy locale-prefixed paths to the actual route tree.
        const normalizedPath = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
        window.location.href = normalizedPath;
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => switchLocale(isArabic ? "en" : "ar")}
            aria-label="Toggle language"
            title={isArabic ? "Switch to English" : "التحويل إلى العربية"}
        >
            <Languages className="h-4 w-4" />
        </Button>
    );
}
