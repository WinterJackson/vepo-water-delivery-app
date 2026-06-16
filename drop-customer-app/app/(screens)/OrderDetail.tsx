import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { OrderDetailSkeleton } from "@/components/skeletons/ContextualSkeletons";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND, TOAST } from "@/constants/brandColors";
import { useOrders, useCancelOrder, Order, useOrderTrackingLogs } from "@/hooks/queries/useOrders";
import { useOrderContacts, ContactInfo } from "@/hooks/queries/useOrderContacts";
import { Toast } from "@/lib/toast";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext, useMemo, useState, useRef, useEffect } from "react";
import { PressableScale } from "@/components/ui/PressableScale";
import {
    Image,
    ScrollView,
    StatusBar,
    Text,
    View,
    Platform,
    Dimensions,
    Modal,
    Linking,
    Alert
} from "react-native";
import { useRiderTracking } from "@/hooks/queries/useRiderTracking";

let MapView: any = null;
let Marker: any = null;
let AnimatedRegion: any = null;
let MarkerAnimated: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    AnimatedRegion = maps.AnimatedRegion;
    MarkerAnimated = maps.MarkerAnimated;
    Polyline = maps.Polyline;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} else {
    MapView = ({ style, children }: any) => <View style={style}>{children}</View>;
    Marker = () => null;
    AnimatedRegion = null;
    MarkerAnimated = () => null;
    Polyline = () => null;
    PROVIDER_GOOGLE = 'google';
}

const { width } = Dimensions.get("window");

const STATUS_STEPS = ["unassigned", "pending", "accepted", "picked_up", "in_transit", "delivered"];

const STATUS_LABELS: Record<string, string> = {
    unassigned: "Finding Vendor",
    pending: "Order Placed",
    accepted: "Accepted by Vendor",
    picked_up: "Picked Up",
    in_transit: "On the Way",
    delivered: "Delivered",
    cancelled: "Cancelled",
    rejected: "Rejected",
    mismatch_pending: "Delivery Paused",
};

