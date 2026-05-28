import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";

export function useVendorProducts(searchQuery: string = "", stockFilter: string = "All", limit: number = 20) {
	const { getToken } = useAuth();

	return useInfiniteQuery({
		queryKey: ["vendorProducts", searchQuery, stockFilter, limit],
		queryFn: async ({ pageParam = 0 }) => {
			const token = await getToken();
			if (!token) throw new Error("No token found");

            const queryParams = new URLSearchParams({
                limit: limit.toString(),
                offset: pageParam.toString(),
            });

            if (searchQuery.trim().length > 1) {
                queryParams.append("search_query", searchQuery.trim());
            }

            if (stockFilter !== "All") {
                queryParams.append("stock_filter", stockFilter);
            }

            const url = `${VendorApiRoutes.GetProducts.path}?${queryParams.toString()}`;

			const response = await fetch(url, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new Error("Network response was not ok");
			}

			const data = await response.json();
			return data.pages?.[0] || [];
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			// If the last page has fewer items than the limit, we've reached the end
			if (!lastPage || lastPage.length < limit) return undefined;
			
			// Otherwise, offset is the total number of items loaded so far
			return allPages.flat().length;
		},
	});
}
