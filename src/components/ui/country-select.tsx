"use client";

import { useState, useMemo } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getCountryOptions, type CountryOption } from "@/lib/utils/countries";

// Singleton: build the list once, reuse across all instances
let _cachedCountries: CountryOption[] | null = null;
function getCountries(): CountryOption[] {
    if (!_cachedCountries) _cachedCountries = getCountryOptions();
    return _cachedCountries;
}

interface CountrySelectProps {
    /** ISO alpha-2 value e.g. "AE" */
    value: string;
    onChange: (iso2: string) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
    showCurrency?: boolean;
}

export function CountrySelect({
    value,
    onChange,
    disabled = false,
    className,
    placeholder = "Select country…",
    showCurrency = true,
}: CountrySelectProps) {
    const countries = useMemo(() => getCountries(), []);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        if (!query) return countries.slice(0, 60);
        const q = query.toLowerCase();
        return countries.filter(
            (c) =>
                c.label.toLowerCase().includes(q) ||
                c.value.toLowerCase().includes(q) ||
                c.currency.toLowerCase().includes(q) ||
                c.callingCode.includes(q)
        );
    }, [countries, query]);

    const selected = countries.find((c) => c.value === value);

    return (
        <div className={cn("relative", className)}>
            <Button
                type="button"
                disabled={disabled}
                variant="outline"
                onClick={() => !disabled && setOpen((o) => !o)}
                className={cn(
                    "flex h-10 w-full items-center justify-between px-3 py-2 text-sm",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                )}
            >
                {selected ? (
                    <span className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none shrink-0">{selected.flag}</span>
                        <span className="truncate">{selected.label}</span>
                        {showCurrency && (
                            <Badge variant="secondary" className="ml-1 text-xs shrink-0">
                                {selected.currency}
                            </Badge>
                        )}
                    </span>
                ) : (
                    <span className="text-muted-foreground">{placeholder}</span>
                )}
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </Button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        role="presentation"
                        className="fixed inset-0 z-40"
                        onClick={() => { setOpen(false); setQuery(""); }}
                        onKeyDown={() => { setOpen(false); setQuery(""); }}
                    />
                    <div className="absolute z-50 mt-1 w-full min-w-[16rem] rounded-md border bg-popover shadow-lg">
                        {/* Search input */}
                        <div className="flex items-center gap-2 border-b px-3">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <Input
                                placeholder="Search country, code or currency…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                            />
                        </div>

                        {/* Country list */}
                        <ul className="max-h-64 overflow-y-auto p-1">
                            {filtered.length === 0 ? (
                                <li className="py-6 text-center text-sm text-muted-foreground">
                                    No country found
                                </li>
                            ) : (
                                filtered.map((c) => (
                                    <li key={c.value}>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className={cn(
                                                "flex h-auto w-full items-center gap-2 justify-start rounded-sm px-2 py-1.5 text-sm",
                                                "hover:bg-accent hover:text-accent-foreground",
                                                value === c.value && "bg-accent/50"
                                            )}
                                            onClick={() => {
                                                onChange(c.value);
                                                setOpen(false);
                                                setQuery("");
                                            }}
                                        >
                                            <span className="text-base leading-none shrink-0">{c.flag}</span>
                                            <span className="flex-1 text-left truncate">{c.label}</span>
                                            <span className="text-xs text-muted-foreground shrink-0">{c.value}</span>
                                            {showCurrency && (
                                                <Badge variant="outline" className="text-xs shrink-0">
                                                    {c.currency}
                                                </Badge>
                                            )}
                                            {value === c.value && (
                                                <Check className="h-4 w-4 text-primary shrink-0" />
                                            )}
                                        </Button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
