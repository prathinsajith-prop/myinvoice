import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
    title: string;
    description: string;
    actions?: React.ReactNode;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function PageHeader({ title, description, actions, onRefresh, isRefreshing }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-muted-foreground">{description}</p>
            </div>
            {(onRefresh || actions) && (
                <div className="flex items-center gap-2">
                    {onRefresh && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            aria-label="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                    )}
                    {actions}
                </div>
            )}
        </div>
    );
}
