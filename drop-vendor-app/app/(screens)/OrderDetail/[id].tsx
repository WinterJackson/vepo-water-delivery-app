import { Skeleton } from "@/components/ui/Skeleton";
import { UIThemeContext } from "@/context/ThemeContext";
import { useUpdateOrderStatus, useVendorOrders } from "@/hooks/queries/useVendorOrders";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext, useState } from "react";
import { ScrollView, StatusBar, Text, View, Linking } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import PressableScale from "@/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { VendorOrderDetailSkeleton } from "@/components/skeletons/ContextualSkeletons";
import { BRAND } from "@/constants/brandColors";
import { useOrderContacts, ContactInfo } from "@/hooks/queries/useOrderContacts";
import { useRef, useMemo, useCallback } from "react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 border-amber-500/30",
  accepted: "bg-accentbg/20 border-accentbg/30",
  preparing: "bg-purple-500/20 border-purple-500/30",
  ready: "bg-green-500/20 border-green-500/30",
  rejected: "bg-red-500/20 border-red-500/30",
  in_transit: "bg-sky-500/20 border-sky-500/30",
  picked_up: "bg-sky-500/20 border-sky-500/30",
  delivered: "bg-green-500/20 border-green-500/30",
  unassigned: "bg-slate-500/20 border-slate-500/30",
  cancelled: "bg-red-500/20 border-red-500/30",
  refund_pending: "bg-amber-500/20 border-amber-500/30",
  refunded: "bg-slate-500/20 border-slate-500/30",
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  pending: "text-amber-500",
  accepted: "text-accentbg",
  preparing: "text-purple-500",
  ready: "text-green-500",
  rejected: "text-red-500",
  in_transit: "text-sky-500",
  picked_up: "text-sky-500",
  delivered: "text-green-500",
  unassigned: "text-slate-500",
  cancelled: "text-red-500",
  refund_pending: "text-amber-500",
  refunded: "text-slate-500",
};

