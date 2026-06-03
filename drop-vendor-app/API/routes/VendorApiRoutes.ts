/** F-019 FIX: Converted from JS to TypeScript with proper types */

interface ApiRoute {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
}

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? "";

const VendorApiRoutes = {
  // --- Auth ---
  Register: {
    path: `${BASE_URL}/api/auth/create_vendor`,
    method: "POST",
  } as const satisfies ApiRoute,
  // --- Stores ---
  GetStores: {
    path: `${BASE_URL}/api/vendor/stores`,
    method: "GET",
  } as const satisfies ApiRoute,
  // --- Profile ---
  GetProfile: {
    path: `${BASE_URL}/api/vendor/profile`,
    method: "GET",
  } as const satisfies ApiRoute,
  UpdateProfile: {
    path: `${BASE_URL}/api/vendor/profile`,
    method: "PUT",
  } as const satisfies ApiRoute,
  // --- Products ---
  GetProducts: {
    path: `${BASE_URL}/api/vendor/products`,
    method: "GET",
  } as const satisfies ApiRoute,
  CreateProduct: {
    path: `${BASE_URL}/api/vendor/products`,
    method: "POST",
  } as const satisfies ApiRoute,
  UpdateProduct: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor/products/${id}`,
    method: "PUT",
  }),
  DeleteProduct: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor/products/${id}`,
    method: "DELETE",
  }),
  // --- Orders ---
  GetOrders: {
    path: `${BASE_URL}/api/vendor/orders`,
    method: "GET",
  } as const satisfies ApiRoute,
  UpdateOrderStatus: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor/orders/${id}/status`,
    method: "PUT",
  }),
  CancelOrder: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor/orders/${id}/cancel`,
    method: "PUT",
  }),
  AssignRider: (id: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor/orders/${id}/assign-rider`,
    method: "PUT",
  }),
  // --- Dashboard ---
  GetDashboard: {
    path: `${BASE_URL}/api/vendor/dashboard`,
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
    path: `${BASE_URL}/api/notifications?user_type=vendor`,
    method: "GET",
  } as const satisfies ApiRoute,
  GetUnreadNotificationCount: {
    path: `${BASE_URL}/api/notifications/unread-count?user_type=vendor`,
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
  // --- Vendor Remittance ---
  GetVendorRemittances: (vendorId: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor_remittance/vendor/${vendorId}`,
    method: "GET",
  }),
  StartRemittance: {
    path: `${BASE_URL}/api/vendor_remittance/start`,
    method: "POST",
  } as const satisfies ApiRoute,
  CloseRemittance: (remittanceId: string): ApiRoute => ({
    path: `${BASE_URL}/api/vendor_remittance/${remittanceId}/close`,
    method: "PUT",
  }),
  // --- Rider Management ---
  GetMyRiders: {
    path: `${BASE_URL}/api/vendor/my-riders`,
    method: "GET",
  } as const satisfies ApiRoute,
  ManageRider: {
    path: `${BASE_URL}/api/vendor/rider-action`,
    method: "PUT",
  } as const satisfies ApiRoute,
  // --- Account ---
  DeleteAccount: {
    path: `${BASE_URL}/api/auth/delete_account`,
    method: "DELETE",
  } as const satisfies ApiRoute,
};

export default VendorApiRoutes;
