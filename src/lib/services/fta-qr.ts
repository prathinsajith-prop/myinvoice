function tlvField(tag: number, value: string): Buffer {
    const valueBuffer = Buffer.from(value, "utf8");
    return Buffer.concat([Buffer.from([tag, valueBuffer.length]), valueBuffer]);
}

export interface FtaQrInput {
    sellerName: string;
    trn: string;
    timestampIso: string;
    invoiceTotal: number;
    vatTotal: number;
}

// UAE FTA-compliant TLV payload (Base64 encoded)
export function generateFtaQrPayload(input: FtaQrInput): string {
    const payload = Buffer.concat([
        tlvField(1, input.sellerName),
        tlvField(2, input.trn),
        tlvField(3, input.timestampIso),
        tlvField(4, input.invoiceTotal.toFixed(2)),
        tlvField(5, input.vatTotal.toFixed(2)),
    ]);

    return payload.toString("base64");
}
