export async function jsonFetcher<T>(input: string): Promise<T> {
    const response = await fetch(input, { cache: "no-store" });
    const text = await response.text();

    let payload: unknown = null;

    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    if (!response.ok) {
        const message =
            payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
                ? payload.error
                : "Request failed";

        throw new Error(message);
    }

    return payload as T;
}