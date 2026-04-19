"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    FileText,
    FileCheck,
    Users,
    Package,
    Receipt,
    Building2,
    CreditCard,
    Loader2,
} from "lucide-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    type: string;
    href: string;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
    invoice: FileText,
    quotation: FileCheck,
    customer: Users,
    product: Package,
    bill: Receipt,
    supplier: Building2,
    expense: CreditCard,
};

// QUICK_LINKS and TYPE_LABELS are now generated inside the component with translations

export function GlobalSearch() {
    const t = useTranslations("globalSearch");
    const [open, setOpen] = useState(false);

    const TYPE_LABELS: Record<string, string> = {
        invoice: t("types.INVOICE"),
        quotation: t("types.QUOTATION"),
        customer: t("types.CUSTOMER"),
        product: t("types.PRODUCT"),
        bill: t("types.BILL"),
        supplier: t("types.SUPPLIER"),
        expense: t("types.EXPENSE"),
    };

    const QUICK_LINKS: SearchResult[] = [
        { id: "nav-invoices", title: t("links.invoices"), type: "page", href: "/invoices" },
        { id: "nav-quotations", title: t("links.quotations"), type: "page", href: "/quotations" },
        { id: "nav-customers", title: t("links.customers"), type: "page", href: "/customers" },
        { id: "nav-products", title: t("links.products"), type: "page", href: "/products" },
        { id: "nav-bills", title: t("links.bills"), type: "page", href: "/bills" },
        { id: "nav-suppliers", title: t("links.suppliers"), type: "page", href: "/suppliers" },
        { id: "nav-expenses", title: t("links.expenses"), type: "page", href: "/expenses" },
        { id: "nav-reports", title: t("links.reports"), type: "page", href: "/reports" },
        { id: "nav-settings", title: t("links.settings"), type: "page", href: "/settings/profile" },
        { id: "nav-new-invoice", title: t("links.newInvoice"), type: "action", href: "/invoices?create=1" },
        { id: "nav-new-quotation", title: t("links.newQuotation"), type: "action", href: "/quotations?create=1" },
        { id: "nav-new-customer", title: t("links.newCustomer"), type: "action", href: "/customers?create=1" },
    ];
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const router = useRouter();
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const search = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setSearching(true);

        try {
            const endpoints = [
                { url: `/api/invoices?search=${encodeURIComponent(q)}&limit=5`, type: "invoice", titleKey: "invoiceNumber", hrefPrefix: "/invoices" },
                { url: `/api/quotations?search=${encodeURIComponent(q)}&limit=5`, type: "quotation", titleKey: "quoteNumber", hrefPrefix: "/quotations" },
                { url: `/api/customers?search=${encodeURIComponent(q)}&limit=5`, type: "customer", titleKey: "name", hrefPrefix: "/customers" },
                { url: `/api/products?search=${encodeURIComponent(q)}&limit=5`, type: "product", titleKey: "name", hrefPrefix: "/products" },
            ];

            const responses = await Promise.allSettled(
                endpoints.map(async (ep) => {
                    const res = await fetch(ep.url, { signal: controller.signal });
                    if (!res.ok) return [];
                    const json = await res.json();
                    const items = json.data ?? [];
                    return items.map((item: Record<string, unknown>) => ({
                        id: `${ep.type}-${item.id}`,
                        title: String(item[ep.titleKey] ?? item.name ?? item.id),
                        subtitle: item.customer ? (item.customer as { name: string }).name : undefined,
                        type: ep.type,
                        href: `${ep.hrefPrefix}/${item.id}`,
                    }));
                })
            );

            if (controller.signal.aborted) return;

            const allResults: SearchResult[] = [];
            for (const r of responses) {
                if (r.status === "fulfilled") allResults.push(...r.value);
            }
            setResults(allResults);
        } catch {
            // aborted or error
        } finally {
            if (!controller.signal.aborted) setSearching(false);
        }
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => search(query), 250);
        return () => clearTimeout(timeout);
    }, [query, search]);

    const handleSelect = (href: string) => {
        setOpen(false);
        setQuery("");
        setResults([]);
        router.push(href);
    };

    const filteredQuickLinks = query.trim()
        ? QUICK_LINKS.filter((l) => l.title.toLowerCase().includes(query.toLowerCase()))
        : QUICK_LINKS;

    // Group results by type
    const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        (acc[r.type] ??= []).push(r);
        return acc;
    }, {});

    return (
        <>
            <Button
                variant="outline"
                className="hidden sm:flex items-center gap-2 text-muted-foreground h-8 w-56 justify-start text-sm"
                onClick={() => setOpen(true)}
            >
                <Search className="h-3.5 w-3.5" />
                <span>{t("placeholder")}</span>
                <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    ⌘K
                </kbd>
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8"
                onClick={() => setOpen(true)}
            >
                <Search className="h-4 w-4" />
            </Button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput
                    placeholder={t("inputPlaceholder")}
                    value={query}
                    onValueChange={setQuery}
                />
                <CommandList>
                    {searching && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!searching && query.trim() && results.length === 0 && filteredQuickLinks.length === 0 && (
                        <CommandEmpty>{t("noResults")}</CommandEmpty>
                    )}

                    {Object.entries(grouped).map(([type, items]) => (
                        <CommandGroup key={type} heading={TYPE_LABELS[type] ?? type}>
                            {items.map((item) => {
                                const Icon = TYPE_ICONS[type] ?? FileText;
                                return (
                                    <CommandItem
                                        key={item.id}
                                        value={item.title}
                                        onSelect={() => handleSelect(item.href)}
                                    >
                                        <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span>{item.title}</span>
                                        {item.subtitle && (
                                            <span className="ml-2 text-muted-foreground text-xs">{item.subtitle}</span>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    ))}

                    {filteredQuickLinks.length > 0 && (
                        <CommandGroup heading={t("quickLinks")}>
                            {filteredQuickLinks.slice(0, 6).map((link) => (
                                <CommandItem
                                    key={link.id}
                                    value={link.title}
                                    onSelect={() => handleSelect(link.href)}
                                >
                                    <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <span>{link.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}
