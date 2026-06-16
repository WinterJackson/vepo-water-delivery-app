import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { ROUTES } from "@/API/routes/ApiRoutes";

import { useInfiniteQuery } from "@tanstack/react-query";

export const useWalletTransactions = (limit = 50, offset = 0) => {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["walletTransactions", limit, offset],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const res = await fetch(`${ROUTES.GET_TRANSACTIONS}?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch transactions");
      }

      return res.json();
    },
  });
};

export const useWalletTransactionsPaginated = (search: string, type: string, limit = 20) => {
  const { getToken } = useAuth();

  return useInfiniteQuery({
    queryKey: ["walletTransactions", search, type, limit],
    queryFn: async ({ pageParam = 0 }) => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      let url = `${ROUTES.GET_TRANSACTIONS}?limit=${limit}&offset=${pageParam}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (type && type !== "All") url += `&type=${encodeURIComponent(type)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch transactions");
      }

      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    initialPageParam: 0,
  });
};

export const useWalletWithdraw = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, phoneNumber, userType }: { amount: number, phoneNumber: string, userType: string }) => {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const res = await fetch(ROUTES.WALLET_WITHDRAW, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, phone_number: phoneNumber, user_type: userType }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Withdrawal failed");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });
};
