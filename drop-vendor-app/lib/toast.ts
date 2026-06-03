import { useToastStore } from '@/stores/toastStore';

/**
 * Global Toast utility.
 * All inputs are sanitized in the store — safe to pass raw API errors.
 */
export const Toast = {
    success: (text1: any, text2?: any) => {
        useToastStore.getState().showToast('success', text1, text2);
    },
    error: (text1: any, text2?: any) => {
        useToastStore.getState().showToast('error', text1, text2);
    },
    info: (text1: any, text2?: any) => {
        useToastStore.getState().showToast('info', text1, text2);
    },
};
