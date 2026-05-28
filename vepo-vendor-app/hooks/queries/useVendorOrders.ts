import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { useAuth } from "@clerk/clerk-expo";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useVendorOrdersPaginated(searchQuery: string = "", statusFilter: string = "All", limit: number = 20) {
    const { getToken } = useAuth();

    return useInfiniteQuery({
        queryKey: ["vendorOrdersPaginated", searchQuery, statusFilter, limit],
        queryFn: async ({ pageParam = 0 }) => {
            const token = await getToken();
            if (!token) throw new Error("No token found");

            const queryParams = new URLSearchParams({
                limit: limit.toString(),
                skip: pageParam.toString(),
            });

            if (searchQuery.trim().length > 1) {
                queryParams.append("search_query", searchQuery.trim());
            }

            if (statusFilter !== "All") {
                queryParams.append("status_filter", statusFilter);
            }

            const url = `${VendorApiRoutes.GetOrders.path}?${queryParams.toString()}`;

            const response = await fetch(url, {
                method: VendorApiRoutes.GetOrders.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch orders");
            }

            const data = await response.json();
            return data.pages?.[0] || [];
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < limit) return undefined;
            return allPages.flat().length;
        },
    });
}

export function useVendorOrders() {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ["vendorOrders"],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error("No token found");

            const response = await fetch(`${VendorApiRoutes.GetOrders.path}?t=${Date.now()}`, {
                method: VendorApiRoutes.GetOrders.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch orders");
            }

            const data = await response.json();
            
            // Because the backend now returns {"pages": [orders]} if we don't pass skip/limit properly, 
            // wait, we changed the backend /orders route to return {"pages": [orders]}! 
            // So if `data.pages` exists, we should return that, otherwise `data`.
            if (data && data.pages && Array.isArray(data.pages)) {
                 return data.pages[0] || [];
            }
            return Array.isArray(data) ? data : [];
        },
    });
}

export function useUpdateOrderStatus() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
            const token = await getToken();
            const route = VendorApiRoutes.UpdateOrderStatus(orderId);
            const response = await fetch(route.path, {
                method: route.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) {
                throw new Error("Failed to update status");
            }
            return response.json();
        },
        onMutate: async ({ orderId, status }) => {
            await queryClient.cancelQueries({ queryKey: ["vendorOrders"] });
            const previousOrders = queryClient.getQueryData(["vendorOrders"]);

            // Optimistically update
            queryClient.setQueryData(["vendorOrders"], (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.map((order: any) =>
                    order.id === orderId ? { ...order, order_status: status } : order
                );
            });

            return { previousOrders };
        },
        onError: (err, variables, context: any) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(["vendorOrders"], context.previousOrders);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
        },
    });
}
