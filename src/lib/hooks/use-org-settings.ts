"use client";

import useSWR, { mutate } from "swr";

import { jsonFetcher } from "@/lib/fetcher";

export interface OrgSettings {
    defaultCurrency: string;
    defaultDueDateDays: number;
    defaultPaymentTerms: number;
    defaultVatRate: number;
    defaultNotes: string;
    defaultTerms: string;
}

const DEFAULTS: OrgSettings = {
    defaultCurrency: "AED",
    defaultDueDateDays: 30,
    defaultPaymentTerms: 30,
    defaultVatRate: 5,
    defaultNotes: "",
    defaultTerms: "",
};

const ORG_SETTINGS_KEY = "/api/organization";

async function fetchOrgSettings(): Promise<OrgSettings> {
    try {
        const json = await jsonFetcher<{ organization?: Partial<OrgSettings> }>(ORG_SETTINGS_KEY);
        const org = json.organization ?? {};

        return {
            defaultCurrency: org.defaultCurrency ?? "AED",
            defaultDueDateDays: org.defaultDueDateDays ?? 30,
            defaultPaymentTerms: org.defaultPaymentTerms ?? 30,
            defaultVatRate: Number(org.defaultVatRate ?? 5),
            defaultNotes: org.defaultNotes ?? "",
            defaultTerms: org.defaultTerms ?? "",
        };
    } catch {
        return DEFAULTS;
    }
}

/** Call this after org settings are saved to force a refresh on next open */
export function invalidateOrgSettingsCache() {
    void mutate(ORG_SETTINGS_KEY);
}

/** Returns a promise that resolves to org settings (uses cache if warm) */
export async function loadOrgSettings(): Promise<OrgSettings> {
    const settings = await mutate(ORG_SETTINGS_KEY, fetchOrgSettings(), {
        populateCache: true,
        revalidate: false,
    });

    return settings ?? DEFAULTS;
}

export function useOrgSettings(): OrgSettings {
    const { data } = useSWR(ORG_SETTINGS_KEY, fetchOrgSettings, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    });

    return data ?? DEFAULTS;
}
