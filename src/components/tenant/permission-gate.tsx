"use client";

import { useTenant } from "@/lib/tenant/context";
import type { Permission } from "@/lib/rbac";
import type { ReactNode } from "react";

interface PermissionGateProps {
  /** Show children only if user has this permission */
  permission?: Permission;
  /** Show children only if user has this role or higher */
  role?: "MEMBER" | "ACCOUNTANT" | "MANAGER" | "ADMIN" | "OWNER";
  /** Rendered when the user lacks permission (optional) */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the current user's role/permissions.
 *
 * Usage:
 *   <PermissionGate permission="delete">
 *     <DeleteButton />
 *   </PermissionGate>
 *
 *   <PermissionGate role="ADMIN" fallback={<p>Admins only</p>}>
 *     <AdminPanel />
 *   </PermissionGate>
 */
export function PermissionGate({
  permission,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const tenant = useTenant();

  const permitted =
    (permission ? tenant.hasPermission(permission) : true) &&
    (role ? tenant.hasRole(role) : true);

  return permitted ? <>{children}</> : <>{fallback}</>;
}
