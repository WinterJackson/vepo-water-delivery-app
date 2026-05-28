import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';

export function useSearchProducts(query: string, category: string = 'all', limit: number = 20, mode: string | null = null) {
    const { getToken } = useAuth();
    const { location } = useLocation();

    return useInfiniteQuery({
        queryKey: ['search', 'products', query, category, limit, mode, location?.coords.latitude, location?.coords.longitude],
        queryFn: async ({ pageParam = 0 }) => {
            const token = await getToken();
            const params = new URLSearchParams();
            if (query.trim().length > 1) params.set('query', query.trim());
            if (category !== 'all') params.set('category', category);
            if (mode) params.set('mode', mode);
            if (location?.coords) {
                params.set('user_lat', String(location.coords.latitude));
                params.set('user_lng', String(location.coords.longitude));
            }
            params.set('limit', String(limit));
            params.set('offset', String(pageParam));
            const res = await fetch(`${ROUTES.SEARCH}?${params.toString()}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Search failed");
            return res.json();
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < limit) return undefined;
            return allPages.length * limit;
        },
        enabled: query.trim().length > 1 || category !== 'all' || !!mode,
        staleTime: 30000,
    });
}

export function useSearchVendors(query: string, limit: number = 20) {
    const { getToken } = useAuth();
    const { location } = useLocation();

    return useInfiniteQuery({
        queryKey: ['search', 'vendors', query, limit, location?.coords.latitude, location?.coords.longitude],
        queryFn: async ({ pageParam = 0 }) => {
            const token = await getToken();
            const params = new URLSearchParams();
            if (query.trim().length > 1) params.set('query', query.trim());
            if (location?.coords) {
                params.set('user_lat', String(location.coords.latitude));
                params.set('user_lng', String(location.coords.longitude));
            }
            params.set('limit', String(limit));
            params.set('offset', String(pageParam));

            const res = await fetch(`${ROUTES.SEARCH_VENDORS}?${params.toString()}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Vendor search failed");
            return res.json();
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < limit) return undefined;
            return allPages.length * limit;
        },
        enabled: true,
        staleTime: 30000,
    });
}
