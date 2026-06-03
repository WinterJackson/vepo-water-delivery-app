import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';

export function useAllVendors() {
    return useQuery({
        queryKey: ['vendors', 'all'],
        queryFn: async () => {
            const res = await fetch(ROUTES.GET_VENDORS, { method: "GET" });
            if (!res.ok) throw new Error("Network error");
            const json = await res.json();
            return json.data || json;
        },
        staleTime: 5 * 60 * 1000
    });
}

export function useNearByVendors() {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['vendors', 'nearby'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) return [];
            const res = await fetch(ROUTES.GET_NEARBY_VENDORS, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Network error");
            const json = await res.json();
            return json.data || json;
        },
        staleTime: 5 * 60 * 1000,
        retry: 3
    });
}

export function useTopRatedVendors() {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['vendors', 'topRated'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) return [];
            const res = await fetch(ROUTES.GET_TOP_RATED_VENDORS, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Network error");
            const json = await res.json();
            return json.data || json;
        },
        staleTime: 5 * 60 * 1000,
        retry: 3
    });
}

export function useVendorsByType(type: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['vendors', 'type', type],
        queryFn: async () => {
            const token = await getToken();
            if (!token) return [];
            const res = await fetch(ROUTES.GET_VENDORS_BY_TYPE, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ vendor_type: type })
            });
            if (!res.ok) throw new Error("Network error");
            const json = await res.json();
            return json.data || json;
        },
        enabled: !!type,
        staleTime: 5 * 60 * 1000
    });
}

export function useTopBrandsVendors() {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['vendors', 'topBrands'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) return [];
            const res = await fetch(ROUTES.GET_TOP_BRAND_VENDORS, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Network error");
            const json = await res.json();
            return json.data || json;
        },
        staleTime: 5 * 60 * 1000
    });
}
export function useVendorDirectory() {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['vendors', 'directory'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) return [];
            const res = await fetch(`${ROUTES.GET_VENDORS}/directory`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Network error");
            const json = await res.json();
            return json.data || json;
        },
        staleTime: 5 * 60 * 1000,
        retry: 3
    });
}
