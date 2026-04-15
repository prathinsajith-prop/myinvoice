import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const issuer = process.env.TOTP_ISSUER || "myinvoice.ae";

export function createTotpSecret() {
    return generateSecret();
}

export function getTotpOtpAuthUrl(email: string, secret: string) {
    return generateURI({
        strategy: "totp",
        issuer,
        label: email,
        secret,
        period: 30,
        digits: 6,
    });
}

export async function getTotpQrDataUrl(email: string, secret: string) {
    const otpauth = getTotpOtpAuthUrl(email, secret);
    return QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
}

export function verifyTotpCode(secret: string, code: string) {
    return verifySync({
        strategy: "totp",
        secret,
        token: code,
        period: 30,
        epochTolerance: 30,
    }).valid;
}
