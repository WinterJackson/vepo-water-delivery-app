/** F-019 FIX: Converted from JS to TypeScript with proper types */

interface ApiRoute {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
}

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? "";

const RiderApiRoutes = {
  // --- Auth ---
  Register: {
    path: `${BASE_URL}/api/auth/create_rider`,
    method: "POST",
  } as const satisfies ApiRoute,
  // --- Profile ---
  GetProfile: {
    path: `${BASE_URL}/api/rider/profile`,
    method: "GET",
  } as const satisfies ApiRoute,
  UpdateProfile: {
    path: `${BASE_URL}/api/rider/profile`,
    method: "PUT",
  } as const satisfies ApiRoute,
  // --- Location ---
  UpdateLocation: {
    path: `${BASE_URL}/api/rider/location`,
    method: "PUT",
  } as const satisfies ApiRoute,
  // --- Availability ---
  ToggleAvailability: {
    path: `${BASE_URL}/api/rider/availability`,
    method: "PUT",
  } as const satisfies ApiRoute,
  // --- Orders ---
  GetOrders: (status?: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders${status ? `?status=${status}` : ''}`,
    method: "GET",
  }),
  UpdateDeliveryStatus: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders/${id}/status`,
    method: "PUT",
  }),
  TripRadar: {
    path: `${BASE_URL}/api/rider/trip-radar`,
    method: "GET",
  } as const satisfies ApiRoute,
  // --- Earnings ---
  GetEarnings: {
    path: `${BASE_URL}/api/rider/earnings`,
    method: "GET",
  } as const satisfies ApiRoute,
  GetReviews: {
    path: `${BASE_URL}/api/rider/reviews`,
    method: "GET",
  } as const satisfies ApiRoute,
  // --- Wallet ---
  WalletTopUp: {
    path: `${BASE_URL}/api/wallet/top-up`,
    method: "POST",
  } as const satisfies ApiRoute,
  WalletWithdraw: {
    path: `${BASE_URL}/api/wallet/withdraw`,
    method: "POST",
  } as const satisfies ApiRoute,
  GetTransactions: {
    path: `${BASE_URL}/api/wallet/transactions`,
    method: "GET",
  } as const satisfies ApiRoute,
  // --- Notifications ---
  GetNotifications: {
    path: `${BASE_URL}/api/notifications?user_type=rider`,
    method: "GET",
  } as const satisfies ApiRoute,
  GetUnreadNotificationCount: {
    path: `${BASE_URL}/api/notifications/unread-count?user_type=rider`,
    method: "GET",
  } as const satisfies ApiRoute,
  MarkNotificationRead: {
    path: `${BASE_URL}/api/notifications/read?user_type=rider`,
    method: "POST",
  } as const satisfies ApiRoute,
  MarkAllNotificationsRead: {
    path: `${BASE_URL}/api/notifications/read-all?user_type=rider`,
    method: "POST",
  } as const satisfies ApiRoute,
  DeleteNotification: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/notifications/${id}?user_type=rider`,
    method: "DELETE",
  }),
  // --- Order Actions ---
  RejectDelivery: (orderId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders/${orderId}/reject`,
    method: "PUT",
  }),
  CancelOrder: (orderId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders/${orderId}/cancel`,
    method: "PUT",
  }),
  ReportMismatch: (orderId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders/${orderId}/mismatch`,
    method: "POST",
  }),
  ReportBottleRejection: (orderId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders/${orderId}/bottle-rejection`,
    method: "POST",
  }),
  AcceptDelivery: (orderId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders/${orderId}/accept`,
    method: "POST",
  }),
  // --- Vendor Registry ---
  DiscoverVendors: (lat: number, lng: number, searchQuery: string = ""): ApiRoute => {
    const params = new URLSearchParams();
    params.append('lat', lat.toString());
    params.append('lng', lng.toString());
    if (searchQuery) params.append('search_query', searchQuery);
    
    return {
      path: `${BASE_URL}/api/rider/discover-vendors?${params.toString()}`,
      method: "GET",
    };
  },
  RegisteredVendors: (searchQuery: string = ""): ApiRoute => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search_query', searchQuery);
    
    return {
      path: `${BASE_URL}/api/rider/registered-vendors${searchQuery ? '?' + params.toString() : ''}`,
      method: "GET",
    };
  },
  WithdrawApplication: (vendorId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/vendor-application/${vendorId}`,
    method: "DELETE",
  }),
  ApplyVendor: {
    path: `${BASE_URL}/api/rider/apply-vendor`,
    method: "POST",
  } as const satisfies ApiRoute,
  // --- Account ---
  DeleteAccount: {
    path: `${BASE_URL}/api/auth/delete_account`,
    method: "DELETE",
  } as const satisfies ApiRoute,
};

export default RiderApiRoutes;
