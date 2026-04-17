import { create } from "zustand";

interface UIState {
    // Sidebar
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;

    // Global loading overlay
    globalLoading: boolean;
    setGlobalLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
    sidebarOpen: true,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

    globalLoading: false,
    setGlobalLoading: (loading) => set({ globalLoading: loading }),
}));
