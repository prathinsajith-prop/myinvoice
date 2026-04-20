import { describe, it, expect } from 'vitest';
import { hasRole, hasPermission, getPermissions, type MemberRole } from '@/lib/rbac';

describe('RBAC System', () => {
    describe('hasRole', () => {
        it('should return true for exact role match', () => {
            expect(hasRole('OWNER', 'OWNER')).toBe(true);
            expect(hasRole('ADMIN', 'ADMIN')).toBe(true);
        });

        it('should return true for higher hierarchy', () => {
            expect(hasRole('OWNER', 'MEMBER')).toBe(true); // Owner > Member
            expect(hasRole('ADMIN', 'MEMBER')).toBe(true); // Admin > Member
        });

        it('should return false for lower hierarchy', () => {
            expect(hasRole('MEMBER', 'OWNER')).toBe(false);
            expect(hasRole('MEMBER', 'ADMIN')).toBe(false);
        });
    });

    describe('hasPermission', () => {
        it('should grant view permission to all roles', () => {
            (['MEMBER', 'ACCOUNTANT', 'MANAGER', 'ADMIN', 'OWNER'] as MemberRole[]).forEach(role => {
                expect(hasPermission(role, 'view')).toBe(true);
            });
        });

        it('should grant create to MEMBER and above', () => {
            expect(hasPermission('MEMBER', 'create')).toBe(true);
            expect(hasPermission('MEMBER', 'create')).toBe(true);
            expect(hasPermission('ADMIN', 'create')).toBe(true);
        });

        it('should grant delete only to ADMIN and OWNER', () => {
            expect(hasPermission('ACCOUNTANT', 'delete')).toBe(false);
            expect(hasPermission('ADMIN', 'delete')).toBe(true);
            expect(hasPermission('OWNER', 'delete')).toBe(true);
        });

        it('should grant manage_org only to OWNER', () => {
            expect(hasPermission('ADMIN', 'manage_org')).toBe(false);
            expect(hasPermission('OWNER', 'manage_org')).toBe(true);
        });
    });

    describe('getPermissions', () => {
        it('should return member permissions for MEMBER role', () => {
            const perms = getPermissions('MEMBER');
            expect(perms.view).toBe(true);
            expect(perms.create).toBe(true);
            expect(perms.delete).toBe(false);
        });

        it('should return cumulative permissions for higher roles', () => {
            const adminPerms = getPermissions('ADMIN');
            expect(adminPerms.view).toBe(true);
            expect(adminPerms.create).toBe(true);
            expect(adminPerms.edit).toBe(true);
            expect(adminPerms.delete).toBe(true);
            expect(adminPerms.manage_team).toBe(true);
            expect(adminPerms.manage_org).toBe(false); // Only OWNER
        });

        it('should return all permissions for OWNER', () => {
            const ownerPerms = getPermissions('OWNER');
            expect(ownerPerms.view).toBe(true);
            expect(ownerPerms.create).toBe(true);
            expect(ownerPerms.edit).toBe(true);
            expect(ownerPerms.delete).toBe(true);
            expect(ownerPerms.manage_team).toBe(true);
            expect(ownerPerms.manage_org).toBe(true);
            expect(ownerPerms.manage_billing).toBe(true);
            expect(ownerPerms.invite_admin).toBe(true);
            expect(ownerPerms.export).toBe(true);
        });
    });
});
