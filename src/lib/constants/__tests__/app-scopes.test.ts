import { describe, it, expect } from "vitest";
import {
    APP_MODULES,
    SCOPE_ACTIONS,
    getAllScopes,
    isScopeAllowed,
    extractModuleFromPath,
} from "@/lib/constants/app-scopes";

describe("App Scopes", () => {
    describe("getAllScopes", () => {
        it("should return 48 scopes (16 modules x 3 actions)", () => {
            const scopes = getAllScopes();
            expect(scopes).toHaveLength(
                APP_MODULES.length * SCOPE_ACTIONS.length,
            );
        });

        it("should contain expected scope format", () => {
            const scopes = getAllScopes();
            expect(scopes).toContain("invoices:read");
            expect(scopes).toContain("invoices:write");
            expect(scopes).toContain("invoices:delete");
            expect(scopes).toContain("customers:read");
            expect(scopes).toContain("products:write");
        });

        it("every scope should match the module:action format", () => {
            const scopes = getAllScopes();
            for (const scope of scopes) {
                expect(scope).toMatch(/^[a-z-]+:(read|write|delete)$/);
            }
        });
    });

    describe("isScopeAllowed", () => {
        it("should allow GET when invoices:read is granted", () => {
            expect(
                isScopeAllowed(["invoices:read"], "invoices", "GET"),
            ).toBe(true);
        });

        it("should allow POST when invoices:write is granted", () => {
            expect(
                isScopeAllowed(["invoices:write"], "invoices", "POST"),
            ).toBe(true);
        });

        it("should allow PUT when invoices:write is granted", () => {
            expect(
                isScopeAllowed(["invoices:write"], "invoices", "PUT"),
            ).toBe(true);
        });

        it("should allow PATCH when invoices:write is granted", () => {
            expect(
                isScopeAllowed(["invoices:write"], "invoices", "PATCH"),
            ).toBe(true);
        });

        it("should allow DELETE when invoices:delete is granted", () => {
            expect(
                isScopeAllowed(["invoices:delete"], "invoices", "DELETE"),
            ).toBe(true);
        });

        it("should deny GET when only write scope is granted", () => {
            expect(
                isScopeAllowed(["invoices:write"], "invoices", "GET"),
            ).toBe(false);
        });

        it("should deny POST when only read scope is granted", () => {
            expect(
                isScopeAllowed(["invoices:read"], "invoices", "POST"),
            ).toBe(false);
        });

        it("should deny access to a different module", () => {
            expect(
                isScopeAllowed(["invoices:read"], "customers", "GET"),
            ).toBe(false);
        });

        it("should handle case-insensitive HTTP methods", () => {
            expect(
                isScopeAllowed(["invoices:read"], "invoices", "get"),
            ).toBe(true);
        });

        it("should check across multiple scopes", () => {
            const scopes = ["invoices:read", "customers:write"];
            expect(isScopeAllowed(scopes, "invoices", "GET")).toBe(true);
            expect(isScopeAllowed(scopes, "customers", "POST")).toBe(true);
            expect(isScopeAllowed(scopes, "invoices", "POST")).toBe(false);
            expect(isScopeAllowed(scopes, "customers", "GET")).toBe(false);
        });

        it("should deny everything when scopes array is empty", () => {
            expect(isScopeAllowed([], "invoices", "GET")).toBe(false);
        });
    });

    describe("extractModuleFromPath", () => {
        it("should extract module from /api/invoices", () => {
            expect(extractModuleFromPath("/api/invoices")).toBe("invoices");
        });

        it("should extract module from /api/invoices/123", () => {
            expect(extractModuleFromPath("/api/invoices/123")).toBe("invoices");
        });

        it("should extract module from /api/credit-notes", () => {
            expect(extractModuleFromPath("/api/credit-notes")).toBe(
                "credit-notes",
            );
        });

        it("should extract module from /api/vat-returns/report", () => {
            expect(extractModuleFromPath("/api/vat-returns/report")).toBe(
                "vat-returns",
            );
        });

        it("should return null for non-API paths", () => {
            expect(extractModuleFromPath("/dashboard")).toBeNull();
        });

        it("should return null for root /api path", () => {
            expect(extractModuleFromPath("/api")).toBeNull();
            expect(extractModuleFromPath("/api/")).toBeNull();
        });
    });
});