export default function OrderDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";

  const { data: orders = [], isLoading } = useVendorOrders();
  const { mutateAsync: updateStatusMutation } = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const [riders, setRiders] = useState<any[]>([]);

  const assignRiderSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["50%", "75%"], []);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
  ), []);

  const order = orders.find((o: any) => o.id === id);

  // Cross-party contact info (only fetched during active states)
  const { data: contactsData } = useOrderContacts(order?.id || null, order?.order_status || null);
  const contacts = contactsData?.contacts || [];
  const customerContact = contacts.find((c: ContactInfo) => c.role === "customer");
  const riderContact = contacts.find((c: ContactInfo) => c.role === "rider");

  const handleCall = (phone: string, role: string) => {
      if (!phone || phone === "N/A") {
          import("@/lib/toast").then(({ Toast }) => {
              Toast.error("Unavailable", `${role} phone number is not available.`);
          });
          return;
      }
      Linking.openURL(`tel:${phone}`);
  };

  const fetchRiders = async () => {
    const token = await getToken();
    try {
      const res = await fetch(VendorApiRoutes.GetMyRiders.path, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRiders(data.filter((r: any) => r.status === "approved" && r.is_available));
      }
    } catch (e) {
      if (__DEV__) console.error(e);
    }
  };

  const handleAssignRider = async (riderId: string) => {
    assignRiderSheetRef.current?.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const token = await getToken();
    try {
      const res = await fetch(VendorApiRoutes.AssignRider(id as string).path, {
        method: VendorApiRoutes.AssignRider(id as string).method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ deliverer_id: riderId })
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      }
    } catch (e) {
      if (__DEV__) console.error(e);
    }
  };

  const updateStatus = async (status: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await updateStatusMutation({ orderId: id as string, status });
    } catch (e: any) {
      if (__DEV__) console.error("Failed to update status", e);
      import("@/lib/toast").then(({ Toast }) => {
        const errMsg = e.response?.data?.detail || (e as Error).message || "Failed to update status. Please check your connection.";
        Toast.error("Update Failed", errMsg);
      });
    }
  };

  const cancelOrder = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const token = await getToken();
    try {
      const res = await fetch(VendorApiRoutes.CancelOrder(id as string).path, {
        method: VendorApiRoutes.CancelOrder(id as string).method,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
        import("@/lib/toast").then(({ Toast }) => Toast.success("Cancelled", "Order has been cancelled."));
      } else {
        const err = await res.json();
        import("@/lib/toast").then(({ Toast }) => Toast.error("Error", err.detail || "Failed to cancel order."));
      }
    } catch (e) {
      if (__DEV__) console.error(e);
      import("@/lib/toast").then(({ Toast }) => Toast.error("Error", "Network error while cancelling."));
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
        <VendorOrderDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView className={`flex-1 items-center justify-center ${darkTheme ? "bg-black" : ""}`}>
        <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 shadow-sm border ${darkTheme ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
            <Ionicons name="document-text-outline" size={48} color={BRAND.primary} />
        </View>
        <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>Order not found</Text>
        <PressableScale onPress={() => router.back()} className="mt-6 bg-accentbg px-8 py-3.5 rounded-full shadow-sm">
          <Text className="text-white font-bold">Go Back</Text>
        </PressableScale>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
        <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

        <View style={{ overflow: "hidden", paddingBottom: 4 }}>
          <View 
            className="flex-row items-center px-4 py-3 pb-4 mb-2"
            style={{ 
              backgroundColor: darkTheme ? "#000" : "#fff",
              borderBottomWidth: 1, 
              borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
              ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
            }}
          >
              <PressableScale onPress={() => router.back()} className="mr-4">
                  <BackButtonMinimal />
              </PressableScale>
              <View>
                  <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>
                      Order #{order.id?.substring(0, 8)}
                  </Text>
              </View>
          </View>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* Status indicator */}
          <View className="items-center mb-6">
            <View className={`px-5 py-2.5 rounded-full border ${STATUS_COLORS[order.order_status] || "bg-slate-200 border-slate-300"}`}>
              <Text className={`text-sm font-bold capitalize tracking-wider ${STATUS_TEXT_COLORS[order.order_status] || "text-slate-700"}`}>
                {order.order_status.replace("_", " ")}
              </Text>
            </View>
          </View>

          {/* Customer Details */}
          <View className={`p-5 rounded-[24px] mb-5 border shadow-sm ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
            <Text className={`font-bold text-lg mb-3 ${darkTheme ? "text-white" : "text-gray-900"}`}>Customer Details</Text>
            
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 rounded-full items-center justify-center bg-accentbg/10 mr-3">
                 <Ionicons name="person" size={18} color="white" />
              </View>
              <View>
                <Text className={`text-xs font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Name</Text>
                <Text className={`text-base font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{order.user?.username || order.user?.first_name || "Guest"}</Text>
              </View>
            </View>

            {order.user?.phone_number && (
               <View className="flex-row items-center mb-3">
                 <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                    <Ionicons name="call" size={18} color={BRAND.primary} />
                 </View>
                 <View>
                   <Text className={`text-xs font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Phone</Text>
                   <Text className={`text-base font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{order.user.phone_number}</Text>
                 </View>
               </View>
            )}

            {order.delivery_location && (
              <View className="flex-row items-center">
                 <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                    <Ionicons name="location" size={18} color={BRAND.primary} />
                 </View>
                 <View className="flex-1">
                   <Text className={`text-xs font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Delivery Address</Text>
                   <Text className={`text-base font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{order.delivery_location.street || "Not specified"}</Text>
                 </View>
               </View>
            )}
          </View>

          {/* ── Cross-Party Contact Cards ────────────────────────── */}
          {contacts.length > 0 && (
            <View className={`p-5 rounded-[24px] mb-5 border shadow-sm ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
              <Text className={`font-bold text-lg mb-4 ${darkTheme ? "text-white" : "text-gray-900"}`}>Contact</Text>
              <View className="gap-3">
                {customerContact && (
                  <PressableScale
                    onPress={() => handleCall(customerContact.phone, "Customer")}
                    className="flex-row items-center gap-3 p-3 rounded-xl"
                    style={{
                      backgroundColor: darkTheme ? 'rgba(2, 149, 247, 0.08)' : 'rgba(2, 149, 247, 0.06)',
                      borderWidth: 1,
                      borderColor: darkTheme ? 'rgba(2, 149, 247, 0.15)' : 'rgba(2, 149, 247, 0.12)',
                    }}
                  >
                    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: BRAND.primary + '20' }}>
                      <Ionicons name="person" size={20} color={BRAND.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-bold text-base ${darkTheme ? "text-white" : "text-slate-900"}`}>{customerContact.name}</Text>
                      <Text className={`text-xs ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Tap to call customer</Text>
                    </View>
                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
                      <Ionicons name="call" size={18} color="#fff" />
                    </View>
                  </PressableScale>
                )}
                {riderContact && (
                  <PressableScale
                    onPress={() => handleCall(riderContact.phone, "Rider")}
                    className="flex-row items-center gap-3 p-3 rounded-xl"
                    style={{
                      backgroundColor: darkTheme ? 'rgba(14, 165, 233, 0.08)' : 'rgba(14, 165, 233, 0.06)',
                      borderWidth: 1,
                      borderColor: darkTheme ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.12)',
                    }}
                  >
                    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(14, 165, 233, 0.2)' }}>
                      <Ionicons name="bicycle" size={20} color="#0ea5e9" />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-bold text-base ${darkTheme ? "text-white" : "text-slate-900"}`}>{riderContact.name}</Text>
                      <Text className={`text-xs ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>
                        {riderContact.vehicle_details ? `${riderContact.vehicle_details} • ` : ""}Tap to call rider
                      </Text>
                    </View>
                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#0ea5e9' }}>
                      <Ionicons name="call" size={18} color="#fff" />
                    </View>
                  </PressableScale>
                )}
              </View>
            </View>
          )}

          {/* Order Items */}
          <View className={`p-5 rounded-[24px] mb-5 border shadow-sm ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
            <Text className={`font-bold text-lg mb-4 ${darkTheme ? "text-white" : "text-gray-900"}`}>Order Items</Text>
            {order.order_item?.map((item: any, index: number) => (
              <View key={index} className={`flex-row justify-between items-center py-2 ${index !== order.order_item.length - 1 ? (darkTheme ? "border-b border-slate-800" : "border-b border-slate-100") : ""}`}>
                <View className="flex-row items-center">
                  <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                     <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{item.quantity}x</Text>
                  </View>
                  <Text className={`text-base font-semibold ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>
                    {item.product?.name || "Product"}
                  </Text>
                </View>
                <Text className={`font-black ${darkTheme ? "text-white" : "text-gray-900"}`}>
                  KSH {item.price * item.quantity}
                </Text>
              </View>
            ))}
          </View>

          {/* Delivery Type Info */}
          {order.delivery_type && (
            <View className={`p-5 rounded-[24px] mb-5 border shadow-sm ${darkTheme ? "bg-amber-900/10 border-amber-500/20" : "bg-amber-50 border-amber-200"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
              <View className="flex-row items-center mb-3">
                 <Ionicons name="water-outline" size={20} color={BRAND.primary} style={{ marginRight: 8 }} />
                 <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-gray-900"}`}>Delivery Flow</Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className={`font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Type</Text>
                <View className={`px-3 py-1 rounded-full flex-row items-center gap-1.5 ${order.delivery_type === 'quick_swap' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                  <Ionicons 
                    name={order.delivery_type === 'quick_swap' ? 'flash' : 'lock-closed'} 
                    size={12} 
                    color={order.delivery_type === 'quick_swap' ? '#3b82f6' : 'green-500'} 
                  />
                  <Text className={`font-bold text-xs ${order.delivery_type === 'quick_swap' ? 'text-blue-500' : 'text-green-500'}`}>
                    {order.delivery_type === 'quick_swap' ? 'Quick Swap' : 'Keep My Bottle'}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className={`font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Instruction</Text>
                <Text className={`font-bold text-sm ${darkTheme ? "text-white" : "text-gray-900"}`}>
                  {order.delivery_type === 'quick_swap' ? 'Swap empties for full' : 'Deliver new bottle(s)'}
                </Text>
              </View>
              {order.is_welcome_offer && (
                <View className="mt-3 p-3 bg-green-500/10 rounded-[16px] border border-green-500/20 flex-row items-center gap-2">
                  <Ionicons name="gift" size={20} color="green-500" />
                  <Text className="text-green-500 text-xs font-bold flex-1 leading-5">
                    Welcome Offer (30% off) applied to this order.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Financials */}
          <View className={`p-5 rounded-[24px] mb-5 border shadow-sm ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
            <Text className={`font-bold text-lg mb-3 ${darkTheme ? "text-white" : "text-gray-900"}`}>Payment Summary</Text>
            <View className="flex-row justify-between mb-3">
              <Text className={`font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Subtotal</Text>
              <Text className={`font-bold ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>KSH {order.total_amount - (order.delivery_fee || 0)}</Text>
            </View>
            <View className="flex-row justify-between mb-3">
              <Text className={`font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Delivery Fee</Text>
              <Text className={`font-bold ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>KSH {order.delivery_fee || 0}</Text>
            </View>
            <View className={`h-[1px] my-3 ${darkTheme ? "bg-slate-800" : "bg-white"}`} />
            <View className="flex-row justify-between items-center">
              <Text className={`font-black text-xl ${darkTheme ? "text-white" : "text-gray-900"}`}>Total</Text>
              <Text className={`font-black text-2xl text-accentbg`}>KSH {order.total_amount}</Text>
            </View>
          </View>

          {/* Rider Info if assigned */}
          {order.rider && (
            <View className={`p-5 rounded-[24px] mb-10 border shadow-sm ${darkTheme ? "bg-sky-500/10 border-sky-500/20" : "bg-sky-500/5 border-sky-500/10"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
              <View className="flex-row items-center mb-4">
                 <Ionicons name="bicycle" size={24} color={BRAND.primary} style={{ marginRight: 8 }} />
                 <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-gray-900"}`}>Assigned Rider</Text>
              </View>
              <View className="flex-row items-center mb-2">
                 <View className="w-10 h-10 rounded-full items-center justify-center bg-sky-500/20 mr-3">
                    <Ionicons name="person" size={18} color={BRAND.primary} />
                 </View>
                 <View>
                   <Text className={`text-xs font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Name</Text>
                   <Text className={`text-base font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{order.rider.username || "Assigned Rider"}</Text>
                 </View>
               </View>
               <View className="flex-row items-center">
                 <View className="w-10 h-10 rounded-full items-center justify-center bg-sky-500/20 mr-3">
                    <Ionicons name="car" size={18} color={BRAND.primary} />
                 </View>
                 <View>
                   <Text className={`text-xs font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Vehicle</Text>
                   <Text className={`text-base font-bold uppercase ${darkTheme ? "text-white" : "text-slate-900"}`}>{order.rider.vehicle_type || "N/A"}</Text>
                 </View>
               </View>
            </View>
          )}

        </ScrollView>

        {/* Action Buttons */}
        <View className={`px-5 pb-8 pt-4 border-t ${darkTheme ? "bg-black border-slate-800" : "bg-white border-gray-100"}`}>
          {order.order_status === "pending" && order.payment_method === "cash" && (
            <View className={`p-4 mb-4 rounded-xl border ${darkTheme ? "bg-amber-900/20 border-amber-500/30" : "bg-amber-50 border-amber-200"}`}>
               <View className="flex-row items-center mb-2">
                 <Ionicons name="warning" size={20} color="#f59e0b" style={{ marginRight: 8 }} />
                 <Text className={`font-bold text-sm ${darkTheme ? "text-amber-500" : "text-amber-700"}`}>Cash Float Required</Text>
               </View>
               <Text className={`text-xs ${darkTheme ? "text-amber-200/70" : "text-amber-700/80"}`}>
                 This is a Cash order. You must have enough funds in your Wallet to cover the platform's commission to accept it.
               </Text>
            </View>
          )}

          {order.order_status === "pending" && (
            <View className="flex-row gap-3">
               <PressableScale
                onPress={() => updateStatus("rejected")}
                className="flex-1 bg-red-500/10 border border-red-500/20 py-4 rounded-[16px] items-center shadow-sm"
              >
                <Text className="text-red-500 font-bold text-lg">Reject</Text>
              </PressableScale>
              <PressableScale
                onPress={() => updateStatus("accepted")}
                className="flex-[1.5] bg-accentbg py-4 rounded-[16px] items-center shadow-sm"
              >
                <Text className="text-white font-bold text-lg">Accept Order</Text>
              </PressableScale>
            </View>
          )}

          {order.order_status === "accepted" && (
            <View className="flex-row gap-3">
               {!order.rider && (
                <PressableScale
                  onPress={() => { fetchRiders(); assignRiderSheetRef.current?.present(); }}
                  className={`flex-1 py-4 rounded-[16px] items-center shadow-sm border ${darkTheme ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                >
                  <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-slate-900"}`}>Assign Fleet</Text>
                </PressableScale>
              )}
              <PressableScale
                onPress={() => updateStatus("preparing")}
                className="flex-[1.5] bg-purple-500 py-4 rounded-[16px] items-center shadow-sm"
              >
                <Text className="text-white font-bold text-lg">Start Prep</Text>
              </PressableScale>
            </View>
          )}

          {order.order_status === "preparing" && (
            <PressableScale
              onPress={() => updateStatus("ready")}
              className="w-full bg-green-500 py-4 rounded-[16px] items-center shadow-sm"
            >
              <Text className="text-white font-bold text-lg">Mark as Ready</Text>
            </PressableScale>
          )}

          {(order.order_status === "accepted" || order.order_status === "preparing") && (
             <PressableScale
                onPress={() => {
                  import("@/lib/popup").then(({ Popup }) => {
                     Popup.show({
                       title: "Cancel Order",
                       message: "Are you sure you want to cancel this order? This cannot be undone.",
                       cancelText: "No, Go Back",
                       confirmText: "Yes, Cancel Order",
                       isDestructive: true,
                       onConfirm: () => {
                         import("@/lib/popup").then(({ Popup }) => Popup.hide());
                         cancelOrder();
                       }
                     });
                  });
                }}
                className={`mt-4 py-4 rounded-[16px] items-center shadow-sm border ${darkTheme ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"}`}
              >
                <Text className="text-red-500 font-bold text-lg">Cancel Order</Text>
              </PressableScale>
          )}

          {(order.order_status === "ready" || order.order_status === "in_transit" || order.order_status === "picked_up" || order.order_status === "delivered") && (
            <>
              {order.order_status === "delivered" ? (
                <View className={`w-full py-4 rounded-[16px] items-center border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-slate-100"}`}>
                  <Text className={`font-bold text-lg ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>
                    Order Delivered
                  </Text>
                </View>
              ) : (
                <PressableScale
                  onPress={() => router.push(`/(screens)/Map/${order.id}` as any)}
                  className="w-full bg-accentbg py-4 rounded-[16px] items-center shadow-sm"
                >
                  <Text className="text-white font-bold text-lg">Track Delivery</Text>
                </PressableScale>
              )}
            </>
          )}
        </View>

      </SafeAreaView>

      {/* Fleet Rider Assignment Sheet */}
      <BottomSheetModal
        ref={assignRiderSheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: darkTheme ? "#1E293B" : "#FFFFFF" }}
        handleIndicatorStyle={{ backgroundColor: darkTheme ? "#475569" : "#CBD5E1", width: 40 }}
      >
        <BottomSheetView style={{ flex: 1, padding: 24 }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className={`text-2xl font-black ${darkTheme ? "text-white" : "text-slate-900"}`}>Assign Fleet Rider</Text>
            <PressableScale onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); assignRiderSheetRef.current?.dismiss(); }} className={`p-2 rounded-full ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                <Ionicons name="close" size={20} color={BRAND.primary} />
            </PressableScale>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {riders.length === 0 ? (
              <View className="items-center py-10">
                  <Ionicons name="warning-outline" size={48} color={BRAND.primary} className="mb-4" />
                  <Text className={`text-center font-semibold text-lg ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>No available riders</Text>
                  <Text className={`text-center mt-2 px-10 ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Ensure riders are 'Approved' and marked as 'Available' in your Fleet Management.</Text>
              </View>
            ) : riders.map((r: any) => (
              <PressableScale
                key={r.deliverer_id}
                onPress={() => handleAssignRider(r.deliverer_id)}
                className={`p-4 rounded-[20px] mb-3 border flex-row justify-between items-center shadow-sm ${darkTheme ? "border-slate-800 bg-[#0F172A]" : "border-slate-100 bg-white"}`}>
                <View className="flex-row items-center">
                  <View className="w-12 h-12 rounded-full bg-accentbg/10 mr-4 items-center justify-center border border-accentbg/20">
                    {r.profile_pic ? (
                      <Image source={{ uri: r.profile_pic }} className="w-full h-full rounded-full" />
                    ) : (
                      <Ionicons name="person" size={20} color={BRAND.primary} />
                    )}
                  </View>
                  <View>
                    <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-slate-900"}`}>{r.name}</Text>
                    <Text className={`text-xs mt-1 font-bold tracking-widest uppercase ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>{r.vehicle_type} • {r.plate_number || "No Plate"}</Text>
                  </View>
                </View>
                <View className="bg-accentbg/10 px-4 py-2.5 rounded-[12px] border border-accentbg/20">
                  <Text className="text-accentbg font-bold">Assign</Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>

    </>
  );
}
