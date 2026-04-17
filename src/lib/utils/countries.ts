import { getAllCountries } from "country-atlas";

export interface CountryOption {
    value: string;   // ISO alpha2 e.g. "AE"
    label: string;   // "United Arab Emirates"
    flag: string;    // emoji "🇦🇪"
    flagImage: string; // SVG data URI from country-atlas
    currency: string; // "AED"
    currencySymbol: string; // "د.إ"
    currencyName: string; // "UAE Dirham"
    callingCode: string; // "+971"
    timezones: string[]; // ["Asia/Dubai"]
}

function toSvgDataUri(svg: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// IANA timezone → country ISO2 mapping (covers ~180 countries)
const COUNTRY_TIMEZONES: Record<string, string[]> = {
    AE: ["Asia/Dubai"],
    SA: ["Asia/Riyadh"],
    QA: ["Asia/Qatar"],
    KW: ["Asia/Kuwait"],
    BH: ["Asia/Bahrain"],
    OM: ["Asia/Muscat"],
    JO: ["Asia/Amman"],
    LB: ["Asia/Beirut"],
    IQ: ["Asia/Baghdad"],
    EG: ["Africa/Cairo"],
    GB: ["Europe/London"],
    US: [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Anchorage",
        "Pacific/Honolulu",
    ],
    CA: [
        "America/Toronto",
        "America/Winnipeg",
        "America/Edmonton",
        "America/Vancouver",
    ],
    AU: [
        "Australia/Sydney",
        "Australia/Melbourne",
        "Australia/Brisbane",
        "Australia/Perth",
        "Australia/Adelaide",
    ],
    IN: ["Asia/Kolkata"],
    CN: ["Asia/Shanghai"],
    JP: ["Asia/Tokyo"],
    SG: ["Asia/Singapore"],
    HK: ["Asia/Hong_Kong"],
    PK: ["Asia/Karachi"],
    BD: ["Asia/Dhaka"],
    LK: ["Asia/Colombo"],
    NP: ["Asia/Kathmandu"],
    MM: ["Asia/Yangon"],
    TH: ["Asia/Bangkok"],
    VN: ["Asia/Ho_Chi_Minh"],
    PH: ["Asia/Manila"],
    MY: ["Asia/Kuala_Lumpur"],
    ID: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"],
    KR: ["Asia/Seoul"],
    TW: ["Asia/Taipei"],
    TR: ["Europe/Istanbul"],
    IL: ["Asia/Jerusalem"],
    IR: ["Asia/Tehran"],
    AF: ["Asia/Kabul"],
    UZ: ["Asia/Tashkent"],
    KZ: ["Asia/Almaty"],
    DE: ["Europe/Berlin"],
    FR: ["Europe/Paris"],
    ES: ["Europe/Madrid"],
    IT: ["Europe/Rome"],
    NL: ["Europe/Amsterdam"],
    BE: ["Europe/Brussels"],
    PT: ["Europe/Lisbon"],
    CH: ["Europe/Zurich"],
    AT: ["Europe/Vienna"],
    SE: ["Europe/Stockholm"],
    NO: ["Europe/Oslo"],
    DK: ["Europe/Copenhagen"],
    FI: ["Europe/Helsinki"],
    PL: ["Europe/Warsaw"],
    RU: [
        "Europe/Moscow",
        "Europe/Kaliningrad",
        "Asia/Yekaterinburg",
        "Asia/Novosibirsk",
        "Asia/Vladivostok",
    ],
    UA: ["Europe/Kiev"],
    RO: ["Europe/Bucharest"],
    GR: ["Europe/Athens"],
    CZ: ["Europe/Prague"],
    HU: ["Europe/Budapest"],
    ZA: ["Africa/Johannesburg"],
    NG: ["Africa/Lagos"],
    KE: ["Africa/Nairobi"],
    GH: ["Africa/Accra"],
    MA: ["Africa/Casablanca"],
    TN: ["Africa/Tunis"],
    ET: ["Africa/Addis_Ababa"],
    BR: [
        "America/Sao_Paulo",
        "America/Manaus",
        "America/Belem",
        "America/Fortaleza",
    ],
    MX: ["America/Mexico_City", "America/Monterrey", "America/Tijuana"],
    AR: ["America/Argentina/Buenos_Aires"],
    CL: ["America/Santiago"],
    CO: ["America/Bogota"],
    PE: ["America/Lima"],
    VE: ["America/Caracas"],
    NZ: ["Pacific/Auckland"],
};

let _cachedCountries: CountryOption[] | null = null;

export function getCountryOptions(): CountryOption[] {
    if (_cachedCountries) return _cachedCountries;

    const all = getAllCountries();
    _cachedCountries = all
        .map((c) => ({
            value: c.iso.alpha2,
            label: c.name,
            flag: c.flag?.emoji ?? "",
            flagImage: c.flag?.svg ? toSvgDataUri(c.flag.svg) : "",
            currency: c.currency?.code ?? "USD",
            currencySymbol: c.currency?.symbol ?? c.currency?.code ?? "",
            currencyName: c.currency?.name ?? "",
            callingCode: c.callingCode ?? "",
            timezones: COUNTRY_TIMEZONES[c.iso.alpha2] ?? [],
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return _cachedCountries as CountryOption[];
}

export function getTimezonesForCountry(iso2: string): string[] {
    return COUNTRY_TIMEZONES[iso2] ?? [];
}

/** All IANA timezones via Intl, grouped for display */
export function getAllTimezones(): string[] {
    try {
        return Intl.supportedValuesOf("timeZone");
    } catch {
        // Fallback for environments that don't support Intl.supportedValuesOf
        return Object.values(COUNTRY_TIMEZONES).flat();
    }
}

/** Format a timezone for display: "Asia/Dubai → UTC+4" */
export function formatTimezone(tz: string): string {
    try {
        const now = new Date();
        const offset = new Intl.DateTimeFormat("en", {
            timeZone: tz,
            timeZoneName: "shortOffset",
        })
            .formatToParts(now)
            .find((p) => p.type === "timeZoneName")?.value ?? "";
        const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
        return `${city} (${offset})`;
    } catch {
        return tz;
    }
}

/** Get the default currency code for a country ISO2 code */
export function getCurrencyForCountry(iso2: string): string {
    const countries = getCountryOptions();
    const country = countries.find((c) => c.value === iso2);
    return country?.currency ?? "USD";
}

export const UAE_EMIRATES = [
    "Abu Dhabi",
    "Dubai",
    "Sharjah",
    "Ajman",
    "Umm Al Quwain",
    "Ras Al Khaimah",
    "Fujairah",
];

export const BUSINESS_TYPES = [
    { value: "LLC", label: "LLC (Limited Liability Company)" },
    { value: "FZE", label: "FZE (Free Zone Establishment)" },
    { value: "FZCO", label: "FZCO (Free Zone Company)" },
    { value: "LTD", label: "LTD (Limited)" },
    { value: "SOLE_PROP", label: "Sole Proprietorship" },
    { value: "PARTNERSHIP", label: "Partnership" },
    { value: "BRANCH", label: "Branch Office" },
    { value: "REP_OFFICE", label: "Representative Office" },
    { value: "OTHER", label: "Other" },
];
