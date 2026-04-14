import { create } from "zustand";
import { persist } from "zustand/middleware";


interface AuthState {
    // Loading states
    isSigningIn: boolean;
    isSigningOut: boolean;
    isRegistering: boolean;

    // Error state
    authError: string | null;

    // Current org (mirrors what's in the session but accessible without useSession)
    currentOrganizationId: string | null;

    // Actions
    setSigningIn: (v: boolean) => void;
    setSigningOut: (v: boolean) => void;
    setRegistering: (v: boolean) => void;
    setAuthError: (error: string | null) => void;
    setCurrentOrganization: (id: string | null) => void;
    clearAuthError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            isSigningIn: false,
            isSigningOut: false,
            isRegistering: false,
            authError: null,
            currentOrganizationId: null,

            setSigningIn: (v) => set({ isSigningIn: v }),
            setSigningOut: (v) => set({ isSigningOut: v }),
            setRegistering: (v) => set({ isRegistering: v }),
            setAuthError: (error) => set({ authError: error }),
            setCurrentOrganization: (id) => set({ currentOrganizationId: id }),
            clearAuthError: () => set({ authError: null }),
        }),
        {
            name: "auth-store",
            partialize: (state) => ({
                currentOrganizationId: state.currentOrganizationId,
            }),
        }
    )
);
