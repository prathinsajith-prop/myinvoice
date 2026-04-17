"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, File } from "lucide-react";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/lib/tenant/context";
import { useOrgSettings } from "@/lib/hooks/use-org-settings";
import { useTranslations } from "next-intl";

interface ExportColumn {
    header: string;
    accessor: string;
    format?: (value: unknown) => string;
}

interface ExportDropdownProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[];
    columns: ExportColumn[];
    filename: string;
    title?: string;
    orgName?: string;
    orgLogo?: string | null;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (value instanceof Date) return value.toLocaleDateString("en-AE");
    return String(value);
}

function getValue(obj: Record<string, unknown>, path: string): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return path.split(".").reduce((acc: any, key) => {
        if (acc && typeof acc === "object") return acc[key];
    }, obj);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportCSV(data: any[], columns: ExportColumn[], filename: string, orgName?: string) {
    const headerRows: string[] = [];
    if (orgName) headerRows.push(`"${orgName}"`);
    headerRows.push(`"Generated: ${new Date().toLocaleDateString("en-AE")} ${new Date().toLocaleTimeString("en-AE")}"`);
    headerRows.push(""); // blank line before data

    const headers = columns.map((c) => `"${c.header}"`).join(",");
    const rows = data.map((row) =>
        columns
            .map((col) => {
                const raw = getValue(row, col.accessor);
                const val = col.format ? col.format(raw) : formatValue(raw);
                return `"${val.replace(/"/g, '""')}"`;
            })
            .join(",")
    );
    const csv = [...headerRows, headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${filename}.csv`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exportExcel(data: any[], columns: ExportColumn[], filename: string, orgName?: string, primaryColor = "#1e3a8a") {
    const XLSX = await import("xlsx");

    const headerRows: (string | null)[][] = [];
    if (orgName) headerRows.push([orgName]);
    headerRows.push([`Generated: ${new Date().toLocaleDateString("en-AE")} ${new Date().toLocaleTimeString("en-AE")}`]);
    headerRows.push([]); // blank row

    const worksheetData = [
        ...headerRows,
        columns.map((c) => c.header),
        ...data.map((row) =>
            columns.map((col) => {
                const raw = getValue(row, col.accessor);
                return col.format ? col.format(raw) : formatValue(raw);
            })
        ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Style the column header row
    const headerRowIdx = headerRows.length; // 0-based index of the column header row
    const colorHex = primaryColor.replace("#", "").toUpperCase().padEnd(6, "0");
    const headerStyle = {
        fill: { patternType: "solid", fgColor: { rgb: colorHex } },
        font: { bold: true, color: { rgb: "FFFFFFFF" } },
    };
    columns.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: colIndex });
        if (ws[cellRef]) ws[cellRef].s = headerStyle;
    });

    // Auto-fit column widths
    ws["!cols"] = columns.map((col) => {
        const maxLen = Math.max(
            col.header.length,
            ...data.map((row) => {
                const raw = getValue(row, col.accessor);
                return (col.format ? col.format(raw) : formatValue(raw)).length;
            })
        );
        return { wch: Math.min(maxLen + 2, 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

async function exportPDF(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[],
    columns: ExportColumn[],
    filename: string,
    title?: string,
    orgName?: string,
    orgLogo?: string | null,
) {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });

    // Header
    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorY = 14;

    // Organization logo
    if (orgLogo) {
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = orgLogo;
            });
            const logoH = 12;
            const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
            doc.addImage(img, "PNG", 14, cursorY - 4, logoW, logoH);
        } catch {
            // logo failed to load — skip it
        }
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title || filename, pageWidth / 2, cursorY + 4, { align: "center" });
    cursorY += 10;

    if (orgName) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(orgName, pageWidth / 2, cursorY, { align: "center" });
        cursorY += 6;
    }

    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-AE")} ${new Date().toLocaleTimeString("en-AE")}`, pageWidth / 2, cursorY, { align: "center" });
    doc.setTextColor(0);
    cursorY += 6;

    const tableData = data.map((row) =>
        columns.map((col) => {
            const raw = getValue(row, col.accessor);
            return col.format ? col.format(raw) : formatValue(raw);
        })
    );

    autoTable(doc, {
        head: [columns.map((c) => c.header)],
        body: tableData,
        startY: cursorY,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didDrawPage: (data: { pageNumber: number }) => {
            // Footer
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.text(
                `Page ${data.pageNumber}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: "center" }
            );
            if (orgName) {
                doc.text(orgName, 14, pageHeight - 10);
            }
            doc.text("myinvoice.ae", pageWidth - 14, pageHeight - 10, { align: "right" });
        },
    });

    doc.save(`${filename}.pdf`);
}

export function ExportDropdown({ data, columns, filename, title, orgName: orgNameProp, orgLogo: orgLogoProp }: ExportDropdownProps) {
    const [exporting, setExporting] = useState(false);
    const t = useTranslations("common");
    const tenant = useTenant();
    const orgSettings = useOrgSettings();
    const orgName = orgNameProp ?? tenant.organizationName ?? undefined;
    const orgLogo = orgLogoProp ?? tenant.organizationLogo ?? undefined;
    const primaryColor = orgSettings.primaryColor ?? "#1e3a8a";

    const handleExport = async (type: "csv" | "excel" | "pdf") => {
        if (data.length === 0) return;
        setExporting(true);
        try {
            switch (type) {
                case "csv":
                    exportCSV(data, columns, filename, orgName);
                    break;
                case "excel":
                    await exportExcel(data, columns, filename, orgName, primaryColor);
                    break;
                case "pdf":
                    await exportPDF(data, columns, filename, title, orgName, orgLogo);
                    break;
            }
        } finally {
            setExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting || data.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    {t("export")}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                    <File className="mr-2 h-4 w-4" />
                    CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
