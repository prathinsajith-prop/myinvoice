"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

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
  role: string | null;
  organizations: Organization[];
  isLoading: boolean;
  switchOrganization: (organizationId: string) => Promise<void>;
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
        // Update the session with new organization
        await update({ organizationId });
      } finally {
        setIsSwitching(false);
      }
    },
    [session, update]
  );

  const currentOrg = session?.user.organizations?.find(
    (org) => org.id === session?.user.organizationId
  );

  const value: TenantContextType = {
    organizationId: session?.user.organizationId ?? null,
    organizationSlug: session?.user.organizationSlug ?? null,
    organizationName: currentOrg?.name ?? null,
    role: session?.user.role ?? null,
    organizations: session?.user.organizations ?? [],
    isLoading: status === "loading" || isSwitching,
    switchOrganization,
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

/**
 * Hook to check if user has specific role or higher
 */
export function useHasRole(requiredRole: string) {
  const { role } = useTenant();
  
  const roleHierarchy: Record<string, number> = {
    VIEWER: 1,
    MEMBER: 2,
    ACCOUNTANT: 3,
    ADMIN: 4,
    OWNER: 5,
  };

  if (!role) return false;
  
  return (roleHierarchy[role] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

/**
 * Hook to check if user can perform specific actions
 */
export function usePermissions() {
  const { role } = useTenant();

  return {
    canView: !!role,
    canCreate: ["MEMBER", "ACCOUNTANT", "ADMIN", "OWNER"].includes(role ?? ""),
    canEdit: ["ACCOUNTANT", "ADMIN", "OWNER"].includes(role ?? ""),
    canDelete: ["ADMIN", "OWNER"].includes(role ?? ""),
    canManageTeam: ["ADMIN", "OWNER"].includes(role ?? ""),
    canManageOrg: role === "OWNER",
    canManageBilling: role === "OWNER",
  };
}
