import RiderApiRoutes from "@/API/routes/RiderApiRoutes";
import { UIThemeContext } from "@/context/ThemeContext";
import useWebSocket from "@/hooks/useWebSocket";
import { useRiderStore } from "@/stores/useRiderStore";
import { useAuth } from "@clerk/clerk-expo";
import React, { useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND, TOAST } from "@/constants/brandColors";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import PressableScale from "@/components/ui/PressableScale";
import { RiderTripRadarSkeleton } from "@/components/skeletons/ContextualSkeletons";
import { Toast } from "@/lib/toast";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { DataFallbackUI } from "@/components/ui/DataFallbackUI";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RadarOrder {
  id: string;
  order_status: string;
  total_amount: number;
  delivery_fee: number;
  distance_km: number;
  estimated_minutes: number;
  items_count: number;
  weight_kg: number;
  delivery_type: "quick_swap" | "keep_my_bottle";
  vehicle_class: string;
  vendor?: {
    business_name: string;
    location_address?: string;
  };
  delivery_location?: {
    street?: string;
  };
  lat?: number;
  lng?: number;
  lat_from?: number;
  lng_from?: number;
  created_at: string;
}

type FilterType = "ALL" | "< 5KM" | "HIGH PAYOUT" | "QUICK SWAP" | "KEEP MY BOTTLE";

