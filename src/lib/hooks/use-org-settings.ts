"use client";

import useSWR, { mutate } from "swr";

import { jsonFetcher } from "@/lib/fetcher";

export interface OrgSettings {
    defaultCurrency: string;
    dateFormat: string;
    defaultDueDateDays: number;
    defaultPaymentTerms: number;
    defaultVatRate: number;
    defaultNotes: string;
    defaultTerms: string;
    primaryColor: string;
}

const DEFAULTS: OrgSettings = {
    defaultCurrency: "AED",
    dateFormat: "DD/MM/YYYY",
    defaultDueDateDays: 30,
    defaultPaymentTerms: 30,
    defaultVatRate: 5,
    defaultNotes: "",
    defaultTerms: "",
    primaryColor: "#1e3a8a",
};

// Use an internal key that will never collide with raw /api/organization SWR calls
// (org settings pages use jsonFetcher with /api/organization and return a different shape)
const ORG_SETTINGS_CACHE_KEY = "org:settings";
const ORG_SETTINGS_API = "/api/organization";

async function fetchOrgSettings(): Promise<OrgSettings> {
    try {
        const json = await jsonFetcher<{
            organization?: Record<string, unknown> & {
                settings?: {
                    dateFormat?: string;
                };
            };
        }>(ORG_SETTINGS_API);
        const org = json.organization ?? {};

        return {
            defaultCurrency: (org.defaultCurrency as string) ?? "AED",
            dateFormat: (org.settings as Record<string, string> | undefined)?.dateFormat ?? "DD/MM/YYYY",
            defaultDueDateDays: Number(org.defaultDueDateDays ?? 30) || 30,
            defaultPaymentTerms: Number(org.defaultPaymentTerms ?? 30) || 30,
            defaultVatRate: Number(org.defaultVatRate ?? 5),
            defaultNotes: (org.defaultNotes as string) ?? "",
            defaultTerms: (org.defaultTerms as string) ?? "",
            primaryColor: (org.primaryColor as string) ?? "#1e3a8a",
        };
    } catch {
        return DEFAULTS;
    }
}

/** Call this after org settings are saved to force a refresh on next open */
export function invalidateOrgSettingsCache() {
    void mutate(ORG_SETTINGS_CACHE_KEY);
}

/** Returns a promise that resolves to org settings (uses cache if warm) */
export async function loadOrgSettings(): Promise<OrgSettings> {
    const settings = await mutate(ORG_SETTINGS_CACHE_KEY, fetchOrgSettings(), {
        populateCache: true,
        revalidate: false,
    });

    return settings ?? DEFAULTS;
}

export function useOrgSettings(): OrgSettings {
    const { data } = useSWR(ORG_SETTINGS_CACHE_KEY, fetchOrgSettings, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    });

    return data ?? DEFAULTS;
}
