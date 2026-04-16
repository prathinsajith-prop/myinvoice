import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function SearchInput({ placeholder, value, onChange, className }: SearchInputProps) {
    return (
        <div className={`relative ${className ?? "w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm"}`}>
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
    );
}
