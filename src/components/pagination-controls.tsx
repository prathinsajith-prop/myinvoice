import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface PaginationControlsProps {
    pagination: { total: number; page: number; limit: number; pages: number };
    page: number;
    onPageChange: (page: number) => void;
}

export function PaginationControls({ pagination, page, onPageChange }: PaginationControlsProps) {
    const t = useTranslations("common");
    const td = useTranslations("dashboard");
    if (pagination.pages <= 1) return null;

    return (
        <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
                {td("showingPagination", {
                    start: (pagination.page - 1) * pagination.limit + 1,
                    end: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total,
                })}
            </p>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    {t("previous")}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === pagination.pages}
                    onClick={() => onPageChange(page + 1)}
                >
                    {t("next")}
                </Button>
            </div>
        </div>
    );
}
