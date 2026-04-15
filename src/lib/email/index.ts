/**
 * Email service — uses Resend when RESEND_API_KEY is set,
 * with optional console fallback during local development.
 */

import nodemailer from "nodemailer";
import { type SendEmailOptions, type SendEmailResult } from "./types";

function logDevFallbackEmail(opts: SendEmailOptions) {
  console.log("📧 [EMAIL - dev fallback]");
  console.log(`  To: ${opts.to}`);
  console.log(`  Subject: ${opts.subject}`);
  if (opts.text) {
    console.log(`  Text: ${opts.text}`);
  }
  console.log(`  Body preview: ${opts.html.slice(0, 200)}...`);
}

async function sendViaGmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !appPassword) {
    return {
      success: false,
      provider: "gmail",
      error: "Gmail provider not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass: appPassword,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? user,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    return {
      success: true,
      provider: "gmail",
      messageId: info?.messageId,
    };
  } catch (err) {
    console.error("Gmail send failed:", err);
    return {
      success: false,
      provider: "gmail",
      error: err instanceof Error ? err.message : "Unknown Gmail send error",
    };
  }
}

async function sendViaResend(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      provider: "resend",
      error:
        "Resend provider not configured. Set RESEND_API_KEY.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "myinvoice.ae <noreply@myinvoice.ae>",
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return {
        success: false,
        provider: "resend",
        error: err,
      };
    }

    const data = await res.json().catch(() => ({}));
    return {
      success: true,
      provider: "resend",
      messageId: data?.id,
    };
  } catch (err) {
    console.error("Email send failed:", err);
    return {
      success: false,
      provider: "resend",
      error: err instanceof Error ? err.message : "Unknown Resend send error",
    };
  }
}

export async function sendMail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  const allowConsoleFallback = process.env.EMAIL_DEV_FALLBACK === "true";
  const isDev = process.env.NODE_ENV !== "production";

  let result: SendEmailResult;
  if (provider === "gmail") {
    result = await sendViaGmail(opts);
  } else if (provider === "resend") {
    result = await sendViaResend(opts);
  } else {
    result = {
      success: false,
      provider: "unknown",
      error: `Unsupported EMAIL_PROVIDER: ${provider}`,
    };
  }

  if (!result.success && allowConsoleFallback && isDev) {
    console.warn("Falling back to console email logging for local development.");
    logDevFallbackEmail(opts);
    return {
      success: true,
      provider: result.provider,
      error: result.error,
    };
  }

  return result;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const result = await sendMail(opts);
  return result.success;
}
