import React, { useContext, useEffect, useState, useCallback, memo } from "react";
import { View, Text, StatusBar, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import PressableScale from "@/components/ui/PressableScale";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { Toast } from "@/lib/toast";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { Popup } from "@/lib/popup";
import { BRAND } from "@/constants/brandColors";
import { Image } from "expo-image";
import { useVendorProfile } from "@/hooks/queries/useVendorProfile";

const RiderCard = memo(({ 
  item, 
  darkTheme, 
  actioningRider, 
  handleAction 
}: { 
  item: any, 
  darkTheme: boolean, 
  actioningRider: string | null, 
  handleAction: (id: string, action: string) => void 
}) => (
  <View className={`p-5 mb-4 rounded-[24px] flex-row items-center border shadow-sm ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
    <View className="w-[60px] h-[60px] rounded-full bg-accentbg/10 mr-4 overflow-hidden border border-accentbg/20">
      {item.profile_pic ? (
        <Image source={{ uri: item.profile_pic }} style={{ width: "100%", height: "100%" }} cachePolicy="disk" transition={200} />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="person" size={28} color={BRAND.primary} />
        </View>
      )}
    </View>
    <View className="flex-1">
      <View className="flex-row items-center">
        <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-gray-900"}`}>{item.name}</Text>
        {item.is_available ? (
           <View className="ml-2 w-2 h-2 rounded-full bg-green-500" />
        ) : (
           <View className="ml-2 w-2 h-2 rounded-full bg-amber-500" />
        )}
      </View>
      <Text className={`text-sm font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>{item.phone_number}</Text>
      <Text className={`text-[10px] mt-1 font-bold uppercase tracking-widest ${darkTheme ? "text-[#0ea5e9]" : "text-accentbg"}`}>
        {item.vehicle_type} • {item.plate_number}
      </Text>
      
      {/* Performance Stats */}
      <View className={`flex-row gap-4 mt-3 pt-3 border-t ${darkTheme ? "border-slate-800" : "border-slate-100"}`}>
        {item.rating != null && (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="star" size={14} color={BRAND.primary} />
            <Text className={`text-xs font-bold ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>
              {item.rating?.toFixed(1) || "N/A"}
            </Text>
          </View>
        )}
        {item.total_deliveries != null && (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="cube-outline" size={14} color={BRAND.primary} />
            <Text className={`text-xs font-bold ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>
              {item.total_deliveries || 0} trips
            </Text>
          </View>
        )}
        {item.distance_km != null && (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="navigate-outline" size={14} color={BRAND.primary} />
            <Text className={`text-xs font-bold ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>
              {item.distance_km?.toFixed(1)} km
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row mt-4 gap-3">
         {item.status === "pending" && (
           <>
             <PressableScale disabled={actioningRider === item.deliverer_id} onPress={() => handleAction(item.deliverer_id, "reject")} className={`flex-1 py-3 rounded-[12px] border ${darkTheme ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"} items-center`}>
               <Text className={`font-bold text-sm ${darkTheme ? "text-white" : "text-slate-700"}`}>{actioningRider === item.deliverer_id ? "..." : "Reject"}</Text>
             </PressableScale>
             <PressableScale disabled={actioningRider === item.deliverer_id} onPress={() => handleAction(item.deliverer_id, "approve")} className={`flex-1 py-3 rounded-[12px] ${actioningRider === item.deliverer_id ? "bg-accentbg/60" : "bg-accentbg"} items-center shadow-sm`}>
               <Text className="text-white font-bold text-sm">{actioningRider === item.deliverer_id ? "..." : "Approve"}</Text>
             </PressableScale>
           </>
         )}
         {item.status === "approved" && (
             <PressableScale disabled={actioningRider === item.deliverer_id} onPress={() => handleAction(item.deliverer_id, "suspend")} className={`flex-1 py-3 rounded-[16px] ${actioningRider === item.deliverer_id ? "bg-amber-500/5" : "bg-amber-500/10"} border border-amber-500/20 items-center`}>
               <Text className="text-amber-500 font-bold text-sm uppercase tracking-wider">{actioningRider === item.deliverer_id ? "..." : "Suspend Access"}</Text>
             </PressableScale>
         )}
         {item.status === "suspended" && (
             <PressableScale disabled={actioningRider === item.deliverer_id} onPress={() => handleAction(item.deliverer_id, "approve")} className={`flex-1 py-3 rounded-[16px] ${actioningRider === item.deliverer_id ? "bg-green-500/5" : "bg-green-500/10"} border border-green-500/20 items-center`}>
               <Text className="text-green-500 font-bold text-sm uppercase tracking-wider">{actioningRider === item.deliverer_id ? "..." : "Restore Access"}</Text>
             </PressableScale>
         )}
      </View>
    </View>
  </View>
));

export default function RiderManagement() {
  const { currentTheme } = useContext<any>(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();
  const { data: vendorProfile } = useVendorProfile();

  React.useEffect(() => {
      if (vendorProfile?.role === "staff") {
          Toast.error("Access Denied", "Staff members cannot access Rider Management.");
          router.replace("/(screens)");
      }
  }, [vendorProfile]);
  
  const [riders, setRiders] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("Pending");
  const [actioningRider, setActioningRider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"none" | "rating" | "trips">("none");

  const filteredRiders = riders
    .filter(r => r.status.toLowerCase() === filter.toLowerCase())
    .filter(r => !searchQuery || (r.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (r.phone_number || "").includes(searchQuery))
    .sort((a, b) => {
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "trips") return (b.total_deliveries || 0) - (a.total_deliveries || 0);
      return 0;
    });

  const fetchRiders = async () => {
    const token = await getToken();
    try {
      const res = await fetch(VendorApiRoutes.GetMyRiders.path, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRiders(data);
      }
    } catch (e) {
      if (__DEV__) console.error(e);
    } finally {
      setInitialLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRiders();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchRiders();
  }, []);

  const handleAction = useCallback(async (delivererId: string, action: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (actioningRider === delivererId) return;
    const rider = riders.find(r => r.deliverer_id === delivererId);
    const riderName = rider?.name || `Rider #${delivererId.substring(0, 8)}`;
    const actionMessages: Record<string, { title: string; message: string }> = {
      approve: { title: "Approve Rider", message: `Approve ${riderName} to start delivering for your store?` },
      reject: { title: "Reject Rider", message: `Reject ${riderName}'s request? They will need to re-apply.` },
      suspend: { title: "Suspend Rider", message: `Suspend ${riderName}'s access? They won't be able to receive new orders.` },
    };
    const msg = actionMessages[action] || { title: `Confirm ${action}`, message: `Are you sure you want to ${action} this rider?` };
    Popup.show({
      title: msg.title,
      message: msg.message,
      cancelText: "Cancel",
      confirmText: action === "reject" || action === "suspend" ? `Yes, ${action}` : "Confirm",
      isDestructive: action === "reject" || action === "suspend",
      onConfirm: async () => {
          Popup.hide();
          setActioningRider(delivererId);
          const token = await getToken();
          try {
            const res = await fetch(VendorApiRoutes.ManageRider.path, {
              method: VendorApiRoutes.ManageRider.method,
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ deliverer_id: delivererId, action })
            });

            if (res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Toast.success("Success", `${riderName} has been ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended"}.`);
              fetchRiders();
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Toast.error("Error", "Action failed. Please try again.");
            }
          } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Toast.error("Network Error", "Please check your connection.");
          } finally {
            setActioningRider(null);
          }
        }
    });
  }, [actioningRider, getToken, riders]);

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

      {/* Header */}
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
                <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Fleet Management</Text>
                <Text className={`text-xs font-semibold mt-0.5 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Manage your assigned riders</Text>
            </View>
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-5 pt-2 pb-3">
        <View className={`flex-row items-center px-4 h-[48px] rounded-2xl border ${darkTheme ? "bg-black border-gray-800" : "bg-white border-gray-200"}`}>
          <Ionicons name="search" size={18} color={darkTheme ? "#64748b" : "#9ca3af"} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search riders by name or phone..."
            placeholderTextColor={darkTheme ? "#64748b" : "#9ca3af"}
            className={`flex-1 ml-3 text-base font-medium ${darkTheme ? "text-white" : "text-black"}`}
          />
          {searchQuery.length > 0 && (
            <PressableScale onPress={() => { setSearchQuery(""); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Ionicons name="close-circle" size={18} color={darkTheme ? "#64748b" : "#9ca3af"} />
            </PressableScale>
          )}
        </View>
      </View>

      {/* Filter Chips + Sort Toggles */}
      <View className="flex-row px-5 py-3 gap-2 flex-wrap">
        {["Pending", "Approved", "Suspended"].map(f => (
          <PressableScale
            key={f}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f);
            }}
            className={`px-5 py-2.5 rounded-full border ${filter === f ? "bg-accentbg border-accentbg" : darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100 shadow-sm"}`}
          >
            <Text className={`font-bold ${filter === f ? "text-white" : darkTheme ? "text-slate-300" : "text-slate-600"}`}>{f}</Text>
          </PressableScale>
        ))}
        <View className="flex-1" />
        <PressableScale
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortBy(sortBy === "rating" ? "none" : "rating"); }}
          className={`px-3.5 py-2.5 rounded-full border flex-row items-center gap-1.5 ${sortBy === "rating" ? "bg-accentbg/10 border-accentbg" : darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`}
        >
          <Ionicons name="star" size={12} color={sortBy === "rating" ? BRAND.primary : (darkTheme ? "#94a3b8" : "#64748b")} />
          <Text className={`text-xs font-bold ${sortBy === "rating" ? "text-accentbg" : darkTheme ? "text-slate-400" : "text-slate-500"}`}>Rating</Text>
        </PressableScale>
        <PressableScale
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortBy(sortBy === "trips" ? "none" : "trips"); }}
          className={`px-3.5 py-2.5 rounded-full border flex-row items-center gap-1.5 ${sortBy === "trips" ? "bg-accentbg/10 border-accentbg" : darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`}
        >
          <Ionicons name="cube-outline" size={12} color={sortBy === "trips" ? BRAND.primary : (darkTheme ? "#94a3b8" : "#64748b")} />
          <Text className={`text-xs font-bold ${sortBy === "trips" ? "text-accentbg" : darkTheme ? "text-slate-400" : "text-slate-500"}`}>Trips</Text>
        </PressableScale>
      </View>

      {/* List */}
      <View style={{ flex: 1 }}>
        <FlashList
          data={filteredRiders}
          keyExtractor={(item: any) => item.registry_id || Math.random().toString()}
          // @ts-ignore
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkTheme ? "white" : "black"} />}
          ListEmptyComponent={
            initialLoading ? (
              <View className="pt-2 gap-4">
                 {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} width="100%" height={180} borderRadius={24} />
                 ))}
              </View>
            ) : (
              <View className="items-center justify-center pt-24">
                <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 shadow-sm border ${darkTheme ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                   <Ionicons name="people" size={48} color={BRAND.primary} />
                </View>
                <Text className={`text-xl mt-2 font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>
                  No {filter.toLowerCase()} riders
                </Text>
                <Text className={`text-sm mt-2 text-center px-10 font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  When a rider requests to join your fleet, they will appear here.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <RiderCard 
              item={item} 
              darkTheme={darkTheme} 
              actioningRider={actioningRider} 
              handleAction={handleAction} 
            />
          )}
        />
      </View>
    </SafeAreaView>
  );
}