export default function TripRadar() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken, signOut } = useAuth();
  const router = useRouter();
  const riderId = useRiderStore((s) => s.riderId);
  const isOnline = useRiderStore((s) => s.isOnline);
  const mutedVendors = useRiderStore((s) => s.mutedVendors);

  const [radarOrders, setRadarOrders] = useState<RadarOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");

  // Bottom Sheet State
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["60%", "90%"], []);
  const [selectedOrder, setSelectedOrder] = useState<RadarOrder | null>(null);

  // ── Fetch unassigned orders from REST ────────────────────────────────
  const fetchRadarOrders = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const route = RiderApiRoutes.GetOrders().path.replace("/orders", "/trip-radar");
      const res = await fetch(route, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const raw = await res.json();
        const orders: RadarOrder[] = Array.isArray(raw) ? raw : [];
        const filtered = orders.filter(
          (o) => !mutedVendors.includes(o.vendor?.business_name || "")
        );
        setRadarOrders(filtered);
      } else if (res.status === 401) {
        Toast.error("Session Expired", "Please log in again to continue.");
        signOut();
        router.replace("/(Auth)/sign-in/screen");
      }
    } catch (e) {
      if (__DEV__) console.error("[TripRadar] Fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [getToken, mutedVendors]);

  // ── WebSocket for real-time radar updates ────────────────────────────
  const { connected } = useWebSocket("rider", riderId || "", (updateData) => {
    if (updateData.action === "TRIP_RADAR_BROADCAST" || updateData.action === "NEW_DELIVERY_OFFER") {
      const newOrderId = updateData.order_id;
      if (!newOrderId) return;
      
      const vendorName = updateData.vendor?.business_name || "";
      if (mutedVendors.includes(vendorName)) return;

      setRadarOrders((prev) => {
        const exists = prev.some((o) => o.id === newOrderId);
        if (exists) return prev;
        const newOrder: RadarOrder = {
          id: newOrderId,
          order_status: "unassigned",
          total_amount: updateData.total_amount || 0,
          delivery_fee: updateData.delivery_fee || updateData.fee || 0,
          distance_km: updateData.distance_km || 0,
          estimated_minutes: updateData.estimated_minutes || 0,
          items_count: updateData.items_count || updateData.quantity || 0,
          weight_kg: updateData.weight_kg || 0,
          delivery_type: updateData.delivery_type || "quick_swap",
          vehicle_class: updateData.vehicle_class || "motorbike",
          vendor: updateData.vendor,
          delivery_location: updateData.delivery_location,
          lat: updateData.lat,
          lng: updateData.lng,
          lat_from: updateData.lat_from,
          lng_from: updateData.lng_from,
          created_at: new Date().toISOString(),
        };
        return [newOrder, ...prev];
      });
    } else if (updateData.action === "trip_radar_claimed") {
      setRadarOrders((prev) => prev.filter((o) => o.id !== updateData.order_id));
      if (selectedOrder?.id === updateData.order_id) {
        bottomSheetRef.current?.close();
        Toast.error("Claimed", "This order was taken by another rider.");
      }
    }
  });

  // ── Accept order ─────────────────────────────────────────────────────
  const acceptOrder = async (orderId: string) => {
    setAcceptingId(orderId);
    setRadarOrders((prev) => prev.filter((o) => o.id !== orderId));
    bottomSheetRef.current?.close();

    const token = await getToken();
    try {
      const route = RiderApiRoutes.AcceptDelivery(orderId);
      const res = await fetch(route.path, {
        method: route.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        Toast.success("Accepted!", "Navigate to the Active Delivery tab.");
        router.push("/(screens)/ActiveDelivery" as any);
      } else {
        if (res.status === 401) {
          Toast.error("Session Expired", "Please log in again to continue.");
          signOut();
          router.replace("/(Auth)/sign-in/screen");
          return;
        }
        const err = await res.json().catch(() => ({}));
        Toast.error("Claimed", err.detail || "This order was already taken by another rider.");
        fetchRadarOrders();
      }
    } catch (e) {
      Toast.error("Error", "Network error. Please try again.");
      fetchRadarOrders();
    } finally {
      setAcceptingId(null);
    }
  };

  // ── Polling + Lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      setRadarOrders([]);
      return;
    }
    fetchRadarOrders();
  }, [isOnline, fetchRadarOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRadarOrders();
    setRefreshing(false);
  }, [fetchRadarOrders]);

  // ── Filtering Logic ──────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = radarOrders;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.vendor?.business_name.toLowerCase().includes(query) ||
        o.delivery_location?.street?.toLowerCase().includes(query) ||
        o.id.toLowerCase().includes(query)
      );
    }

    if (activeFilter === "< 5KM") {
      result = result.filter(o => o.distance_km < 5);
    } else if (activeFilter === "HIGH PAYOUT") {
      result = result.filter(o => o.delivery_fee >= 200); 
    } else if (activeFilter === "QUICK SWAP") {
      result = result.filter(o => o.delivery_type === "quick_swap");
    } else if (activeFilter === "KEEP MY BOTTLE") {
      result = result.filter(o => o.delivery_type === "keep_my_bottle");
    }

    return result;
  }, [radarOrders, searchQuery, activeFilter]);

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // ── Components ───────────────────────────────────────────────────────
  const renderHeader = () => (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: darkTheme ? "#000" : "#fff" }}>
      <View style={{ overflow: "hidden", paddingBottom: 4 }}>
        <View 
          className="flex-row items-center justify-between px-4 py-3 pb-4 mb-2"
          style={{ 
            backgroundColor: darkTheme ? "#000" : "#fff",
            borderBottomWidth: 1, 
            borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
            ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
          }}
        >
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()}>
              <BackButtonMinimal />
            </TouchableOpacity>
            <View>
              <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                Trip Radar
              </Text>
              <View className="flex-row items-center gap-1 mt-0.5">
                <View style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: isOnline ? TOAST.success : BRAND.favorite
                }} />
                <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                  {isOnline ? "Online & Scanning" : "Offline"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );

  const renderSearchAndFilters = () => (
    <View className={`px-4 pt-2 pb-4`}>
      {/* Search Bar */}
      <View 
        className={`flex-row items-center rounded-xl px-3 py-2 mb-3 border ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-200"}`}
      >
        <Ionicons name="search-outline" size={20} color={BRAND.primary} />
        <TextInput
          placeholder="Search vendors, locations, or order ID..."
          placeholderTextColor={darkTheme ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"}
          className={`flex-1 ml-2 text-base ${darkTheme ? "text-white" : "text-gray-900"}`}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={BRAND.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(["ALL", "< 5KM", "HIGH PAYOUT", "QUICK SWAP", "KEEP MY BOTTLE"] as FilterType[]).map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full border ${isActive ? (darkTheme ? "bg-primary border-primary" : "bg-primary border-primary") : (darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-200")}`}
            >
              <Text className={`text-xs font-bold ${isActive ? "text-white" : (darkTheme ? "text-gray-300" : "text-gray-700")}`}>
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderDiscoverBanner = () => (
    <PressableScale
      onPress={() => router.push("/(screens)/DiscoverVendors" as any)}
      className={`mx-4 mb-4 p-4 rounded-2xl border flex-row items-center justify-between ${darkTheme ? "bg-blue-900/20 border-blue-900/40" : "bg-blue-50 border-blue-100"}`}
    >
      <View className="flex-1 mr-3">
        <Text className={`text-base font-bold mb-1 ${darkTheme ? "text-blue-400" : "text-blue-700"}`}>
          Looking for consistent work?
        </Text>
        <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-600"}`}>
          Partner with top vendors in your area for guaranteed daily orders.
        </Text>
      </View>
      <View className={`p-2.5 rounded-xl ${darkTheme ? "bg-blue-600" : "bg-blue-600"}`}>
        <Ionicons name="business-outline" size={20} color={BRAND.white} />
      </View>
    </PressableScale>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-10 mt-6 px-6">
      <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 border ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-200"}`}>
        <Ionicons 
          name={!isOnline ? "moon-outline" : (searchQuery ? "search-outline" : "planet-outline")} 
          size={36} 
          color={!isOnline ? (darkTheme ? BRAND.gray500 : BRAND.gray400) : BRAND.primary} 
        />
      </View>
      <Text className={`text-lg font-bold text-center mb-2 ${darkTheme ? "text-white" : "text-gray-900"}`}>
        {!isOnline ? "You are Offline" : (searchQuery ? "No Matches Found" : "Scanning for Deliveries...")}
      </Text>
      <Text className={`text-sm text-center ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
        {!isOnline 
          ? "Go online to start receiving Trip Radar broadcasts from nearby vendors." 
          : (searchQuery 
            ? "Try adjusting your search terms or filters to find more orders." 
            : "No unassigned orders match your criteria right now. Keep your app open to receive instant alerts.")}
      </Text>
    </View>
  );

  const renderOrderCard = ({ item }: { item: RadarOrder }) => (
    <PressableScale
      onPress={() => {
        setSelectedOrder(item);
        bottomSheetRef.current?.expand();
      }}
      className={`mx-4 mb-3 p-4 rounded-2xl border ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-200"}`}
      style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <View className={`px-2 py-0.5 rounded border ${darkTheme ? "bg-blue-900/40 border-blue-900/60" : "bg-blue-50 border-blue-100"}`}>
               <Text className={`text-[10px] font-bold uppercase text-primary`}>⚡ Gold Priority Ping</Text>
            </View>
          </View>
          <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>
            {item.vendor?.business_name || "Unknown Vendor"}
          </Text>
          <Text className={`text-sm mt-0.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
            {item.delivery_location?.street || "Delivery location hidden"}
          </Text>
        </View>
        <View className="items-end">
          <Text className={`text-lg font-black text-primary`}>KSH {item.delivery_fee}</Text>
          <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-3 mt-4">
        <View className="flex-row items-center gap-1">
          <Ionicons name="navigate-outline" size={14} color={BRAND.primary} />
          <Text className={`text-xs font-semibold ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
            {item.distance_km?.toFixed(1)} km
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={14} color={BRAND.primary} />
          <Text className={`text-xs font-semibold ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
            {item.estimated_minutes} min
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="water-outline" size={14} color={BRAND.primary} />
          <Text className={`text-xs font-semibold ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
            {item.items_count} items ({item.weight_kg}kg)
          </Text>
        </View>
      </View>
    </PressableScale>
  );

  // ── Trip Preview Bottom Sheet ────────────────────────────────────────
  const renderTripPreview = () => {
    if (!selectedOrder) return null;

    const hasVendorCoords = selectedOrder.lat_from !== undefined && selectedOrder.lng_from !== undefined;
    const hasCustomerCoords = selectedOrder.lat !== undefined && selectedOrder.lng !== undefined;
    
    // Default fallback to Nairobi if coordinates are totally missing
    const initialRegion = hasVendorCoords ? {
      latitude: selectedOrder.lat_from!,
      longitude: selectedOrder.lng_from!,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    } : {
      latitude: -1.2921,
      longitude: 36.8219,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };

    return (
      <View className={`flex-1 ${darkTheme ? "bg-surface" : "bg-white"}`}>
        <View className={`h-[250px] w-full ${darkTheme ? "bg-gray-800" : "bg-white"}`}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={initialRegion}
            showsUserLocation={false}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            {hasVendorCoords && (
              <Marker coordinate={{ latitude: selectedOrder.lat_from!, longitude: selectedOrder.lng_from! }}>
                <View className="bg-primary p-1.5 rounded-full border-2 border-white">
                  <Ionicons name="storefront-outline" size={16} color={BRAND.white} />
                </View>
              </Marker>
            )}
            {hasCustomerCoords && (
              <Marker coordinate={{ latitude: selectedOrder.lat!, longitude: selectedOrder.lng! }}>
                <View className="bg-green-500 p-1.5 rounded-full border-2 border-white">
                  <Ionicons name="location" size={16} color={BRAND.white} />
                </View>
              </Marker>
            )}
            {hasVendorCoords && hasCustomerCoords && (
              <Polyline
                coordinates={[
                  { latitude: selectedOrder.lat_from!, longitude: selectedOrder.lng_from! },
                  { latitude: selectedOrder.lat!, longitude: selectedOrder.lng! }
                ]}
                strokeColor={BRAND.primary}
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            )}
          </MapView>
        </View>

        <BottomSheetScrollView contentContainerStyle={{ padding: 20 }}>
          <Text className={`text-2xl font-black mb-1 ${darkTheme ? "text-white" : "text-black"}`}>
            KSH {selectedOrder.delivery_fee}
          </Text>
          <Text className={`text-base mb-5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
            {selectedOrder.distance_km?.toFixed(1)} km • {selectedOrder.estimated_minutes} min total est.
          </Text>

          <View className={`p-4 rounded-2xl border mb-6 ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-200"}`}>
            <View className="flex-row items-start mb-4">
              <Ionicons name="storefront-outline" size={20} color={BRAND.primary} style={{ marginTop: 2, marginRight: 12 }} />
              <View className="flex-1">
                <Text className={`text-xs font-bold uppercase mb-0.5 text-primary`}>Pickup</Text>
                <Text className={`text-base font-semibold ${darkTheme ? "text-white" : "text-gray-900"}`}>{selectedOrder.vendor?.business_name}</Text>
              </View>
            </View>

            <View className={`h-px ml-8 mb-4 ${darkTheme ? "bg-gray-800" : "bg-white"}`} />

            <View className="flex-row items-start">
              <Ionicons name="location" size={20} color={TOAST.success} style={{ marginTop: 2, marginRight: 12 }} />
              <View className="flex-1">
                <Text className={`text-xs font-bold uppercase mb-0.5 text-green-500`}>Dropoff</Text>
                <Text className={`text-base font-semibold ${darkTheme ? "text-white" : "text-gray-900"}`}>{selectedOrder.delivery_location?.street || "Customer Location"}</Text>
              </View>
            </View>
          </View>

          <View className="flex-row justify-between mb-8">
            <View className="items-center flex-1">
              <Ionicons name="cube-outline" size={24} color={BRAND.primary} />
              <Text className={`text-sm font-semibold mt-1 ${darkTheme ? "text-white" : "text-gray-900"}`}>{selectedOrder.items_count} Items</Text>
              <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>{selectedOrder.weight_kg}kg</Text>
            </View>
            <View className={`w-px ${darkTheme ? "bg-gray-800" : "bg-white"}`} />
            <View className="items-center flex-1">
              <Ionicons name="swap-horizontal-outline" size={24} color={BRAND.primary} />
              <Text className={`text-sm font-semibold mt-1 capitalize ${darkTheme ? "text-white" : "text-gray-900"}`}>
                {selectedOrder.delivery_type.replace('_', ' ')}
              </Text>
              <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Type</Text>
            </View>
            <View className={`w-px ${darkTheme ? "bg-gray-800" : "bg-white"}`} />
            <View className="items-center flex-1">
              <Ionicons name="bicycle-outline" size={24} color={BRAND.primary} />
              <Text className={`text-sm font-semibold mt-1 capitalize ${darkTheme ? "text-white" : "text-gray-900"}`}>
                {selectedOrder.vehicle_class}
              </Text>
              <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Required</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => acceptOrder(selectedOrder.id)}
            disabled={acceptingId === selectedOrder.id}
            className={`py-4 rounded-2xl items-center flex-row justify-center mb-10 ${darkTheme ? "bg-primary" : "bg-primary"}`}
            style={{ elevation: 2, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            {acceptingId === selectedOrder.id ? (
              <ActivityIndicator color={BRAND.white} />
            ) : (
              <>
                <Text className="text-white text-lg font-bold mr-2">Accept Trip</Text>
                <Ionicons name="checkmark-circle-outline" size={20} color={BRAND.white} />
              </>
            )}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </View>
    );
  };

  if (!riderId && !loading) {
    return (
      <DataFallbackUI 
        title="Rider Profile Unavailable"
        message="We couldn't load your rider profile to scan for trips. Please retry or restart."
        onRetry={() => {
          setLoading(true);
          fetchRadarOrders();
        }}
      />
    );
  }

  return (
    <View className={`flex-1 ${darkTheme ? "bg-black" : "bg-white"}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />
      
      {renderHeader()}
      
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderCard}
        ListHeaderComponent={<>{renderSearchAndFilters()}{renderDiscoverBanner()}</>}
        ListEmptyComponent={loading ? <RiderTripRadarSkeleton /> : renderEmptyState}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BRAND.primary]}
            tintColor={BRAND.primary}
          />
        }
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: darkTheme ? "#1c1c1e" : "white" }}
        handleIndicatorStyle={{ backgroundColor: darkTheme ? "#3f4850" : "#ddd" }}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        {renderTripPreview()}
      </BottomSheet>
    </View>
  );
}
