"use client";

import { useCallback, useState } from "react";
import { type SendEmailOptions, type SendEmailResult } from "@/lib/email/types";

export type EmailPayload = SendEmailOptions;
export type EmailResult = SendEmailResult;
export type EmailSender = (payload: SendEmailOptions) => Promise<SendEmailResult>;

/**
 * Reusable client-side hook for email send flows.
 *
 * Pass in any async sender implementation (API call, action wrapper, etc.),
 * and this hook will manage loading, success, and error state.
 */
export function useEmail(sender: EmailSender) {
    const [isSending, setIsSending] = useState(false);
    const [lastResult, setLastResult] = useState<EmailResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const send = useCallback(
        async (payload: EmailPayload) => {
            setIsSending(true);
            setError(null);

            try {
                const result = await sender(payload);
                setLastResult(result);

                if (!result.success) {
                    setError(result.error ?? "Unable to send email");
                }

                return result;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unable to send email";
                setError(message);

                const result: EmailResult = {
                    success: false,
                    provider: "unknown",
                    error: message,
                };
                setLastResult(result);
                return result;
            } finally {
                setIsSending(false);
            }
        },
        [sender],
    );

    const reset = useCallback(() => {
        setIsSending(false);
        setLastResult(null);
        setError(null);
    }, []);

    return {
        send,
        reset,
        isSending,
        lastResult,
        error,
    };
}
