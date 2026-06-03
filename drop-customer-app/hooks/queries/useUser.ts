import { ROUTES } from '@/API/routes/ApiRoutes';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useUserDetails() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    return useQuery({
        queryKey: ['user', 'details'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error("No token found");
            const res = await fetch(`${ROUTES.GET_USER_DETAILS}?t=${Date.now()}`, {
                method: "GET",
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });
            if (!res.ok) throw new Error("Network error");
            return res.json();
        },
        enabled: isLoaded && isSignedIn,
        retry: 2
    });
}

export function useUpdateLocation() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (coords: { lat: number; lng: number }) => {
            const token = await getToken();
            const res = await fetch(ROUTES.UPDATE_LOCATION, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(coords)
            });
            if (!res.ok) throw new Error("Location update failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
        }
    });
}

export function useUpdateProfilePic() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (profile_pic: string) => {
            const token = await getToken();
            const res = await fetch(ROUTES.UPDATE_PROFILE_PIC, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ profile_pic })
            });
            if (!res.ok) throw new Error("Profile pic update failed");
            return res.json();
        },
        onMutate: async (newProfilePic) => {
            await queryClient.cancelQueries({ queryKey: ['user', 'details'] });
            const previousUser = queryClient.getQueryData(['user', 'details']);
            queryClient.setQueryData(['user', 'details'], (old: any) => {
                if (!old) return old;
                return { ...old, profile_pic: newProfilePic };
            });
            return { previousUser };
        },
        onError: (err, newProfilePic, context) => {
            if (context?.previousUser) {
                queryClient.setQueryData(['user', 'details'], context.previousUser);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
        }
    });
}

export function useCreateUser() {
    const { getToken } = useAuth();
    return useMutation({
        mutationFn: async (userData: any) => {
            const token = await getToken();
            const res = await fetch(ROUTES.CREATE_USER, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            if (!res.ok) throw new Error("User creation failed");
            return res.json();
        }
    });
}

export function useUpdateUser() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (userData: { full_name?: string; phone_number?: string | null; preferences?: any; payment_methods?: any[]; floor_level?: number; has_elevator?: boolean }) => {
            const token = await getToken();
            const res = await fetch(ROUTES.UPDATE_USER, {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "User update failed");
            }
            return res.json();
        },
        onMutate: async (newUserData) => {
            await queryClient.cancelQueries({ queryKey: ['user', 'details'] });
            const previousUser = queryClient.getQueryData(['user', 'details']);
            queryClient.setQueryData(['user', 'details'], (old: any) => {
                if (!old) return old;
                return { ...old, ...newUserData };
            });
            return { previousUser };
        },
        onError: (err, newUserData, context) => {
            if (context?.previousUser) {
                queryClient.setQueryData(['user', 'details'], context.previousUser);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
        }
    });
}
