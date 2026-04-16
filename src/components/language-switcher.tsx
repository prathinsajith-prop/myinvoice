"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
    const locale = useLocale();
    const isArabic = locale === "ar";

    function switchLocale(next: "en" | "ar") {
        // next-intl middleware reads NEXT_LOCALE cookie on every request
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
        window.location.reload();
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={() => switchLocale(isArabic ? "en" : "ar")}
            className="h-8 min-w-[42px] px-2.5 text-xs font-semibold tracking-wide"
            title={isArabic ? "Switch to English" : "التحويل إلى العربية"}
        >
            {isArabic ? "EN" : "AR"}
        </Button>
    );
}
