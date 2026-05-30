import RiderApiRoutes from "@/API/routes/RiderApiRoutes";
import { queueOfflineAction } from '@/config/database';
import { UIThemeContext } from "@/context/ThemeContext";
import useWebSocket from "@/hooks/useWebSocket";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import * as Location from "expo-location";
import { useContext, useEffect, useRef, useState } from "react";
import {
    Dimensions, Linking, Platform,
    Text,
    View,
    Modal, ScrollView, TouchableOpacity, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND, TOAST } from "@/constants/brandColors";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import Constants from 'expo-constants';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.ios?.config?.googleMapsApiKey || Constants.expoConfig?.android?.config?.googleMaps?.apiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Utility to decode Google Directions polyline string
function decodePolyline(t: string, e: number = 5) {
    for (var n, o, u = 0, l = 0, r = 0, d = [], h = 0, i = 0, a = null, c = Math.pow(10, e || 5); u < t.length;) {
        a = null, h = 0, i = 0;
        do a = t.charCodeAt(u++) - 63, i |= (31 & a) << h, h += 5; while (a >= 32);
        n = 1 & i ? ~(i >> 1) : i >> 1, h = i = 0;
        do a = t.charCodeAt(u++) - 63, i |= (31 & a) << h, h += 5; while (a >= 32);
        o = 1 & i ? ~(i >> 1) : i >> 1, l += n, r += o, d.push([l / c, r / c]);
    }
    return d.map(function(t) {
        return { latitude: t[0], longitude: t[1] };
    });
}
import { Toast } from "@/lib/toast";
import PressableScale from "@/components/ui/PressableScale";
import CloudinaryUpload from "@/Helpers/imageUpload";
import { useRejectDelivery } from "@/hooks/mutations/useRejectDelivery";
import { useRiderStore } from "@/stores/useRiderStore";
import { useRiderOrders } from "@/hooks/queries/useRiderData";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Popup } from "@/lib/popup";
import { RiderActiveDeliverySkeleton } from "@/components/skeletons/ContextualSkeletons";
import { useOrderContacts, ContactInfo } from "@/hooks/queries/useOrderContacts";

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let UrlTile: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Polyline = maps.Polyline;
    UrlTile = maps.UrlTile;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} else {
    MapView = ({ style, children }: any) => <View style={style}>{children}</View>;
    Marker = () => null;
    Polyline = () => null;
    UrlTile = () => null;
    PROVIDER_GOOGLE = 'google';
}

import { darkMapStyle, standardMapStyle } from "@/constants/mapStyles";

const { width } = Dimensions.get("window");

