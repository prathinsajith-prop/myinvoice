"use client";

import { useState, useEffect } from "react";

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

// Module-level cache — survives across modal open/close cycles
let _cache: OrgSettings | null = null;
let _promise: Promise<OrgSettings> | null = null;

function loadOrgSettings(): Promise<OrgSettings> {
    if (_cache) return Promise.resolve(_cache);
    if (!_promise) {
        _promise = fetch("/api/organization")
            .then((r) => r.json())
            .then((json) => {
                const org = json.organization ?? {};
                _cache = {
                    defaultCurrency: org.defaultCurrency ?? "AED",
                    defaultDueDateDays: org.defaultDueDateDays ?? 30,
                    defaultPaymentTerms: org.defaultPaymentTerms ?? 30,
                    defaultVatRate: Number(org.defaultVatRate ?? 5),
                    defaultNotes: org.defaultNotes ?? "",
                    defaultTerms: org.defaultTerms ?? "",
                };
                return _cache;
            })
            .catch(() => DEFAULTS)
            .finally(() => { _promise = null; });
    }
    return _promise;
}

/** Call this after org settings are saved to force a refresh on next open */
export function invalidateOrgSettingsCache() {
    _cache = null;
}

/** Returns a promise that resolves to org settings (uses cache if warm) */
export { loadOrgSettings };

export function useOrgSettings(): OrgSettings {
    const [settings, setSettings] = useState<OrgSettings>(_cache ?? DEFAULTS);

    useEffect(() => {
        loadOrgSettings().then(setSettings);
    }, []);

    return settings;
}
