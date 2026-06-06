import { useAuth } from "@clerk/clerk-expo";
import axios from "axios";
import { useMemo } from "react";

/**
 * Centalized Axios HTTP Interceptor Hook
 * Automatically handles JWT injection from Clerk and captures Edge timeouts
 */
export const useApiClient = () => {
    const { getToken, signOut } = useAuth();

    const apiClient = useMemo(() => {
        const client = axios.create({
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
            },
        });

        // Inject Clerk Auth Token strictly onto non-public routes
        client.interceptors.request.use(
            async (config: import("axios").InternalAxiosRequestConfig) => {
                // strict HTTPS enforcement in production
                if (!__DEV__ && config.url?.startsWith("http://")) {
                    return Promise.reject(new Error("Security Exception: Insecure HTTP connection blocked in non-development mode."));
                }
                
                try {
                    const token = await getToken();
                    if (token) {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                    return config;
                } catch (error) {
                    if (__DEV__) console.error("Token interception failed", error);
                    return config;
                }
            },
            (error: import("axios").AxiosError) => {
                return Promise.reject(error);
            }
        );

        // Standardized Error Interceptor
        client.interceptors.response.use(
            (response: import("axios").AxiosResponse) => response,
            async (error: import("axios").AxiosError) => {
                if (error.response?.status === 401) {
                    // Force session wipe upon compromised or expired security JWT
                    if (__DEV__) console.warn("401 Unauthorized captured - signing out client");
                    await signOut();
                }
                if (__DEV__) console.error("API Call Failed:", (error as Error)?.message || error);
                return Promise.reject(error);
            }
        );

        return client;
    }, [getToken, signOut]);

    return apiClient;
};

export default useApiClient;
