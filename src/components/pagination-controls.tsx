import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
    pagination: { total: number; page: number; limit: number; pages: number };
    page: number;
    onPageChange: (page: number) => void;
}

export function PaginationControls({ pagination, page, onPageChange }: PaginationControlsProps) {
    if (pagination.pages <= 1) return null;

    return (
        <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total}
            </p>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === pagination.pages}
                    onClick={() => onPageChange(page + 1)}
                >
                    Next
                </Button>
            </div>
        </div>
    );
}
