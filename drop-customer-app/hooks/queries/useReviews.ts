import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from '@tanstack/react-query';

export function useSubmitReview() {
    const { getToken } = useAuth();
    return useMutation({
        mutationFn: async (reviewData: { order_id: string; target_type: string; target_id: string; rating: number; comment?: string }) => {
            const token = await getToken();
            const res = await fetch(ROUTES.SUBMIT_REVIEW, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(reviewData)
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Submit review failed");
            }
            return res.json();
        }
    });
}

export function useTargetReviews(targetType: string, targetId: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ["reviews", targetType, targetId],
        queryFn: async () => {
            const token = await getToken();
            const res = await fetch(ROUTES.TARGET_REVIEWS(targetType, targetId), {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch reviews");
            return res.json();
        },
        enabled: !!targetType && !!targetId
    });
}
