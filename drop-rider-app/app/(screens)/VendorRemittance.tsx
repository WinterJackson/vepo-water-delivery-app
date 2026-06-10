import RiderApiRoutes from "@/API/routes/RiderApiRoutes";
import PressableScale from "@/components/ui/PressableScale";
import { UIThemeContext } from "@/context/ThemeContext";
import { Toast } from "@/lib/toast";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useContext, useEffect, useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useRiderProfile } from "@/hooks/queries/useRiderData";
import { BRAND } from "@/constants/brandColors";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { Ionicons } from "@expo/vector-icons";
import { RiderRemittanceSkeleton } from "@/components/skeletons/ContextualSkeletons";

interface RemittanceItem {
  id: string;
  vendor_id: string;
  deliverer_id: string;
  full_bottles_out: number;
  full_bottles_returned: number;
  empty_bottles_collected: number;
  cash_expected: number;
  cash_collected: number;
  status: "open" | "settled" | "discrepancy";
  created_at: string;
  updated_at: string;
}

export default function VendorRemittance() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();

  const [remittances, setRemittances] = useState<RemittanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Read riderId from react-query profile hook to ensure hydration
  const { data: profile, isLoading: isProfileLoading } = useRiderProfile();
  const riderId = profile?.id;

  // Close gate-pass form state
  const [closingId, setClosingId] = useState<string | null>(null);
  const [fullReturned, setFullReturned] = useState("");
  const [emptiesCollected, setEmptiesCollected] = useState("");
  const [cashCollected, setCashCollected] = useState("");
  const [submitting, setSubmitting] = useState(false);


  const fetchRemittances = async (id?: string) => {
    const delivererId = id || riderId;
    if (!delivererId) {
      setLoading(false);
      return;
    }
    const token = await getToken();
    try {
      const route = RiderApiRoutes.GetMyRemittances(delivererId);
      const res = await fetch(route.path, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setRemittances(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      if (__DEV__) console.error("Error fetching gate passes", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!closingId) return;
    const fr = parseInt(fullReturned) || 0;
    const ec = parseInt(emptiesCollected) || 0;
    const cc = parseFloat(cashCollected) || 0;

    setSubmitting(true);
    const token = await getToken();
    try {
      const route = RiderApiRoutes.CloseRemittance(closingId);
      const res = await fetch(route.path, {
        method: route.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          full_bottles_returned: fr,
          empty_bottles_collected: ec,
          cash_collected: cc,
        }),
      });
      if (res.ok) {
        Toast.success("Remittance Settled", "Your remittance to the vendor was successful.");
        setClosingId(null);
        setFullReturned("");
        setEmptiesCollected("");
        setCashCollected("");
        await fetchRemittances();
      } else {
        const err = await res.json();
        Toast.error("Error", err.detail || "Failed to close remittance ledger.");
      }
    } catch (e) {
      Toast.error("Network Error", "Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (riderId) {
      fetchRemittances(riderId);
    } else if (!isProfileLoading) {
      setLoading(false);
    }
  }, [riderId, isProfileLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRemittances();
    setRefreshing(false);
  }, [riderId]);

  const openPass = remittances.find((g) => g.status === "open");

  const statusColor = (status: string) => {
    switch (status) {
      case "open": return "text-accentbg";
      case "settled": return "text-green-500";
      case "discrepancy": return "text-red-500";
      default: return darkTheme ? "text-gray-400" : "text-gray-500";
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case "open": return "bg-accentbg/10 border-accentbg/20";
      case "settled": return "bg-green-500/10 border-green-500/20";
      case "discrepancy": return "bg-red-500/10 border-red-500/20";
      default: return darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-200";
    }
  };

  return (
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
              <TouchableOpacity onPress={() => router.back()} className="mr-4">
                  <BackButtonMinimal />
              </TouchableOpacity>
              <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                  Vendor Remittances
              </Text>
          </View>
      </View>
      <View className="px-5 pt-1 pb-3">
        <Text className={`text-sm mt-0.5 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
          Track your outstanding vendor remittances
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Active Gate Pass Banner */}
        {openPass && (
          <View className="mb-6 p-5 rounded-3xl bg-accentbg/10 border border-accentbg/20">
            <View className="flex-row justify-between items-start">
              <View>
                <View className="flex-row items-center">
                  <Ionicons name="ellipse" size={14} color={BRAND.primary} style={{ marginRight: 6 }} />
                  <Text className="text-accentbg font-bold text-lg">Active Remittance Ledger</Text>
                </View>
                <Text className={`text-sm mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                  {openPass.full_bottles_out} full bottles loaded
                </Text>
                <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                  Started {new Date(openPass.created_at).toLocaleString()}
                </Text>
              </View>
              <View className="bg-accentbg/20 px-3 py-1 rounded-full">
                <Text className="text-accentbg font-bold text-xs uppercase">Open</Text>
              </View>
            </View>

            {/* Close Form */}
            {closingId === openPass.id ? (
              <View className="mt-4 pt-4 border-t border-accentbg/20">
                <Text className={`font-bold mb-3 ${darkTheme ? "text-white" : "text-gray-900"}`}>Remit to Vendor</Text>
                <View className="gap-3">
                  <View>
                    <Text className={`text-xs mb-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Full Bottles Returned</Text>
                    <TextInput
                      value={fullReturned}
                      onChangeText={setFullReturned}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={darkTheme ? "#666" : "#aaa"}
                      className={`p-3 rounded-xl border ${darkTheme ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
                    />
                  </View>
                  <View>
                    <Text className={`text-xs mb-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Empty Bottles Collected</Text>
                    <TextInput
                      value={emptiesCollected}
                      onChangeText={setEmptiesCollected}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={darkTheme ? "#666" : "#aaa"}
                      className={`p-3 rounded-xl border ${darkTheme ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
                    />
                  </View>
                  <View>
                    <Text className={`text-xs mb-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Cash Collected (KSH)</Text>
                    <TextInput
                      value={cashCollected}
                      onChangeText={setCashCollected}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={darkTheme ? "#666" : "#aaa"}
                      className={`p-3 rounded-xl border ${darkTheme ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
                    />
                  </View>
                </View>
                <View className="flex-row gap-3 mt-4">
                  <PressableScale
                    onPress={() => setClosingId(null)}
                    className={`flex-1 py-3 rounded-xl items-center border ${darkTheme ? "border-white/10" : "border-gray-200"}`}
                  >
                    <Text className={`font-semibold ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Cancel</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={handleClose}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl items-center bg-accentbg"
                  >
                    <Text className="text-white font-bold">
                      {submitting ? "Submitting..." : "Submit Remittance"}
                    </Text>
                  </PressableScale>
                </View>
              </View>
            ) : (
              <PressableScale
                onPress={() => setClosingId(openPass.id)}
                className="mt-4 py-3 rounded-xl items-center bg-accentbg"
              >
                <Text className="text-white font-bold">Remit Inventory & Cash</Text>
              </PressableScale>
            )}
          </View>
        )}

        {/* History */}
        <Text className={`font-bold text-lg mb-3 ${darkTheme ? "text-white" : "text-gray-900"}`}>
          History
        </Text>

        {loading ? (
          <RiderRemittanceSkeleton />
        ) : remittances.filter((g) => g.status !== "open").length === 0 ? (
          <View className="py-12 items-center">
            <Ionicons name="clipboard-outline" size={48} color={BRAND.primary} />
            <Text className={`text-base mt-4 text-center ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
              No completed remittances yet.
            </Text>
          </View>
        ) : (
          <View className="gap-3 pb-8">
            {remittances
              .filter((g) => g.status !== "open")
              .map((gp) => (
                <View
                  key={gp.id}
                  className={`p-4 rounded-2xl border ${statusBg(gp.status)}`}
                >
                  <View className="flex-row justify-between items-center">
                    <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>
                      Ledger #{gp.id.substring(0, 8)}
                    </Text>
                    <Text className={`text-xs font-bold uppercase ${statusColor(gp.status)}`}>
                      {gp.status}
                    </Text>
                  </View>
                  <View className="flex-row mt-2 gap-4">
                    <View>
                      <Text className={`text-xs ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>Out</Text>
                      <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>{gp.full_bottles_out}</Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>Returned</Text>
                      <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>{gp.full_bottles_returned}</Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>Empties</Text>
                      <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>{gp.empty_bottles_collected}</Text>
                    </View>
                    <View>
                      <Text className={`text-xs ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>Cash</Text>
                      <Text className={`font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>KSH {Number(gp.cash_collected).toLocaleString()}</Text>
                    </View>
                  </View>
                  <Text className={`text-xs mt-2 ${darkTheme ? "text-gray-600" : "text-gray-400"}`}>
                    {new Date(gp.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
