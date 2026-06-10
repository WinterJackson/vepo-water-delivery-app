import { UIThemeContext } from "@/context/ThemeContext";
import * as Location from "expo-location";
import { useContext, useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
    Dimensions,
    Platform,
    StatusBar,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PressableScale from "@/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import { BRAND } from "@/constants/brandColors";
import { VendorMapBottomSkeleton } from "@/components/skeletons/ContextualSkeletons";
import * as Haptics from "expo-haptics";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { useRouter } from "expo-router";
import { darkMapStyle, standardMapStyle } from "@/constants/mapStyles";
import useWebSocket from "@/hooks/useWebSocket";
import { useVendorProfile, useUpdateVendorProfile } from "@/hooks/queries/useVendorProfile";
import { useVendorOrders } from "@/hooks/queries/useVendorOrders";
import { useQueryClient } from "@tanstack/react-query";
import { DataFallbackUI } from "@/components/ui/DataFallbackUI";

let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let UrlTile: any = null;
let PROVIDER_GOOGLE: string | null = null;

if (Platform.OS !== "web") {
    try {
        // @ts-ignore
        const maps = require("react-native-maps");
        MapView = maps.default;
        Marker = maps.Marker;
        Circle = maps.Circle;
        UrlTile = maps.UrlTile;
        PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
    } catch {
    }
}

const NAIROBI = { latitude: -1.2921, longitude: 36.8219, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const DEFAULT_RADIUS_KM = 5;

export default function MyMap() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: vendorProfile, isLoading: isProfileLoading } = useVendorProfile();
    const updateProfile = useUpdateVendorProfile();
    const { data: orders = [], isLoading: isOrdersLoading } = useVendorOrders();

    const [currentLocation, setCurrentLocation] = useState<any>(null);
    const [deviceLocationLoading, setDeviceLocationLoading] = useState(true);
    const mapRef = useRef<any>(null);

    const { connected } = useWebSocket('vendor', vendorProfile?.id || '', () => {
        queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
    });

    const loading = isProfileLoading || isOrdersLoading || deviceLocationLoading;

    const shadowStyle = darkTheme
        ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }
        : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 };

    const [optimisticRadius, setOptimisticRadius] = useState<number | null>(null);
    const radiusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentDisplayRadius = optimisticRadius !== null ? optimisticRadius : (vendorProfile?.delivery_radius || DEFAULT_RADIUS_KM);

    const handleUpdateRadius = useCallback((increment: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const newRadius = Math.min(15, Math.max(1, currentDisplayRadius + increment));
        if (newRadius === currentDisplayRadius) return;
        setOptimisticRadius(newRadius);
        if (radiusTimeoutRef.current) clearTimeout(radiusTimeoutRef.current);
        radiusTimeoutRef.current = setTimeout(async () => {
            try {
                await updateProfile.mutateAsync({ delivery_radius: newRadius });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
                if (__DEV__) console.error("Radius update error:", e);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setOptimisticRadius(null);
            }
        }, 800);
    }, [currentDisplayRadius, updateProfile]);

    useEffect(() => {
        if (vendorProfile?.delivery_radius && !radiusTimeoutRef.current) {
            setOptimisticRadius(null);
        }
    }, [vendorProfile?.delivery_radius]);

    useEffect(() => {
        const fetchDeviceLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === "granted") {
                    const loc = await Location.getCurrentPositionAsync({});
                    setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                }
            } catch (e) {
                if (__DEV__) console.log("Location skipped:", e);
            } finally {
                setDeviceLocationLoading(false);
            }
        };
        fetchDeviceLocation();
    }, []);

    const safeCenter = useMemo(() => {
        if (vendorProfile?.lat && vendorProfile?.lng) {
            const lat = Number(vendorProfile.lat);
            const lng = Number(vendorProfile.lng);
            if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
        }
        if (currentLocation?.latitude && currentLocation?.longitude) {
            return { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
        }
        return { latitude: NAIROBI.latitude, longitude: NAIROBI.longitude };
    }, [vendorProfile?.lat, vendorProfile?.lng, currentLocation]);

    const radiusMeters = currentDisplayRadius * 1000;

    const activeOrders = useMemo(() => orders.filter(
        (o: any) => ["pending", "accepted", "ready", "picked_up", "in_transit"].includes(o.order_status)
    ), [orders]);

    const deliveredOrders = useMemo(() => orders.filter(
        (o: any) => o.order_status === "delivered"
    ).slice(0, 20), [orders]);

    const STATUS_COLORS: Record<string, string> = {
        pending: "#f59e0b", accepted: "#3b82f6", ready: "#8b5cf6",
        picked_up: "#06b6d4", in_transit: "#0ea5e9", delivered: "#22c55e",
    };

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

    useEffect(() => {
        if (!loading && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: safeCenter.latitude,
                longitude: safeCenter.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            }, 800);
        }
    }, [loading]);

    if (!vendorProfile && !isProfileLoading) {
        return (
            <DataFallbackUI 
                title="Vendor data unavailable"
                message="We couldn't load your vendor profile. Please retry to connect to the map."
                onRetry={() => queryClient.invalidateQueries({ queryKey: ['vendorProfile'] })}
            />
        );
    }

    return (
        <View className={`flex-1 ${darkTheme ? "bg-black" : "bg-[#f8fafc]"}`}>
            <StatusBar translucent backgroundColor="transparent" barStyle={darkTheme ? "light-content" : "dark-content"} />
            <View style={{ height: Dimensions.get('window').height * 0.5 }}>
                {MapView ? (
                    // @ts-ignore
                    <MapView
                        ref={mapRef}
                        provider={undefined}
                        style={{ flex: 1 }}
                        initialRegion={{
                            latitude: NAIROBI.latitude,
                            longitude: NAIROBI.longitude,
                            latitudeDelta: 0.04,
                            longitudeDelta: 0.04,
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                        customMapStyle={darkTheme ? darkMapStyle : standardMapStyle}
                    >
                        {UrlTile && (
                            // @ts-ignore
                            <UrlTile
                                urlTemplate={darkTheme
                                    ? "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
                                    : "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"}
                                maximumZ={20}
                            />
                        )}
                        {vendorProfile?.lat && vendorProfile?.lng && (
                            // @ts-ignore
                            <Marker
                                coordinate={{ latitude: Number(vendorProfile.lat), longitude: Number(vendorProfile.lng) }}
                                title={vendorProfile.business_name || "My Store"}
                                description={vendorProfile.location_address || "Store location"}
                                pinColor="blue"
                            />
                        )}
                        {vendorProfile?.lat && vendorProfile?.lng && Circle && (
                            // @ts-ignore
                            <Circle
                                center={{ latitude: Number(vendorProfile.lat), longitude: Number(vendorProfile.lng) }}
                                radius={radiusMeters}
                                strokeWidth={2}
                                strokeColor="rgba(14, 165, 233, 0.6)"
                                fillColor="rgba(14, 165, 233, 0.08)"
                            />
                        )}
                        {activeOrders.map((order: any, idx: number) =>
                            order.lat && order.lng ? (
                                // @ts-ignore
                                <Marker
                                    key={`active-${order.id || idx}`}
                                    coordinate={{ latitude: Number(order.lat), longitude: Number(order.lng) }}
                                    title={`Order #${order.id?.substring(0, 8)}`}
                                    description={`${order.order_status} · KSH ${order.total_amount}`}
                                    pinColor={STATUS_COLORS[order.order_status] || "red"}
                                />
                            ) : null
                        )}
                        {deliveredOrders.map((order: any, idx: number) =>
                            order.lat && order.lng ? (
                                // @ts-ignore
                                <Marker
                                    key={`delivered-${order.id || idx}`}
                                    coordinate={{ latitude: Number(order.lat), longitude: Number(order.lng) }}
                                    title={`Delivered #${order.id?.substring(0, 8)}`}
                                    description={`KSH ${order.total_amount}`}
                                    pinColor="green"
                                    opacity={0.5}
                                />
                            ) : null
                        )}
                    </MapView>
                ) : (
                    <View className={`flex-1 items-center justify-center ${darkTheme ? "bg-[#121212]" : "bg-slate-100"}`}>
                        <View className={`w-28 h-28 rounded-full items-center justify-center mb-6 shadow-sm border ${darkTheme ? "bg-[#201f1f] border-[#3f4850]" : "bg-white border-slate-200"}`}>
                            <Ionicons name="map" size={56} color={BRAND.primary} />
                        </View>
                        <Text className={`mt-4 text-center px-10 font-bold text-lg ${darkTheme ? "text-[#bfc7d2]" : "text-slate-500"}`}>Map Engine Unavailable</Text>
                        <Text className={`mt-2 text-center px-12 font-semibold text-sm ${darkTheme ? "text-[#89929b]" : "text-slate-400"}`}>Map requires a native build.</Text>
                    </View>
                )}
                <SafeAreaView edges={["top"]} className="absolute w-full" pointerEvents="box-none">
                    <View className="px-4 pt-3 flex-row items-center justify-between" pointerEvents="box-none">
                        <View className="flex-row items-center" pointerEvents="box-none">
                            <PressableScale onPress={() => router.back()} className="mr-4">
                                <BackButtonMinimal />
                            </PressableScale>
                            <View className={`px-5 py-3 rounded-[32px] border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={shadowStyle}>
                                <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Live Map</Text>
                            </View>
                        </View>
                        <View className="flex-row items-center gap-2 pointer-events-auto">
                            <View className="flex-row gap-2">
                                <PressableScale onPress={() => handleZoom(true)} className={`w-10 h-10 rounded-full items-center justify-center border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={shadowStyle}>
                                    <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-800"}`}>+</Text>
                                </PressableScale>
                                <PressableScale onPress={() => handleZoom(false)} className={`w-10 h-10 rounded-full items-center justify-center border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={shadowStyle}>
                                    <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-800"}`}>−</Text>
                                </PressableScale>
                            </View>
                            <PressableScale
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    mapRef.current?.animateToRegion({ latitude: safeCenter.latitude, longitude: safeCenter.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
                                }}
                                className={`w-10 h-10 rounded-full items-center justify-center border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`}
                                style={shadowStyle}
                            >
                                <Ionicons name="navigate" size={20} color={BRAND.primary} />
                            </PressableScale>
                        </View>
                    </View>
                </SafeAreaView>
            </View>
            <View className={`flex-1 rounded-t-[32px] pt-2 px-5 mt-[-24px] ${darkTheme ? "bg-black border-t border-outline-variant" : "bg-[#f8fafc] border-t border-gray-200"}`} style={shadowStyle}>
                <View className="items-center mb-4">
                    <View className={`w-12 h-1.5 rounded-full ${darkTheme ? "bg-slate-700" : "bg-slate-300"}`} />
                </View>
                <Text className={`text-xl font-bold mb-6 ${darkTheme ? "text-white" : "text-slate-900"}`}>Delivery Zone Details</Text>
                {loading ? (
                    <VendorMapBottomSkeleton />
                ) : (
                    <>
                        <View className={`rounded-[24px] p-5 mb-5 border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={shadowStyle}>
                            <View className="flex-row justify-between items-center">
                                <View className="flex-1 mr-4">
                                    <Text className={`text-[10px] font-bold mb-1 tracking-widest uppercase ${darkTheme ? "text-[#bfc7d2]" : "text-slate-500"}`}>Service Radius</Text>
                                    <Text className={`text-sm font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Determines your catchment</Text>
                                </View>
                                <View className="flex-row items-center bg-transparent">
                                    <PressableScale onPress={() => handleUpdateRadius(-1)} className="w-12 h-12 rounded-full bg-red-500/10 items-center justify-center border border-red-500/20">
                                        <Ionicons name="remove" size={24} color="#ef4444" />
                                    </PressableScale>
                                    <View className="w-16 items-center">
                                        <Text className={`text-2xl font-black ${darkTheme ? "text-white" : "text-slate-900"}`}>
                                            {currentDisplayRadius}<Text className="text-sm font-bold">km</Text>
                                        </Text>
                                    </View>
                                    <PressableScale onPress={() => handleUpdateRadius(1)} className="w-12 h-12 rounded-full bg-[#10b981]/10 items-center justify-center border border-[#10b981]/20">
                                        <Ionicons name="add" size={24} color="#10b981" />
                                    </PressableScale>
                                </View>
                            </View>
                        </View>
                        <View className="flex-row gap-4 mb-5">
                            <View className={`flex-1 rounded-[24px] p-5 border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={shadowStyle}>
                                <View className={`w-10 h-10 rounded-full items-center justify-center mb-3 ${darkTheme ? "bg-accentbg/20" : "bg-accentbg/10"}`}>
                                    <Ionicons name="bicycle-outline" size={20} color={BRAND.primary} />
                                </View>
                                <Text className={`text-3xl font-black ${darkTheme ? "text-white" : "text-slate-900"}`}>{activeOrders.length}</Text>
                                <Text className={`text-xs font-bold mt-1 tracking-wide uppercase ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Active Orders</Text>
                            </View>
                            <View className={`flex-1 rounded-[24px] p-5 border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={shadowStyle}>
                                <View className={`w-10 h-10 rounded-full items-center justify-center mb-3 ${darkTheme ? "bg-[#10b981]/20" : "bg-[#10b981]/10"}`}>
                                    <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                                </View>
                                <Text className={`text-3xl font-black ${darkTheme ? "text-white" : "text-slate-900"}`}>{deliveredOrders.length}</Text>
                                <Text className={`text-xs font-bold mt-1 tracking-wide uppercase ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Delivered</Text>
                            </View>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}
