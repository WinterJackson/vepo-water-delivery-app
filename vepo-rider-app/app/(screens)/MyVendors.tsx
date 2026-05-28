import React, { useContext, useEffect, useState } from "react";
import { View, Text, StatusBar, FlatList, RefreshControl, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import RiderApiRoutes from "@/API/routes/RiderApiRoutes";
import { Toast } from "@/lib/toast";
import { BRAND } from "@/constants/brandColors";
import { Ionicons } from "@expo/vector-icons";
import { FlashList as OriginalFlashList } from "@shopify/flash-list";
import { Popup } from "@/lib/popup";
import { RiderDiscoverVendorCardSkeleton } from "@/components/skeletons/ContextualSkeletons";

const FlashList = OriginalFlashList as any;

export default function MyVendors() {
  const { currentTheme } = useContext<any>(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const fetchRegisteredVendors = async () => {
    const token = await getToken();
    try {
      const res = await fetch(RiderApiRoutes.RegisteredVendors.path, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      } else {
        Toast.error("Error", "Failed to fetch vendors");
      }
    } catch (e) {
      if (__DEV__) console.error(e);
      Toast.error("Error", "Network connection failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRegisteredVendors();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRegisteredVendors();
  };

  const handleWithdraw = async (vendorId: string, businessName: string) => {
    Popup.show({
      title: "Withdraw Application",
      message: `Are you sure you want to withdraw your application to ${businessName}?`,
      cancelText: "Cancel",
      confirmText: "Withdraw",
      isDestructive: true,
      onConfirm: async () => {
          Popup.hide();
          setWithdrawingId(vendorId);
          try {
            const token = await getToken();
            const route = RiderApiRoutes.WithdrawApplication(vendorId);
            const res = await fetch(route.path, {
              method: route.method,
              headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
              Toast.success("Success", "Application withdrawn");
              setVendors(prev => prev.filter(v => v.vendor_id !== vendorId));
            } else {
              const data = await res.json();
              Toast.error("Cannot Withdraw", data.detail || "Action failed");
            }
          } catch (e) {
            Toast.error("Error", "Network connection failed");
          } finally {
            setWithdrawingId(null);
          }
        }
    });
  };

  const renderStatusBadge = (status: string) => {
    let bgColor = darkTheme ? "bg-yellow-500/20" : "bg-yellow-100";
    let textColor = darkTheme ? "text-yellow-400" : "text-yellow-700";
    let iconName: keyof typeof Ionicons.glyphMap = "time-outline";
    let statusText = "Pending";

    if (status === "approved") {
      bgColor = darkTheme ? "bg-green-500/20" : "bg-green-100";
      textColor = darkTheme ? "text-green-400" : "text-green-700";
      iconName = "checkmark-circle-outline";
      statusText = "Approved";
    } else if (status === "rejected") {
      bgColor = darkTheme ? "bg-red-500/20" : "bg-red-100";
      textColor = darkTheme ? "text-red-400" : "text-red-700";
      iconName = "close-circle-outline";
      statusText = "Rejected";
    }

    return (
      <View className={`flex-row items-center px-3 py-1 rounded-full ${bgColor}`}>
        <Ionicons name={iconName} size={14} color={darkTheme ? (status === 'approved' ? '#4ade80' : status === 'rejected' ? '#f87171' : '#facc15') : (status === 'approved' ? '#15803d' : status === 'rejected' ? '#b91c1c' : '#a16207')} />
        <Text className={`text-xs font-semibold ml-1 ${textColor}`}>
          {statusText}
        </Text>
      </View>
    );
  };

  const renderVendor = ({ item }: { item: any }) => {
    const isWithdrawing = withdrawingId === item.vendor_id;

    return (
      <View className={`p-4 mb-4 rounded-2xl border ${darkTheme ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm"}`}>
        <View className="flex-row items-center">
          <View className={`w-14 h-14 rounded-xl overflow-hidden border ${darkTheme ? "border-gray-800" : "border-gray-100"}`}>
            {item.profile_pic ? (
              <Image source={{ uri: item.profile_pic }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className={`w-full h-full items-center justify-center ${darkTheme ? "bg-gray-800" : "bg-white"}`}>
                <Ionicons name="business-outline" size={24} color={BRAND.gray400} />
              </View>
            )}
          </View>
          
          <View className="flex-1 ml-4">
            <Text className={`text-base font-bold mb-1 ${darkTheme ? "text-white" : "text-gray-900"}`} numberOfLines={1}>
              {item.business_name}
            </Text>
            <View className="flex-row items-center mb-2">
              <Ionicons name="location-outline" size={14} color={BRAND.gray400} />
              <Text className={`text-xs ml-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`} numberOfLines={1}>
                {item.address || "No address provided"}
              </Text>
            </View>
            <View className="self-start">
              {renderStatusBadge(item.status)}
            </View>
          </View>
        </View>

        {item.status === "pending" && (
          <TouchableOpacity
            onPress={() => handleWithdraw(item.vendor_id, item.business_name)}
            disabled={isWithdrawing}
            className={`mt-4 py-3 rounded-xl border flex-row justify-center items-center ${darkTheme ? "border-red-900/50 bg-red-900/20" : "border-red-100 bg-red-50"}`}
          >
            {isWithdrawing ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text className="text-red-500 font-semibold ml-2">Withdraw Application</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {item.status === "approved" && (
          <TouchableOpacity
            className={`mt-4 py-3 rounded-xl flex-row justify-center items-center ${darkTheme ? "bg-gray-800" : "bg-white"}`}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={BRAND.primary} />
            <Text className={`font-semibold ml-2 ${darkTheme ? "text-white" : "text-black"}`}>Contact Vendor</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : "bg-[#f8f9fa]"}`}>
      <StatusBar translucent backgroundColor="transparent" barStyle={darkTheme ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View 
          className="flex-row items-center px-4 py-3 pb-4"
          style={{ 
              backgroundColor: darkTheme ? "#000" : "#fff",
              borderBottomWidth: 1, 
              borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
              ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }),
              zIndex: 10
          }}
      >
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <BackButtonMinimal />
          </TouchableOpacity>
          <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
              My Vendors
          </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 px-4 pt-4">
           {[1, 2, 3, 4, 5].map(i => <RiderDiscoverVendorCardSkeleton key={i} />)}
        </View>
      ) : vendors.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 ${darkTheme ? "bg-gray-900" : "bg-white"}`}>
            <Ionicons name="briefcase-outline" size={48} color={BRAND.gray400} />
          </View>
          <Text className={`text-xl font-bold mb-2 text-center ${darkTheme ? "text-white" : "text-gray-900"}`}>
            No Vendors Yet
          </Text>
          <Text className={`text-center mb-8 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
            You haven't applied to any vendors. Go to the Discover Vendors page to find water suppliers near your operation base.
          </Text>
          <TouchableOpacity 
            onPress={() => router.push("/(screens)/DiscoverVendors")}
            className="px-8 py-4 rounded-xl"
            style={{ backgroundColor: BRAND.primary }}
          >
            <Text className="text-white font-bold text-base">Discover Vendors</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 px-4 pt-4">
          <FlashList
            data={vendors}
            renderItem={renderVendor}
            estimatedItemSize={150}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={BRAND.primary}
                colors={[BRAND.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
