export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface SendEmailResult {
    success: boolean;
    provider: "gmail" | "resend" | "unknown";
    messageId?: string;
    error?: string;
}
