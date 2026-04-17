import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
    rows?: number;
    /** "table" shows row skeletons, "card" shows block skeletons */
    variant?: "table" | "card";
}

export function LoadingState({ rows = 6, variant = "table" }: LoadingStateProps) {
    if (variant === "card") {
        return (
            <div className="space-y-3 py-4">
                {Array.from({ length: rows }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Table header skeleton */}
            <div className="flex items-center gap-4 border-b px-4 py-3">
                {[40, 25, 20, 15].map((w, i) => (
                    <Skeleton key={i} className="h-4 rounded" style={{ width: `${w}%` }} />
                ))}
            </div>
            {/* Table row skeletons */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5">
                    <Skeleton className="h-4 rounded" style={{ width: "40%" }} />
                    <Skeleton className="h-4 rounded" style={{ width: "25%" }} />
                    <Skeleton className="h-4 rounded" style={{ width: "20%" }} />
                    <Skeleton className="h-4 rounded" style={{ width: "15%" }} />
                </div>
            ))}
        </div>
    );
}