export default function OrderDetail() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const { mutate: cancelOrderMutation, isPending: cancelLoading } = useCancelOrder();

    const handleCancelOrder = () => {
        if (!order) return;
        Alert.alert(
            "Cancel Order",
            "Are you sure you want to cancel this order? This action cannot be undone.",
            [
                { text: "No, Keep It", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: () => {
                        cancelOrderMutation(order.id, {
                            onSuccess: () => {
                                Toast.success("Success", "Order cancelled successfully");
                            },
                            onError: (error: Error) => {
                                Toast.error("Error", (error as Error).message || "Failed to cancel order");
                            }
                        });
                    }
                }
            ]
        );
    };

    const { data: orders = [], isLoading: ordersLoading } = useOrders();
    const order: Order | null = useMemo(() => orders.find((o: Order) => o.id === orderId) || null, [orders, orderId]);

    // Use query loading state natively, or local state during intermediate transitions
    const isLoading = loading || ordersLoading;

    const getStatusIndex = (status: string) => STATUS_STEPS.indexOf(status);
    const currentStepIndex = order ? getStatusIndex(order.order_status) : -1;

    const shouldTrackRider = order?.order_status === "picked_up" || order?.order_status === "in_transit" || order?.order_status === "mismatch_pending";
    const { data: riderLocation } = useRiderTracking(order?.id || null, shouldTrackRider);
    const { data: trackingLogs } = useOrderTrackingLogs(order?.id || null);

    // Cross-party contact info (only fetched during active states)
    const { data: contactsData } = useOrderContacts(order?.id || null, order?.order_status || null);
    const contacts = contactsData?.contacts || [];
    const vendorContact = contacts.find((c: ContactInfo) => c.role === "vendor");
    const riderContact = contacts.find((c: ContactInfo) => c.role === "rider");

    const handleCall = (phone: string, role: string) => {
        if (!phone || phone === "N/A") {
            Toast.error("Unavailable", `${role} phone number is not available.`);
            return;
        }
        Linking.openURL(`tel:${phone}`);
    };

    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    // Smoothly animate the map camera to follow the rider as WebSockets stream GPS coords natively
    useEffect(() => {
        if (riderLocation?.lat && riderLocation?.lng && mapRef.current && Platform.OS !== 'web') {
            mapRef.current.animateCamera(
                {
                    center: { latitude: riderLocation.lat, longitude: riderLocation.lng },
                    pitch: 45,
                    heading: 0,
                    altitude: 1000,
                    zoom: 16
                },
                { duration: 1500 }
            );
            
            // If MarkerAnimated resolves animateMarkerToCoordinate, fire it for total smoothness
            if (markerRef.current?.animateMarkerToCoordinate) {
                markerRef.current.animateMarkerToCoordinate(
                    { latitude: riderLocation.lat, longitude: riderLocation.lng },
                    1500
                );
            }
        }
    }, [riderLocation?.lat, riderLocation?.lng]);

    if (isLoading) {
        return (
            <View className={`flex-1 ${darkTheme ? "bg-black" : ""}`} style={{ paddingTop: StatusBar.currentHeight }}>
                <View style={{ overflow: "hidden", paddingBottom: 4 }}>
                    <View 
                        className="flex-row items-center px-4 py-3 pb-4 mb-2 gap-3"
                        style={{ 
                            backgroundColor: darkTheme ? "#000" : "#fff",
                            borderBottomWidth: 1, 
                            borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
                        }}
                    >
                        <BackButtonMinimal />
                    </View>
                </View>
                <OrderDetailSkeleton />
            </View>
        );
    }

    if (!order) {
        return (
            <View className={`flex-1 items-center justify-center ${darkTheme ? "bg-black" : "bg-white"}`}>
                <Text className={`text-lg ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Order not found</Text>
            </View>
        );
    }

    return (
        <View className={`flex-1 ${darkTheme ? "bg-black" : ""}`} style={{ paddingTop: StatusBar.currentHeight }}>
            <StatusBar translucent backgroundColor="transparent" barStyle={darkTheme ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={{ overflow: "hidden", paddingBottom: 4 }}>
            <View 
                className="flex-row items-center px-4 py-3 pb-4 mb-2 gap-3"
                style={{ 
                    backgroundColor: darkTheme ? "#000" : "#fff",
    borderBottomWidth: 1, 
                    borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
                    ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
                }}
            >
                <PressableScale onPress={() => router.back()} activeOpacity={0.7}>
                    <BackButtonMinimal />
                </PressableScale>
                <Text className={`font-bold text-xl ${darkTheme ? "text-white" : "text-black"}`}>
                    Order #{order.id?.slice(-6)}
                </Text>
            </View>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                 {/* Status Timeline Tracking Bar */}
                 <View className={`p-5 rounded-2xl mb-5 ${darkTheme ? "bg-white/5" : "bg-white"}`}>
                     <Text className={`text-lg font-bold mb-4 ${darkTheme ? "text-white" : "text-black"}`}>
                         Tracking Status
                     </Text>
                     {(order.order_status === "cancelled" || order.order_status === "rejected" || order.order_status === "mismatch_pending") ? (
                         <View className="flex-row items-center gap-3">
                             <View 
                                className="w-8 h-8 rounded-full items-center justify-center"
                                style={{ backgroundColor: order.order_status === "mismatch_pending" ? BRAND.primary : TOAST.error }}
                             >
                                 <Text className="text-white font-bold">{order.order_status === "mismatch_pending" ? "⚠️" : "✕"}</Text>
                             </View>
                             <View>
                                <Text 
                                    className="text-base font-semibold"
                                    style={{ color: order.order_status === "mismatch_pending" ? BRAND.primary : TOAST.error }}
                                >
                                    {STATUS_LABELS[order.order_status]}
                                </Text>
                                {order.order_status === "mismatch_pending" && (
                                    <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                                        The rider reported an address mismatch. Please come to the ground floor to pick up your bottles!
                                    </Text>
                                )}
                             </View>
                         </View>
                     ) : (
                         <View>
                             <View className="flex-row justify-between items-center mb-8 px-2 relative">
                                 {/* Background Bar */}
                                 <View className={`absolute top-4 left-6 right-6 h-1 rounded ${darkTheme ? "bg-gray-700" : "bg-gray-300"}`} />
                                 
                                 {/* Progress Fill */}
                                 <View 
                                     className="absolute top-4 left-6 h-1 rounded bg-blue-500" 
                                     style={{ width: `${(Math.max(0, currentStepIndex) / (STATUS_STEPS.length - 1)) * 100}%` }} 
                                 />
                                 
                                 {STATUS_STEPS.map((step, index) => {
                                     const isActive = index <= currentStepIndex;
                                     const isCurrent = index === currentStepIndex;
                                     const isCompleted = index < currentStepIndex;
                                     
                                     return (
                                         <View key={step} className="items-center relative">
                                             <View 
                                                 className={`w-8 h-8 rounded-full items-center justify-center z-10 border-4 ${darkTheme ? "border-[#1c1c1e]" : "border-gray-50"} ${!isCompleted && !isCurrent ? (darkTheme ? "bg-gray-700" : "bg-gray-300") : ""}`}
                                                 style={isCompleted ? { backgroundColor: TOAST.success } : (isCurrent ? { backgroundColor: TOAST.info } : {})}
                                             >
                                                 {isCompleted ? (
                                                     <Text className="text-white text-xs font-bold">✓</Text>
                                                 ) : (
                                                     <Text className={`text-xs font-bold ${isActive ? "text-white" : (darkTheme ? "text-gray-400" : "text-gray-500")}`}>
                                                         {index + 1}
                                                     </Text>
                                                 )}
                                             </View>
                                             
                                             <Text 
                                                 className={`absolute top-10 text-[10px] w-20 text-center font-semibold ${
                                                     isCurrent
                                                         ? "text-blue-500"
                                                         : isActive
                                                         ? darkTheme ? "text-gray-300" : "text-gray-700"
                                                         : darkTheme ? "text-gray-600" : "text-gray-400"
                                                 }`}
                                             >
                                                 {STATUS_LABELS[step]?.split(" ")?.[0]}
                                             </Text>
                                         </View>
                                     );
                                 })}
                             </View>
                             <View className="mt-4 flex-row items-center justify-between">
                                 <Text className={`text-base font-semibold ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
                                    Current Stage:
                                 </Text>
                                 <Text className="text-blue-500 font-bold text-lg">
                                     {STATUS_LABELS[STATUS_STEPS[currentStepIndex]] || "Processing"}
                                 </Text>
                             </View>
                         </View>
                     )}
                 </View>

                 {/* Rider Live Tracking / Historical Map */}
                 {((shouldTrackRider && riderLocation?.lat && riderLocation?.lng) || (order.order_status === "delivered" && trackingLogs && trackingLogs.length > 0)) && MapView && (
                     <View className={`rounded-2xl overflow-hidden mb-5 border ${darkTheme ? "border-gray-800 bg-white/5" : "border-gray-200 bg-white"}`}>
                         <View className="p-4 border-b border-gray-200 dark:border-gray-800 flex-row justify-between items-center">
                             <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-black"}`}>
                                 {order.order_status === "delivered" ? "Route History" : "Rider Location"}
                             </Text>
                             {shouldTrackRider && (
                                <View className="flex-row items-center gap-2">
                                    <View className="w-2 h-2 rounded-full bg-green-500" />
                                    <Text className="text-green-500 font-semibold text-sm">Live</Text>
                                </View>
                             )}
                         </View>
                         <View className="h-48 w-full bg-gray-200">
                            <MapView
                                 ref={mapRef}
                                 provider={PROVIDER_GOOGLE}
                                 mapId={Platform.OS === 'ios' ? '3b06fa233809c6d3b07afa7e' : '3b06fa233809c6d35d39c7c1'}
                                 style={{ flex: 1 }}
                                 initialRegion={{
                                     latitude: shouldTrackRider && riderLocation ? riderLocation.lat : trackingLogs?.[0]?.lat,
                                     longitude: shouldTrackRider && riderLocation ? riderLocation.lng : trackingLogs?.[0]?.lng,
                                     latitudeDelta: 0.015,
                                     longitudeDelta: 0.015,
                                 }}
                                 zoomEnabled={false}
                                 scrollEnabled={false}
                                 pitchEnabled={false}
                                 rotateEnabled={false}
                             >
                                 {shouldTrackRider && riderLocation && (MarkerAnimated && Platform.OS !== 'web' ? (
                                     <MarkerAnimated
                                         ref={markerRef}
                                         coordinate={{ latitude: riderLocation.lat, longitude: riderLocation.lng }}
                                         title={riderLocation.rider_name || "Rider"}
                                         description="On the way with your order"
                                         pinColor="blue"
                                     />
                                 ) : (
                                     <Marker
                                         coordinate={{ latitude: riderLocation.lat, longitude: riderLocation.lng }}
                                         title={riderLocation.rider_name || "Rider"}
                                         pinColor="blue"
                                     />
                                 ))}
                                 
                                 {order.order_status === "delivered" && trackingLogs && trackingLogs.length > 0 && Polyline && (
                                     <>
                                         <Polyline
                                             coordinates={trackingLogs.map((log: any) => ({
                                                 latitude: log.lat,
                                                 longitude: log.lng,
                                             }))}
                                             strokeColor={BRAND.primary}
                                             strokeWidth={4}
                                         />
                                         <Marker
                                             coordinate={{ latitude: trackingLogs[0].lat, longitude: trackingLogs[0].lng }}
                                             title="Start"
                                             pinColor="green"
                                         />
                                         <Marker
                                             coordinate={{ latitude: trackingLogs[trackingLogs.length - 1].lat, longitude: trackingLogs[trackingLogs.length - 1].lng }}
                                             title="Delivery Location"
                                             pinColor="blue"
                                         />
                                     </>
                                 )}
                             </MapView>
                         </View>
                         {shouldTrackRider && riderLocation && (
                             <View className="p-4 flex-row items-center gap-3">
                                 <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center">
                                     <Text style={{ fontSize: 20 }}>🛵</Text>
                                 </View>
                                 <View>
                                     <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>
                                         {riderLocation.rider_name || "Your Rider"}
                                     </Text>
                                     <Text className={`text-sm ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                                         Will arrive soon
                                     </Text>
                                 </View>
                             </View>
                         )}
                     </View>
                 )}

                {/* ── Cross-Party Contact Cards ────────────────────────── */}
                {contacts.length > 0 && (
                    <View className={`p-5 rounded-2xl mb-5 ${darkTheme ? "bg-white/5" : "bg-white"}`}>
                        <Text className={`text-lg font-bold mb-4 ${darkTheme ? "text-white" : "text-black"}`}>
                            Contact
                        </Text>
                        <View className="gap-3">
                            {vendorContact && (
                                <PressableScale
                                    activeOpacity={0.8}
                                    onPress={() => handleCall(vendorContact.phone, "Vendor")}
                                    className="flex-row items-center gap-3 p-3 rounded-xl"
                                    style={{
                                        backgroundColor: darkTheme ? 'rgba(2, 149, 247, 0.08)' : 'rgba(2, 149, 247, 0.06)',
                                        borderWidth: 1,
                                        borderColor: darkTheme ? 'rgba(2, 149, 247, 0.15)' : 'rgba(2, 149, 247, 0.12)',
                                    }}
                                >
                                    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: BRAND.primary + '20' }}>
                                        <Text style={{ fontSize: 18 }}>🏪</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-bold text-base ${darkTheme ? "text-white" : "text-black"}`}>
                                            {vendorContact.name}
                                        </Text>
                                        <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Tap to call vendor</Text>
                                    </View>
                                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
                                        <Text className="text-white text-lg">📞</Text>
                                    </View>
                                </PressableScale>
                            )}
                            {riderContact && (
                                <PressableScale
                                    activeOpacity={0.8}
                                    onPress={() => handleCall(riderContact.phone, "Rider")}
                                    className="flex-row items-center gap-3 p-3 rounded-xl"
                                    style={{
                                        backgroundColor: darkTheme ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                                        borderWidth: 1,
                                        borderColor: darkTheme ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                                    }}
                                >
                                    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: TOAST.success + '20' }}>
                                        <Text style={{ fontSize: 18 }}>🛵</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-bold text-base ${darkTheme ? "text-white" : "text-black"}`}>
                                            {riderContact.name}
                                        </Text>
                                        <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                                            {riderContact.vehicle_details ? `${riderContact.vehicle_details} • ` : ""}Tap to call rider
                                        </Text>
                                    </View>
                                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: TOAST.success }}>
                                        <Text className="text-white text-lg">📞</Text>
                                    </View>
                                </PressableScale>
                            )}
                        </View>
                    </View>
                )}

                {/* Vendor Info */}
                {order.vendor && (
                    <View className={`p-5 rounded-2xl mb-5 ${darkTheme ? "bg-white/5" : "bg-white"}`}>
                        <Text className={`text-lg font-bold mb-3 ${darkTheme ? "text-white" : "text-black"}`}>
                            Vendor
                        </Text>
                        <View className="flex-row items-center gap-3">
                            {order.vendor.profile_pic ? (
                                <Image source={{ uri: order.vendor.profile_pic }} className="w-12 h-12 rounded-full" />
                            ) : (
                                <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center">
                                    <Text className="text-white text-lg">🏪</Text>
                                </View>
                            )}
                            <View>
                                <Text className={`font-bold text-base ${darkTheme ? "text-white" : "text-black"}`}>
                                    {order.vendor.business_name}
                                </Text>
                                <Text className={`text-sm ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                                    {order.vendor.location_address}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Order Items */}
                <View className={`p-5 rounded-2xl mb-5 ${darkTheme ? "bg-white/5" : "bg-white"}`}>
                    <Text className={`text-lg font-bold mb-3 ${darkTheme ? "text-white" : "text-black"}`}>
                        Items ({order.order_item?.length || 0})
                    </Text>
                    {order.order_item?.map((item: any) => (
                        <View key={item.id} className="flex-row items-center gap-3 mb-3">
                            {item.product?.image_url ? (
                                <Image source={{ uri: item.product.image_url }} className="w-14 h-14 rounded-xl" />
                            ) : (
                                <View className="w-14 h-14 rounded-xl bg-gray-300 items-center justify-center">
                                    <Text>📦</Text>
                                </View>
                            )}
                            <View className="flex-1">
                                <Text className={`font-semibold ${darkTheme ? "text-white" : "text-black"}`}>
                                    {item.product?.name || "Product"}
                                </Text>
                                <Text className={`text-sm ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                                    Qty: {item.quantity} × KSH {item.price}
                                </Text>
                            </View>
                            <Text className={`font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                                KSH {(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Price Breakdown */}
                <View className={`p-5 rounded-2xl mb-5 ${darkTheme ? "bg-white/5" : "bg-white"}`}>
                    <Text className={`text-lg font-bold mb-3 ${darkTheme ? "text-white" : "text-black"}`}>
                        Price Summary
                    </Text>
                    <View className="flex-row justify-between mb-2">
                        <Text className={`${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Subtotal</Text>
                        <Text className={`font-semibold ${darkTheme ? "text-white" : "text-black"}`}>
                            KSH {(Number(order.total_amount || 0) - Number(order.delivery_fee || 0)).toFixed(2)}
                        </Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Text className={`${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Delivery Fee</Text>
                        <Text className={`font-semibold ${darkTheme ? "text-white" : "text-black"}`}>KSH {(Number(order.delivery_fee || 0)).toFixed(2)}</Text>
                    </View>
                    <View className={`border-t pt-2 mt-2 flex-row justify-between ${darkTheme ? "border-gray-700" : "border-gray-200"}`}>
                        <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-black"}`}>Total</Text>
                        <Text className={`text-lg font-bold text-green-500`}>KSH {Number(order.total_amount || 0).toFixed(2)}</Text>
                    </View>
                </View>

                {/* Order Info */}
                <View className={`p-5 rounded-2xl mb-5 ${darkTheme ? "bg-white/5" : "bg-white"}`}>
                    <Text className={`text-lg font-bold mb-3 ${darkTheme ? "text-white" : "text-black"}`}>
                        Order Info
                    </Text>
                    <View className="gap-2">
                        <View className="flex-row justify-between">
                            <Text className={`${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Order ID</Text>
                            <Text className={`font-mono text-sm ${darkTheme ? "text-white" : "text-black"}`}>
                                {order.id?.slice(-12)}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className={`${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Placed On</Text>
                            <Text className={`${darkTheme ? "text-white" : "text-black"}`}>
                                {order.created_at ? new Date(order.created_at).toLocaleDateString("en-US", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                }) : "Unknown Date"}
                            </Text>
                        </View>
                        <View className="flex-row justify-between mt-1 pt-2 border-t border-gray-200 dark:border-gray-800">
                            <Text className={`${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Payment Method</Text>
                            {order.payment_method === "cash" ? (
                                <View className="flex-row items-center gap-1">
                                    <Text className="text-amber-500 font-bold">Cash on Delivery</Text>
                                    <Text className="text-amber-500">💰</Text>
                                </View>
                            ) : (
                                <View className="flex-row items-center gap-1">
                                    <Text className="text-green-500 font-bold">M-PESA</Text>
                                    <Text className="text-green-500">✅</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Actions */}
                {(order.order_status === "pending" || order.order_status === "unassigned" || order.order_status === "accepted") && (
                    <PressableScale
                        activeOpacity={0.8}
                        disabled={cancelLoading}
                        onPress={handleCancelOrder}
                        className="py-4 rounded-2xl items-center mb-4"
                        style={{ backgroundColor: TOAST.error }}
                    >
                        <Text className="text-white font-bold text-lg">{cancelLoading ? "Cancelling..." : "Cancel Order"}</Text>
                    </PressableScale>
                )}

                {order.order_status === "delivered" && !order.is_rated && (
                    <PressableScale
                        activeOpacity={0.8}
                        onPress={() =>
                            router.push({
                                pathname: "/(screens)/RateOrder",
                                params: {
                                    orderId: order.id,
                                    vendorId: order.vendor?.id,
                                    riderId: order.deliverer?.id,
                                },
                            })
                        }
                        className="py-4 rounded-2xl items-center mb-4"
                        style={{ backgroundColor: BRAND.primary }}
                    >
                        <Text className="text-white font-bold text-lg">⭐ Rate This Order</Text>
                    </PressableScale>
                )}
            </ScrollView>

            {/* Address Mismatch Dispute Modal */}
            <Modal
                visible={order.order_status === "mismatch_pending"}
                transparent={true}
                animationType="slide"
            >
                <View className="flex-1 justify-end bg-black/60">
                    <View 
                        className={`rounded-t-3xl p-6 ${darkTheme ? 'bg-[#1c1c1e]' : 'bg-white'}`}
                        style={{ borderTopWidth: 1, borderTopColor: darkTheme ? BRAND.gray800 : BRAND.gray200 }}
                    >
                        <View className="items-center mb-4">
                            <View className="w-12 h-12 rounded-full items-center justify-center mb-3" style={{ backgroundColor: TOAST.errorLight }}>
                                <Text className="text-2xl">⚠️</Text>
                            </View>
                            <Text className={`text-xl font-bold text-center mb-2 ${darkTheme ? 'text-white' : 'text-black'}`}>
                                Address Mismatch Detected
                            </Text>
                            <Text className={`text-base text-center ${darkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                                Your rider reported that your building requires climbing stairs, but your address specifies ground floor/elevator.
                            </Text>
                        </View>

                        <View 
                            className={`p-4 rounded-xl mb-6 ${darkTheme ? 'bg-black/50' : 'bg-white'}`}
                            style={{ borderWidth: 1, borderColor: darkTheme ? BRAND.gray800 : BRAND.gray200 }}
                        >
                            <Text className={`text-sm text-center font-medium ${darkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                                Please approve the KSh 30 adjustment to receive your water at your door, or tap 'Leave at Ground Floor'.
                            </Text>
                        </View>

                        <View className="gap-3 mb-4">
                            <PressableScale
                                activeOpacity={0.8}
                                onPress={() => {
                                    // Handle Approve Charge API call
                                    Toast.success("Charge Approved", "Your rider is on their way up!");
                                }}
                                className="w-full py-4 rounded-full items-center"
                                style={{ backgroundColor: BRAND.primary }}
                            >
                                <Text className="text-white font-bold text-lg">Approve Charge (+KSh 30)</Text>
                            </PressableScale>

                            <PressableScale
                                activeOpacity={0.8}
                                onPress={() => {
                                    // Handle Leave at Ground Floor API call
                                    Toast.info("Notified Rider", "Please meet your rider at the ground floor.");
                                }}
                                className="w-full py-4 rounded-full items-center"
                                style={{ backgroundColor: darkTheme ? BRAND.gray800 : BRAND.gray200 }}
                            >
                                <Text className={`font-bold text-lg ${darkTheme ? 'text-white' : 'text-black'}`}>
                                    Leave at Ground Floor
                                </Text>
                            </PressableScale>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
