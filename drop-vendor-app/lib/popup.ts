import { usePopupStore, PopupConfig } from '@/stores/popupStore';

export const Popup = {
    show: (config: PopupConfig) => {
        usePopupStore.getState().show(config);
    },
    hide: () => {
        usePopupStore.getState().hide();
    },
    setLoading: (loading: boolean) => {
        usePopupStore.getState().setLoading(loading);
    }
};
