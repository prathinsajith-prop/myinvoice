/**
 * Role-Based Access Control (RBAC)
 * Central source of truth for role hierarchy and permissions
 */

export type MemberRole = "OWNER" | "ADMIN" | "ACCOUNTANT" | "MEMBER" | "VIEWER";

export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ACCOUNTANT: 3,
  ADMIN: 4,
  OWNER: 5,
};

export function hasRole(userRole: MemberRole, requiredRole: MemberRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

export type Permission =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "manage_team"
  | "manage_org"
  | "manage_billing"
  | "export"
  | "invite_admin";

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  VIEWER: ["view"],
  MEMBER: ["view", "create"],
  ACCOUNTANT: ["view", "create", "edit", "export"],
  ADMIN: ["view", "create", "edit", "delete", "manage_team", "export"],
  OWNER: [
    "view",
    "create",
    "edit",
    "delete",
    "manage_team",
    "manage_org",
    "manage_billing",
    "export",
    "invite_admin",
  ],
};

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: MemberRole): Record<Permission, boolean> {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return {
    view: permissions.includes("view"),
    create: permissions.includes("create"),
    edit: permissions.includes("edit"),
    delete: permissions.includes("delete"),
    manage_team: permissions.includes("manage_team"),
    manage_org: permissions.includes("manage_org"),
    manage_billing: permissions.includes("manage_billing"),
    export: permissions.includes("export"),
    invite_admin: permissions.includes("invite_admin"),
  };
}
