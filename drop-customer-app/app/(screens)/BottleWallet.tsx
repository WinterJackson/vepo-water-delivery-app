import { ROUTES } from "@/API/routes/ApiRoutes";
import { PressableScale } from "@/components/ui/PressableScale";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useContext, useEffect, useState } from "react";
import { BRAND } from "@/constants/brandColors";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottleWalletSkeleton } from "@/components/skeletons/ContextualSkeletons";

interface WalletData {
  bottle_purchased_at: string | null;
  bottle_refill_count: number;
}

export default function BottleWallet() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = async () => {
    const token = await getToken();
    try {
      const res = await fetch(ROUTES.GET_USER_DETAILS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWallet({
          bottle_purchased_at: data.bottle_purchased_at || null,
          bottle_refill_count: data.bottle_refill_count || 0,
        });
      }
    } catch (e) {
      if (__DEV__) console.error("Failed to fetch wallet data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWallet();
    setRefreshing(false);
  }, []);

  const daysSincePurchase = wallet?.bottle_purchased_at
    ? Math.floor((Date.now() - new Date(wallet.bottle_purchased_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (loading) {
    return (
      <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
        <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />
        <View style={{ overflow: "hidden", paddingBottom: 4 }}>
          <View 
              className="pt-4 pb-4 mb-2 flex-row items-center px-4"
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
              <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>
                My Bottles
              </Text>
              <Text className={`text-sm mt-0.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                Your refill history & loyalty
              </Text>
            </View>
          </View>
        </View>
        <BottleWalletSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={{ overflow: "hidden", paddingBottom: 4 }}>
        <View 
            className="pt-4 pb-4 mb-2 flex-row items-center"
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
            <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>
              My Bottles
            </Text>
            <Text className={`text-sm mt-0.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
              Your refill history & loyalty
            </Text>
          </View>
        </View>
        </View>

        {/* Hero Balance Card */}
        <View className="mt-6 p-6 rounded-3xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 border border-sky-500/20">
          <Text className={`text-sm ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Lifetime Refills</Text>
          <View className="flex-row items-end mt-1">
            <Text className={`text-5xl font-black ${darkTheme ? "text-white" : "text-gray-900"}`}>
              {wallet?.bottle_refill_count || 0}
            </Text>
            <Text className={`text-lg ml-2 mb-1.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
              refills
            </Text>
          </View>
          <Text className={`text-xs mt-2 ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
            Track how much plastic you've saved by reusing your Drop bottles!
          </Text>
        </View>

        {/* Metric Cards */}
        <View className="flex-row mt-4 gap-3">
          <View className={`flex-1 p-5 rounded-2xl ${darkTheme ? "bg-white/5" : "bg-white"}`}>
            <Text style={{ fontSize: 28 }}>📅</Text>
            <Text className={`text-xl font-black mt-2 ${darkTheme ? "text-white" : "text-gray-900"}`}>
              {daysSincePurchase !== null ? `${daysSincePurchase} Days` : "No bottle"}
            </Text>
            <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
              Since your first bottle
            </Text>
          </View>
          <View className={`flex-1 p-5 rounded-2xl ${darkTheme ? "bg-white/5" : "bg-white"}`}>
            <Text style={{ fontSize: 28 }}>🌱</Text>
            <Text className={`text-xl font-black mt-2 ${darkTheme ? "text-white" : "text-gray-900"}`}>
              {wallet?.bottle_refill_count ? (wallet.bottle_refill_count * 0.5).toFixed(1) : 0} kg
            </Text>
            <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
              Plastic Waste Saved
            </Text>
          </View>
        </View>



        {/* How It Works Section */}
        <View className="mt-8 mb-2">
          <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-gray-900"}`}>
            How It Works
          </Text>
        </View>

        <View className="gap-3 pb-8">
          <View className={`p-4 rounded-2xl border flex-row items-start gap-3 ${darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <Text style={{ fontSize: 24 }}>1️⃣</Text>
            <View className="flex-1">
              <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>Your First Bottle</Text>
              <Text className={`text-sm mt-0.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                Your first order includes a 30% discount on the bottle purchase to welcome you to Drop!
              </Text>
            </View>
          </View>

          <View className={`p-4 rounded-2xl border flex-row items-start gap-3 ${darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <Text style={{ fontSize: 24 }}>2️⃣</Text>
            <View className="flex-1">
              <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>Quick Swap</Text>
              <Text className={`text-sm mt-0.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                For all future orders, simply hand over your empty bottle to the rider in exchange for a full one. Standard delivery fees apply.
              </Text>
            </View>
          </View>

          <View className={`p-4 rounded-2xl border flex-row items-start gap-3 ${darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
            <Text style={{ fontSize: 24 }}>3️⃣</Text>
            <View className="flex-1">
              <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>Keep My Bottle</Text>
              <Text className={`text-sm mt-0.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                Need an extra bottle but don't have an empty to return? No worries, select 'Keep My Bottle' at checkout (+KSH 20 delivery premium).
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
