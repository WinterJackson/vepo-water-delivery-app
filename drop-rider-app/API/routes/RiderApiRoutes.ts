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
  AcceptOrderRadar: (orderId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/trip-radar/${orderId}/accept`,
    method: "POST",
  }),
  // --- Earnings ---
  GetEarnings: {
    path: `${BASE_URL}/api/rider/earnings`,
    method: "GET",
  } as const satisfies ApiRoute,
  GetReviews: {
    path: `${BASE_URL}/api/rider/reviews`,
    method: "GET",
  } as const satisfies ApiRoute,
  // --- Payouts ---
  RequestPayout: {
    path: `${BASE_URL}/api/payouts/request`,
    method: "POST",
  } as const satisfies ApiRoute,
  GetPayouts: {
    path: `${BASE_URL}/api/payouts`,
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
    path: `${BASE_URL}/api/notifications/read`,
    method: "POST",
  } as const satisfies ApiRoute,
  MarkAllNotificationsRead: {
    path: `${BASE_URL}/api/notifications/read-all`,
    method: "POST",
  } as const satisfies ApiRoute,
  DeleteNotification: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/notifications/${id}`,
    method: "DELETE",
  }),
  // --- Order Actions ---
  RejectDelivery: (orderId: string): ApiRoute => ({
    path: `${BASE_URL}/api/rider/orders/${orderId}/reject`,
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
  // --- Vendor Remittance ---
  GetMyRemittances: (delivererId: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor_remittance/rider/${delivererId}`,
    method: "GET",
  }),
  CloseRemittance: (remittanceId: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor_remittance/${remittanceId}/close`,
    method: "POST",
  }),
  // --- Vendor Registry ---
  DiscoverVendors: (lat: number, lng: number): ApiRoute => ({
    path: `${BASE_URL}/api/rider/discover-vendors?lat=${lat}&lng=${lng}`,
    method: "GET",
  }),
  RegisteredVendors: {
    path: `${BASE_URL}/api/rider/registered-vendors`,
    method: "GET",
  } as const satisfies ApiRoute,
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
