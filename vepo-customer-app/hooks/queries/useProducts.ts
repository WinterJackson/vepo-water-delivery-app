import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Product {
    id: string;
    vendor_id: string;
    name: string;
    description: string | null;
    price: number;
    discount: number;
    image_url: string;
    capacity: number;
    weight_kg: number;
    minimum_order_qty: number;
    unit: string | null;
    stock: number;
    stock_quantity: number; // computed alias of stock from backend
    is_available: boolean;
    category?: string | null;
    vendor?: {
        id: string;
        business_name: string;
        location_address?: string;
        lat?: number;
        lng?: number;
        delivery_radius?: number;
        rating?: number;
        profile_pic?: string;
    };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useProduct(productId: string) {
    const { getToken } = useAuth();
    return useQuery<Product, Error>({
        queryKey: ['product', productId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.GET_PRODUCT_DETAILS, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId }),
            });
            if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: !!productId,
    });
}

export function useVendorDetails(vendorId: string) {
    const { getToken } = useAuth();
    return useQuery<any, Error>({
        queryKey: ['vendor', vendorId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.GET_VENDOR_DETAILS, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: vendorId }),
            });
            if (!res.ok) throw new Error(`Vendor fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: !!vendorId,
    });
}

export function useProductsWithOffer() {
    return useQuery({
        queryKey: ['products', 'offers'],
        queryFn: async () => {
            const res = await fetch(ROUTES.GET_PRODUCTS_WITH_OFFER, { method: "GET" });
            if (!res.ok) throw new Error("Offers fetch failed");
            const json = await res.json();
            // The backend returns {"data": [...], "total": ... } for this endpoint
            return json.data || json;
        }
    });
}

export function useCategories() {
    return useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await fetch(ROUTES.GET_CATEGORIES, { method: "GET" });
            if (!res.ok) throw new Error("Categories fetch failed");
            const json = await res.json();
            return json.categories || [];
        }
    });
}

export function usePaginatedProducts(page: number) {
    return useQuery({
        queryKey: ['products', 'paginated', page],
        queryFn: async () => {
            const res = await fetch(ROUTES.GET_PAGINATED_PRODUCTS, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page }),
            });
            if (!res.ok) throw new Error("Paginated products fetch failed");
            return res.json();
        }
    });
}
