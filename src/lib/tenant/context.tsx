"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import {
  getPermissions,
  hasRole,
  type MemberRole,
  type Permission,
} from "@/lib/rbac";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface TenantContextType {
  organizationId: string | null;
  organizationSlug: string | null;
  organizationName: string | null;
  organizationLogo: string | null;
  role: MemberRole | null;
  organizations: Organization[];
  isLoading: boolean;
  /** Switch the active organization and refresh the session. */
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Check whether the current user holds at least `requiredRole`. */
  hasRole: (requiredRole: MemberRole) => boolean;
  /** Check whether the current user has a specific permission. */
  hasPermission: (permission: Permission) => boolean;
  /** Pre-computed permission map for the current role. */
  permissions: ReturnType<typeof getPermissions> | null;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const [isSwitching, setIsSwitching] = useState(false);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      if (!session) return;
      setIsSwitching(true);
      try {
        // Client-side update sends POST to /api/auth/session
        // The JWT callback handles trigger="update" and updates the token
        // The browser processes the Set-Cookie header from the response
        await update({ organizationId });
      } finally {
        setIsSwitching(false);
      }
    },
    [session, update]
  );

  const role = (session?.user.role ?? null) as MemberRole | null;
  const permissions = role ? getPermissions(role) : null;

  const currentOrg = session?.user.organizations?.find(
    (org) => org.id === session?.user.organizationId
  );

  const value: TenantContextType = {
    organizationId: session?.user.organizationId ?? null,
    organizationSlug: session?.user.organizationSlug ?? null,
    organizationName: currentOrg?.name ?? null,
    organizationLogo: session?.user.organizationLogo ?? null,
    role,
    organizations: session?.user.organizations ?? [],
    isLoading: status === "loading" || isSwitching,
    switchOrganization,
    hasRole: (requiredRole) => (role ? hasRole(role, requiredRole) : false),
    hasPermission: (permission) => permissions?.[permission] ?? false,
    permissions,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

/** Convenience hook — returns the current user's permission map. */
export function usePermissions() {
  const { permissions, role } = useTenant();
  return {
    permissions,
    role,
    can: (permission: Permission) => permissions?.[permission] ?? false,
  };
}