export default function ActiveDelivery() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken, signOut } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Use React Query for single source of truth
  const { data: orders = [], isLoading } = useRiderOrders();

  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const locationSubscription = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const riderId = useRiderStore((s) => s.riderId);
  const { mutateAsync: rejectDelivery, isPending: isRejecting } = useRejectDelivery();
  const [emptiesReceived, setEmptiesReceived] = useState<number>(0);

  // Cross-party contact info
  const { data: contactsData } = useOrderContacts(activeOrder?.id || null, activeOrder?.order_status || null);
  const contacts = contactsData?.contacts || [];
  const customerContact = contacts.find((c: ContactInfo) => c.role === "customer");
  const vendorContact = contacts.find((c: ContactInfo) => c.role === "vendor");

  const handleCall = (phone: string, role: string) => {
      if (!phone || phone === "N/A") {
          import("@/lib/toast").then(({ Toast }) => {
              Toast.error("Unavailable", `${role} phone number is not available.`);
          });
          return;
      }
      Linking.openURL(`tel:${phone}`);
  };

  // Derive empties expected from delivery_type and order items
  const computedEmptiesExpected = activeOrder?.delivery_type === 'quick_swap'
    ? (activeOrder?.order_item?.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0) || 0)
    : 0;

  // Sync activeOrder with fetched orders array
  useEffect(() => {
    const active = orders.find(
      (o: any) => ["pending", "picked_up", "accepted", "ready", "mismatch_pending", "pending_review"].includes(o.order_status)
    );
    // Only update state if it genuinely changed to avoid infinite loops with optimistic updates
    if (active) {
       if (!activeOrder || activeOrder.id !== active.id || activeOrder.order_status !== active.order_status) {
          setActiveOrder(active);
       }
    } else {
       // Keep optimistic 'delivered' or 'null' when no active orders match
       if (activeOrder && !["delivered"].includes(activeOrder.order_status)) {
          setActiveOrder(null);
       }
    }
  }, [orders]);

  useEffect(() => {
    if (activeOrder) {
      setEmptiesReceived(computedEmptiesExpected);
    }
  }, [activeOrder?.id]);

  // WebSocket hook for real-time order updates
  const { connected, sendMessage } = useWebSocket('rider', riderId || "", (updateData) => {
    // Handle order update from WebSocket
    if (__DEV__) console.log('Received order update via WebSocket:', updateData);
    
    // Update active order if it matches the updated order
    if (activeOrder && updateData.order_id === activeOrder.id) {
      setActiveOrder((prevOrder: any) => ({
        ...prevOrder,
        order_status: updateData.status
      }));
      
      // If delivered, clear the active order
      if (updateData.status === "delivered") {
        setActiveOrder(null);
        locationSubscription.current?.remove();
        Toast.success("Success", "Delivery completed!");
      }
    } else {
      // Trigger query refetch instead of raw fetch loop
      queryClient.invalidateQueries({ queryKey: ['rider', 'orders'] });
    }
  });

  // BUG-LOC-01 FIX: Only request location and start aggressive polling if there is ACTUALLY an order.
  // This prevents the app from chewing battery and pinging WS constantly while idle.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    
    const watchLocation = async () => {
      // Get silent one-time location for map display even if idle
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted" && !activeOrder) {
         try {
           const loc = await Location.getLastKnownPositionAsync();
           if (loc) setCurrentLocation(loc.coords);
         } catch(e) {}
         return; // Don't subscribe to continuous updates if no active order
      }

      if (status !== "granted" && activeOrder) {
        Toast.error("Permission Denied", "Location access is required for delivery tracking.");
        return;
      }

      if (activeOrder) {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (loc) => {
            setCurrentLocation(loc.coords);
            try {
              sendMessage({
                action: 'location_update',
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                order_id: activeOrder.id
              });
            } catch (e) { if (__DEV__) console.error("Caught Unhandled Exception:", e); }
          }
        );
        locationSubscription.current = sub;
      }
    };

    watchLocation();

    return () => {
      if (sub) {
        sub.remove();
      }
    };
  }, [activeOrder?.id, sendMessage]);

  const fetchRoute = async (startLng: number, startLat: number, endLng: number, endLat: number) => {
    try {
      // 🔴 PRODUCTION GOOGLE MAPS MODE 
      /*
      if (!GOOGLE_MAPS_API_KEY) {
        if (__DEV__) console.warn("Google Maps API Key missing for routing.");
        return;
      }
      const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const encodedPolyline = data.routes[0].overview_polyline.points;
        const coords = decodePolyline(encodedPolyline);
        setRouteCoords(coords);
      }
      */

      // 🟢 FREE OPEN SOURCE MVP MODE 
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const encodedPolyline = data.routes[0].geometry;
        const coords = decodePolyline(encodedPolyline);
        setRouteCoords(coords);
      }
    } catch (e) {
      if (__DEV__) console.error("Google Maps Route fetch error", e);
    }
  };

  useEffect(() => {
    if (currentLocation && activeOrder) {
      // Smooth animation to current location
      if (mapRef.current && Platform.OS !== 'web') {
        mapRef.current.animateCamera(
          {
            center: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
            pitch: 0,
            heading: currentLocation.heading || 0,
            altitude: 1000,
            zoom: 16
          },
          { duration: 1000 }
        );
      }

      const status = activeOrder.order_status;
      if (status === "pending" || status === "accepted" || status === "ready") {
        if (activeOrder.lat_from && activeOrder.lng_from) {
           fetchRoute(currentLocation.longitude, currentLocation.latitude, activeOrder.lng_from, activeOrder.lat_from);
        }
      } else if (status === "picked_up" || status === "in_transit") {
        if (activeOrder.lat && activeOrder.lng) {
           fetchRoute(currentLocation.longitude, currentLocation.latitude, activeOrder.lng, activeOrder.lat);
        }
      }
    } else {
      setRouteCoords([]);
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, activeOrder?.id, activeOrder?.order_status]);

  const updateDeliveryStatus = async (status: string, proofUrl?: string) => {
    if (!activeOrder) return;
    
    // 🔥 Optimistic UI Update: Flip the UI state BEFORE network response
    const previousStatus = activeOrder.order_status;
    setActiveOrder({ ...activeOrder, order_status: status });
    
    // For delivered status, clear immediately for the feeling of extreme speed bypassing lag loops completely
    if (status === "delivered") {
        setActiveOrder(null);
        locationSubscription.current?.remove();
        Toast.success("Success", "Delivery completed!");
    }
    
    try {
      const token = await getToken();
      const route = RiderApiRoutes.UpdateDeliveryStatus(activeOrder.id);
      const payload: { status: string; proof_url?: string; empties_received?: number } = { status };
      if (proofUrl) payload.proof_url = proofUrl;
      if (status === "delivered") payload.empties_received = emptiesReceived;
      
      const res = await fetch(route.path, {
        method: route.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          Toast.error("Session Expired", "Please log in again to continue.");
          signOut();
          router.replace("/(Auth)/sign-in/screen");
          return;
        }
        if (res.status >= 400 && res.status < 500) {
          const err = await res.json().catch(() => ({}));
          Toast.error("Update Failed", err.detail || "Could not update delivery status.");
          return;
        }
        throw new Error("Sync Failed Offline");
      }

      if (status !== "delivered") {
        queryClient.invalidateQueries({ queryKey: ['rider', 'orders'] });
      }
    } catch (e) {
      // Execute the Offline Queue mapping deterministically rather than rolling back explicitly
      if (status !== "delivered") {
        await queueOfflineAction(activeOrder.id, "UPDATE_DELIVERY_STATUS", JSON.stringify({ status }));
      }
    }
  };

  const captureProofAndDeliver = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      if (emptiesReceived < computedEmptiesExpected) {
        Toast.error("Permission Required", "Camera access is MANDATORY because of missing empty bottles. We need proof.");
        return;
      }
      Toast.info('Permission Denied', 'Camera access required to take proof of delivery photos. Continuing without photo.');
      updateDeliveryStatus("delivered");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (!result.canceled) {
        const photoUri = result.assets[0].uri;
        // Upload proof photo to Cloudinary
        try {
          const uploadResult = await CloudinaryUpload(photoUri, `proof_${activeOrder?.id}`);
          const proofUrl = uploadResult?.secure_url || null;
          updateDeliveryStatus("delivered", proofUrl);
        } catch (uploadErr) {
          // Upload failed but still mark delivered — the Toast already fired inside the helper
          updateDeliveryStatus("delivered");
        }
      }
    } catch (e) {
       if (__DEV__) console.error("Image picker error:", e);
       updateDeliveryStatus("delivered");
    }
  };

  const openNavigation = (lat: number, lng: number, label: string) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}&dirflg=d`,
      android: `google.navigation:q=${lat},${lng}`
    });
    Linking.openURL(url!);
  };

  const [isReportingMismatch, setIsReportingMismatch] = useState(false);
  const [showMismatchSheet, setShowMismatchSheet] = useState(false);
  const [selectedMismatchFloor, setSelectedMismatchFloor] = useState<number>(1);

  const reportAddressMismatch = async (floorLevel: number) => {
    if (!activeOrder) return;
    setIsReportingMismatch(true);
    try {
      const token = await getToken();
      const route = RiderApiRoutes.ReportMismatch(activeOrder.id);
      const res = await fetch(route.path, {
        method: route.method,
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ actual_floor_level: floorLevel })
      });
      if (!res.ok) {
        if (res.status === 401) {
          Toast.error("Session Expired", "Please log in again to continue.");
          signOut();
          router.replace("/(Auth)/sign-in/screen");
          return;
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to report mismatch");
      }
      setShowMismatchSheet(false);
      Toast.success("Dispute Raised", "The customer has been notified to correct their floor level. You will be compensated for the waiting time.");
      // Invalidate to fetch the updated state
      queryClient.invalidateQueries({ queryKey: ['rider', 'orders'] });
    } catch (e: any) {
      Toast.error("Error", e.message || "Failed to report mismatch");
    } finally {
      setIsReportingMismatch(false);
    }
  };

  useEffect(() => {
    // Initial fetch handled directly by useRiderOrders hook via React Query
  }, []);

  // ── Zoom controls ──
  const handleZoom = async (zoomIn: boolean) => {
    if (!mapRef.current || Platform.OS === 'web') return;
    try {
      const camera = await mapRef.current.getCamera();
      mapRef.current.animateCamera({
        ...camera,
        zoom: Math.max(1, Math.min(20, (camera.zoom || 15) + (zoomIn ? 1 : -1))),
      }, { duration: 250 });
    } catch {}
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: "New delivery assigned",
    accepted: "Waiting for vendor to prepare",
    ready: "Ready for pickup",
    picked_up: "On the way to customer",
    in_transit: "In transit",
    mismatch_pending: "Dispute Paused: Waiting for Customer",
  };

  const snapPoints = ["25%", "45%"];
  const bottomSheetRef = useRef<BottomSheet>(null);

  return (
    <View className={`flex-1 ${darkTheme ? "bg-surface" : "bg-white"}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

      <SafeAreaView edges={["top"]} style={{ backgroundColor: darkTheme ? "#000" : "#fff" }}>
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
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <BackButtonMinimal />
                </TouchableOpacity>
                <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                    Active Delivery
                </Text>
            </View>
        </View>
      </SafeAreaView>

      {/* ── Live Map ── */}
      <View className={`flex-1 ${darkTheme ? "bg-surface-container" : "bg-white"}`}>
        {MapView ? (
          <MapView
            ref={mapRef}
            // 🟢 FREE OPEN SOURCE MVP MODE 
            // Uncomment this block for MVP:
            provider={undefined}
            // 🔴 PRODUCTION GOOGLE MAPS MODE 
            // Uncomment this block for Production:
            // provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            customMapStyle={darkTheme ? darkMapStyle : standardMapStyle}
            initialRegion={currentLocation ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            } : {
              latitude: -1.2921,
              longitude: 36.8219,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {/* 🟢 FREE OPEN SOURCE MVP MODE */}
            {/* Uncomment this block for MVP: */}
            {UrlTile && <UrlTile urlTemplate={darkTheme ? "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png" : "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"} maximumZ={20} />}

            {/* OSRM Route Polyline */}
            {routeCoords.length > 0 && Polyline && (
              <Polyline 
                coordinates={routeCoords} 
                strokeWidth={5} 
                strokeColor={BRAND.primary} 
              />
            )}
            {/* Rider live position */}
            {currentLocation && (
              <Marker
                coordinate={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}
                title="You"
                pinColor={BRAND.primary}
              />
            )}
            {/* Pickup marker (vendor) */}
            {activeOrder?.lat_from && activeOrder?.lng_from && (
              <Marker
                coordinate={{ latitude: activeOrder.lat_from, longitude: activeOrder.lng_from }}
                title="Pickup"
                description={activeOrder.vendor?.business_name || "Vendor"}
                pinColor={BRAND.primary}
              />
            )}
            {/* Dropoff marker (customer) */}
            {activeOrder?.lat && activeOrder?.lng && (
              <Marker
                coordinate={{ latitude: activeOrder.lat, longitude: activeOrder.lng }}
                title="Dropoff"
                description="Customer"
                pinColor={TOAST.success}
              />
            )}
          </MapView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="map-outline" size={64} color={BRAND.primary} />
            {currentLocation && (
              <Text className={`text-xs mt-2 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                📍 {currentLocation.latitude?.toFixed(4)}, {currentLocation.longitude?.toFixed(4)}
              </Text>
            )}
          </View>
        )}
      </View>

      <View className="absolute top-4 right-4 pointer-events-auto flex-row gap-2">
        <PressableScale
          onPress={() => handleZoom(true)}
          className={`w-10 h-10 rounded-full items-center justify-center shadow-sm border ${darkTheme ? "bg-surface-variant border-outline-variant" : "bg-white border-gray-200"}`}
          style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
        >
          <Text className={`text-xl font-bold ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>+</Text>
        </PressableScale>
        <PressableScale
          onPress={() => handleZoom(false)}
          className={`w-10 h-10 rounded-full items-center justify-center shadow-sm border ${darkTheme ? "bg-surface-variant border-outline-variant" : "bg-white border-gray-200"}`}
          style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
        >
          <Text className={`text-xl font-bold ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>−</Text>
        </PressableScale>
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: darkTheme ? BRAND.bgDark : BRAND.white }}
        handleIndicatorStyle={{ backgroundColor: darkTheme ? BRAND.gray800 : BRAND.gray200 }}
      >
        <BottomSheetView className="flex-1 px-5 pt-2 pb-6">
          {isLoading ? (
            <RiderActiveDeliverySkeleton />
          ) : activeOrder ? (
            <>
              <View className={`p-4 rounded-3xl border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`}>
                <View className="flex-row justify-between items-start">
                  <View>
                    <Text className={`font-semibold text-lg ${darkTheme ? "text-on-surface" : "text-gray-900"}`}>
                      Order #{activeOrder.id?.substring(0, 8)}
                    </Text>
                    <Text className={`text-sm mt-1 font-semibold ${darkTheme ? "text-accentbg" : "text-accentbg"}`}>
                      {STATUS_LABELS[activeOrder.order_status] || activeOrder.order_status}
                    </Text>
                    <Text className={`text-sm mt-1.5 ${darkTheme ? "text-on-surface-variant" : "text-gray-500"}`}>
                      KSH {activeOrder.total_amount} · {activeOrder.order_item?.length || 0} item(s)
                    </Text>
                  </View>
                </View>

                {/* Navigation Links */}
                <View className={`flex-row gap-2 mt-4 pt-4 border-t ${darkTheme ? "border-outline-variant" : "border-gray-200"}`}>
                  <PressableScale 
                    onPress={() => openNavigation(activeOrder.lat_from || -1.2921, activeOrder.lng_from || 36.8219, "Pickup")}
                    className={`flex-1 py-3 rounded-xl items-center border flex-row justify-center gap-1 ${(activeOrder.order_status === "accepted" || activeOrder.order_status === "ready") ? "bg-accentbg/10 border-accentbg/30" : "opacity-30 " + (darkTheme ? "border-outline-variant" : "border-gray-200")}`}
                    disabled={(activeOrder.order_status !== "accepted" && activeOrder.order_status !== "ready")}
                  >
                    <Ionicons name="compass-outline" size={18} color={(activeOrder.order_status === "accepted" || activeOrder.order_status === "ready") ? BRAND.primary : "#9ca3af"} />
                    <Text className={`font-semibold ${(activeOrder.order_status === "accepted" || activeOrder.order_status === "ready") ? "text-accentbg" : darkTheme ? "text-on-surface" : "text-gray-800"}`}>Nav to Pickup</Text>
                  </PressableScale>
                  
                  <PressableScale 
                    onPress={() => openNavigation(activeOrder.lat || -1.2921, activeOrder.lng || 36.8219, "Dropoff")}
                    className={`flex-1 py-3 rounded-xl items-center border flex-row justify-center gap-1 ${(activeOrder.order_status === "picked_up" || activeOrder.order_status === "in_transit") ? "bg-accentbg/10 border-accentbg/30" : "opacity-30 " + (darkTheme ? "border-outline-variant" : "border-gray-200")}`}
                    disabled={(activeOrder.order_status !== "picked_up" && activeOrder.order_status !== "in_transit")}
                  >
                    <Ionicons name="location-outline" size={18} color={(activeOrder.order_status === "picked_up" || activeOrder.order_status === "in_transit") ? BRAND.primary : "#9ca3af"} />
                    <Text className={`font-semibold ${(activeOrder.order_status === "picked_up" || activeOrder.order_status === "in_transit") ? "text-accentbg" : darkTheme ? "text-on-surface" : "text-gray-800"}`}>Nav to Dropoff</Text>
                  </PressableScale>
                </View>

                {/* ── Cross-Party Contact Cards ────────────────────────── */}
                {contacts.length > 0 && (
                  <View className={`mt-4 pt-4 border-t ${darkTheme ? "border-outline-variant" : "border-gray-200"}`}>
                    <Text className={`font-bold text-base mb-3 ${darkTheme ? "text-white" : "text-gray-900"}`}>Contact</Text>
                    <View className="gap-2">
                      {customerContact && (
                        <PressableScale
                          onPress={() => handleCall(customerContact.phone, "Customer")}
                          className="flex-row items-center gap-3 p-3 rounded-xl"
                          style={{
                            backgroundColor: darkTheme ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                            borderWidth: 1,
                            borderColor: darkTheme ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                          }}
                        >
                          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: TOAST.success + '20' }}>
                            <Ionicons name="person" size={18} color={TOAST.success} />
                          </View>
                          <View className="flex-1">
                            <Text className={`font-bold text-sm ${darkTheme ? "text-white" : "text-slate-900"}`}>{customerContact.name}</Text>
                            <Text className={`text-xs ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Tap to call customer</Text>
                          </View>
                          <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: TOAST.success }}>
                            <Ionicons name="call" size={16} color="#fff" />
                          </View>
                        </PressableScale>
                      )}
                      {vendorContact && (
                        <PressableScale
                          onPress={() => handleCall(vendorContact.phone, "Vendor")}
                          className="flex-row items-center gap-3 p-3 rounded-xl"
                          style={{
                            backgroundColor: darkTheme ? 'rgba(2, 149, 247, 0.08)' : 'rgba(2, 149, 247, 0.06)',
                            borderWidth: 1,
                            borderColor: darkTheme ? 'rgba(2, 149, 247, 0.15)' : 'rgba(2, 149, 247, 0.12)',
                          }}
                        >
                          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: BRAND.primary + '20' }}>
                            <Ionicons name="storefront" size={18} color={BRAND.primary} />
                          </View>
                          <View className="flex-1">
                            <Text className={`font-bold text-sm ${darkTheme ? "text-white" : "text-slate-900"}`}>{vendorContact.name}</Text>
                            <Text className={`text-xs ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>Tap to call vendor</Text>
                          </View>
                          <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
                            <Ionicons name="call" size={16} color="#fff" />
                          </View>
                        </PressableScale>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View className="mt-4 gap-3">
                {(activeOrder.order_status === "pending" || activeOrder.order_status === "accepted") && (
                  <PressableScale
                    onPress={() => {
                      Popup.show({
                        title: "Reject Delivery",
                        message: "Are you sure you want to reject this delivery? It will be reassigned to another rider.",
                        cancelText: "Cancel",
                        confirmText: "Reject",
                        isDestructive: true,
                        onConfirm: async () => {
                            Popup.hide();
                            try {
                              await rejectDelivery(activeOrder.id);
                              setActiveOrder(null);
                              Toast.success("Rejected", "Delivery has been reassigned.");
                            } catch (e: any) {
                              Toast.error("Error", e.message || "Failed to reject delivery");
                            }
                          }
                      });
                    }}
                    disabled={isRejecting}
                    className="py-4 rounded-3xl items-center border"
                    style={{ borderColor: TOAST.error + '4D', backgroundColor: darkTheme ? TOAST.error + '1A' : TOAST.error + '0D' }}
                  >
                    <View className="flex-row items-center gap-1">
                      {!isRejecting && <Ionicons name="close-circle-outline" size={20} color={TOAST.error} />}
                      <Text style={{ color: TOAST.error }} className="font-bold text-lg">
                        {isRejecting ? "Rejecting..." : "Reject Delivery"}
                      </Text>
                    </View>
                  </PressableScale>
                )}
                {activeOrder.order_status === "ready" && (
                  <PressableScale onPress={() => updateDeliveryStatus("picked_up")} className="py-4 rounded-3xl items-center shadow-sm" style={{ backgroundColor: BRAND.primary }}>
                    <Text className="text-white font-bold text-lg">Mark as Picked Up</Text>
                  </PressableScale>
                )}
                {(activeOrder.order_status === "picked_up" || activeOrder.order_status === "in_transit") && (
                  <>
                    {/* Bottle Counter UI */}
                    <View className={`my-4 p-4 rounded-2xl border ${darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
                      <Text className={`font-bold mb-3 ${darkTheme ? "text-white" : "text-gray-900"}`}>Empty Bottles Retrieved</Text>
                      <View className="flex-row items-center justify-between">
                        <PressableScale onPress={() => setEmptiesReceived(Math.max(0, emptiesReceived - 1))} className="w-12 h-12 rounded-full items-center justify-center border" style={{ borderColor: TOAST.error + '33', backgroundColor: TOAST.error + '1A' }}>
                          <Text style={{ color: TOAST.error }} className="font-bold text-2xl">-</Text>
                        </PressableScale>
                        <Text className={`text-3xl font-black ${darkTheme ? "text-white" : "text-gray-900"}`}>{emptiesReceived}</Text>
                        <PressableScale onPress={() => setEmptiesReceived(emptiesReceived + 1)} className="w-12 h-12 rounded-full items-center justify-center border" style={{ borderColor: TOAST.success + '33', backgroundColor: TOAST.success + '1A' }}>
                          <Text style={{ color: TOAST.success }} className="font-bold text-2xl">+</Text>
                        </PressableScale>
                      </View>
                      
                      {/* Deficit Alert */}
                      {(computedEmptiesExpected > emptiesReceived) && (
                        <View className="mt-3 p-3 rounded-xl border flex-row items-start gap-2" style={{ borderColor: TOAST.error + '33', backgroundColor: TOAST.error + '1A' }}>
                          <Ionicons name="warning-outline" size={18} color={TOAST.error} style={{ marginTop: 2 }} />
                          <View className="flex-1">
                            <Text style={{ color: TOAST.error }} className="text-sm font-semibold">{computedEmptiesExpected - emptiesReceived} Bottles Missing (Deficit)</Text>
                            <Text style={{ color: TOAST.error, opacity: 0.8 }} className="text-xs mt-1">Proof Photo is mandatory when reporting missing bottles.</Text>
                          </View>
                        </View>
                      )}
                      
                      {/* Surplus Alert */}
                      {(computedEmptiesExpected < emptiesReceived) && (
                        <View className="mt-3 p-3 rounded-xl border flex-row items-center gap-2" style={{ borderColor: TOAST.success + '33', backgroundColor: TOAST.success + '1A' }}>
                          <Ionicons name="checkmark-circle-outline" size={18} color={TOAST.success} />
                          <Text style={{ color: TOAST.success }} className="text-sm font-semibold">Extra empty bottles retrieved.</Text>
                        </View>
                      )}
                    </View>

                    <PressableScale onPress={captureProofAndDeliver} className="py-4 rounded-3xl items-center shadow-sm flex-row justify-center gap-2" style={{ backgroundColor: TOAST.success }}>
                      <Ionicons name="camera-outline" size={24} color={BRAND.white} />
                      <Text className="text-white font-bold text-lg">Dropoff & Take Photo</Text>
                    </PressableScale>

                    <PressableScale 
                      onPress={() => setShowMismatchSheet(true)}
                      disabled={isReportingMismatch}
                      className="py-3 mt-2 rounded-xl items-center border flex-row justify-center gap-2"
                      style={{ borderColor: TOAST.error + '4D', backgroundColor: darkTheme ? TOAST.error + '1A' : TOAST.error + '0D' }}
                    >
                      {!isReportingMismatch && <Ionicons name="warning-outline" size={18} color={TOAST.error} />}
                      <Text style={{ color: TOAST.error }} className="font-bold text-base">
                        {isReportingMismatch ? "Reporting..." : "Report Floor Level Mismatch"}
                      </Text>
                    </PressableScale>

                    <PressableScale 
                      onPress={() => router.push({ pathname: "/(screens)/BottleRejection" as any, params: { orderId: activeOrder.id } })}
                      className="py-3 mt-2 rounded-xl items-center border flex-row justify-center gap-2"
                      style={{ borderColor: TOAST.error + '4D', backgroundColor: darkTheme ? TOAST.error + '1A' : TOAST.error + '0D' }}
                    >
                      <Ionicons name="flag-outline" size={18} color={TOAST.error} />
                      <Text style={{ color: TOAST.error }} className="font-bold text-base">
                        Flag Damaged Empty Bottle
                      </Text>
                    </PressableScale>

                    {/* Quick Deliver */}
                    {(emptiesReceived >= computedEmptiesExpected) && (
                      <PressableScale onPress={() => updateDeliveryStatus("delivered")} className="py-2 items-center">
                        <Text className={`font-semibold ${darkTheme ? "text-gray-400" : "text-gray-500"} underline`}>Skip Photo, Mark Delivered</Text>
                      </PressableScale>
                    )}

                    {/* GSM SMS Fallback */}
                    <PressableScale 
                       onPress={() => {
                         const gatewayNumber = process.env.EXPO_PUBLIC_SMS_GATEWAY_NUMBER || "+254700000000";
                         Linking.openURL(`sms:${gatewayNumber}?body=DELIVERED ${activeOrder.id?.substring(0,8)}`);
                       }} 
                       className={`py-4 rounded-3xl items-center border ${darkTheme ? "border-gray-800 bg-white/5" : "border-gray-200 bg-white"}`}>
                      <Text className={`font-bold text-sm ${darkTheme ? "text-gray-300" : "text-gray-600"}`}>
                        No Data? SMS to Complete
                      </Text>
                    </PressableScale>
                  </>
                )}
                {activeOrder.order_status === "mismatch_pending" && (
                  <View className="py-6 items-center">
                    <Ionicons name="hourglass-outline" size={64} color={TOAST.error} className="mb-4" />
                    <Text style={{ color: TOAST.error }} className={`text-center font-bold text-lg`}>
                      Delivery Paused
                    </Text>
                    <Text className={`text-center mt-2 mb-6 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                      Waiting for the customer to come downstairs. Once you hand over the bottles on the ground floor, you can complete the delivery below.
                    </Text>
                    
                    <PressableScale onPress={captureProofAndDeliver} className="py-4 px-6 rounded-3xl items-center shadow-sm flex-row justify-center gap-2 mb-3" style={{ backgroundColor: TOAST.success }}>
                      <Ionicons name="camera-outline" size={24} color={BRAND.white} />
                      <Text className="text-white font-bold text-lg">Dropoff & Take Photo</Text>
                    </PressableScale>

                    {/* Quick Deliver */}
                    {(emptiesReceived >= computedEmptiesExpected) && (
                      <PressableScale onPress={() => updateDeliveryStatus("delivered")} className="py-3 items-center">
                        <Text className={`font-semibold ${darkTheme ? "text-gray-400" : "text-gray-500"} underline`}>Skip Photo, Mark Delivered</Text>
                      </PressableScale>
                    )}
                  </View>
                )}
                {activeOrder.order_status === "pending_review" && (
                  <View className="py-6 items-center">
                    <Ionicons name="search-outline" size={64} color={TOAST.error} className="mb-4" />
                    <Text style={{ color: TOAST.error }} className={`text-center font-bold text-lg`}>
                      Under Review
                    </Text>
                    <Text className={`text-center mt-2 mb-6 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                      You've flagged a damaged bottle. Please wait 2-5 minutes while admin reviews the photos.
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View className="flex-1 items-center justify-center -mt-8">
              <Ionicons name="cafe-outline" size={64} color={BRAND.primary} />
              <Text className={`text-lg mt-4 text-center ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                No active deliveries right now. You'll be notified when a new order is assigned.
              </Text>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* Address Mismatch Bottom Sheet */}
      <Modal visible={showMismatchSheet} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className={`rounded-t-3xl p-6 ${darkTheme ? 'bg-surface-container' : 'bg-white'}`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-bold ${darkTheme ? 'text-white' : 'text-gray-900'}`}>Report Address Mismatch</Text>
              <PressableScale onPress={() => setShowMismatchSheet(false)} className="w-8 h-8 rounded-full bg-gray-200/20 items-center justify-center">
                <Text className={`text-lg font-bold ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>✕</Text>
              </PressableScale>
            </View>
            <Text className={`mb-4 ${darkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
              Select the actual floor the customer is located on. This will pause the delivery and require them to pay the correct surcharge before you can complete the delivery.
            </Text>
            
            <View className="flex-row flex-wrap gap-2 mb-6 justify-center">
              {[1, 2, 3, 4, 5, 6, 7].map((floor) => (
                <PressableScale
                  key={floor}
                  onPress={() => setSelectedMismatchFloor(floor)}
                  className={`w-14 h-14 rounded-xl items-center justify-center border`}
                  style={{
                    backgroundColor: selectedMismatchFloor === floor ? BRAND.primary : (darkTheme ? BRAND.gray800 : BRAND.gray100),
                    borderColor: selectedMismatchFloor === floor ? BRAND.primary : (darkTheme ? BRAND.gray700 : BRAND.gray200)
                  }}
                >
                  <Text className={`font-bold text-xl ${selectedMismatchFloor === floor ? 'text-white' : (darkTheme ? 'text-gray-300' : 'text-gray-700')}`}>
                    {floor === 1 ? 'GF' : floor}
                  </Text>
                </PressableScale>
              ))}
            </View>

            <PressableScale 
              onPress={() => reportAddressMismatch(selectedMismatchFloor)}
              disabled={isReportingMismatch}
              className="py-4 rounded-xl items-center"
              style={{ backgroundColor: TOAST.error }}
            >
              <Text className="text-white font-bold text-lg">
                {isReportingMismatch ? "Reporting..." : `Report Floor ${selectedMismatchFloor === 1 ? 'GF' : selectedMismatchFloor} Mismatch`}
              </Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}
