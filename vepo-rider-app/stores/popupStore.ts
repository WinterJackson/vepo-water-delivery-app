import { create } from 'zustand';

export interface PopupConfig {
    title: string;
    message: string;
    cancelText?: string;
    confirmText?: string;
    isDestructive?: boolean;
    isAlertOnly?: boolean;
    onCancel?: () => void;
    onConfirm?: () => void;
}

interface PopupState {
    visible: boolean;
    config: PopupConfig | null;
    isLoading: boolean;
}

interface PopupActions {
    show: (config: PopupConfig) => void;
    hide: () => void;
    setLoading: (loading: boolean) => void;
}

export const usePopupStore = create<PopupState & PopupActions>((set) => ({
    visible: false,
    config: null,
    isLoading: false,
    show: (config) => set({ visible: true, config, isLoading: false }),
    hide: () => set({ visible: false, isLoading: false }),
    setLoading: (loading) => set({ isLoading: loading }),
}));
