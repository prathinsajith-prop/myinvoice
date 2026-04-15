import { Search, X, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchInputProps {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    className?: string;
}

export function SearchInput({ placeholder, value, onChange, onRefresh, isRefreshing, className }: SearchInputProps) {
    return (
        <div className="flex items-center gap-2">
            <div className={className ?? "relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm"}>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={value ? "pl-9 pr-9" : "pl-9"}
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
            {onRefresh && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    aria-label="Refresh"
                    className="shrink-0"
                >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
            )}
        </div>
    );
}
