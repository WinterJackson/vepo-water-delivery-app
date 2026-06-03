import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';

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
            if (!res.ok) throw new Error("Submit review failed");
            return res.json();
        }
    });
}
