import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import PressableScale from "@/components/ui/PressableScale";
import { BRAND } from "@/constants/brandColors";
import { UIThemeContext } from "@/context/ThemeContext";
import { Toast } from "@/lib/toast";
import { useAuth } from "@clerk/clerk-expo";
import React, { useCallback, useContext, useEffect, useState, memo } from "react";
import {
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import * as Haptics from "expo-haptics";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { useRouter } from "expo-router";
import { DataFallbackUI } from "@/components/ui/DataFallbackUI";

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

const statusColor = (status: string, darkTheme: boolean) => {
  switch (status) {
    case "open": return "text-accentbg";
    case "settled": return "text-[#10b981]";
    case "discrepancy": return "text-red-500";
    default: return darkTheme ? "text-slate-400" : "text-slate-500";
  }
};

const statusBg = (status: string, darkTheme: boolean) => {
  switch (status) {
    case "open": return "bg-accentbg/10 border-accentbg/20";
    case "settled": return "bg-[#10b981]/10 border-[#10b981]/20";
    case "discrepancy": return "bg-red-500/10 border-red-500/20";
    default: return darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100";
  }
};

const SettledRemittanceCard = memo(({ gp, darkTheme }: { gp: RemittanceItem, darkTheme: boolean }) => (
  <View className={`p-5 mb-4 rounded-[24px] border shadow-sm ${statusBg(gp.status, darkTheme)}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
    <View className="flex-row justify-between items-center">
      <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-slate-900"}`}>
        Rider #{gp.deliverer_id.substring(0, 8)}
      </Text>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusColor(gp.status, darkTheme)}`}>
        {gp.status}
      </Text>
    </View>
    <View className={`flex-row mt-4 gap-4 justify-between p-3 rounded-[16px] ${darkTheme ? "bg-white/5" : "bg-black/5"}`}>
      <View className="items-center flex-1">
        <Text className={`text-xs mb-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Out</Text>
        <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{gp.full_bottles_out}</Text>
      </View>
      <View className="items-center flex-1">
        <Text className={`text-xs mb-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Ret.</Text>
        <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{gp.full_bottles_returned}</Text>
      </View>
      <View className="items-center flex-1">
        <Text className={`text-xs mb-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Empties</Text>
        <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{gp.empty_bottles_collected}</Text>
      </View>
      <View className="items-center flex-[1.5]">
        <Text className={`text-xs mb-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Cash</Text>
        <Text className={`font-bold text-[#10b981]`}>KSH {Number(gp.cash_collected).toLocaleString()}</Text>
      </View>
    </View>
    <Text className={`text-xs mt-3 text-right font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>
      {new Date(gp.created_at).toLocaleDateString()}
    </Text>
  </View>
));

const ActiveRemittanceCard = memo(({ 
  gp, darkTheme, closingId, setClosingId, handleClose, submitting,
  fullReturned, setFullReturned, emptiesCollected, setEmptiesCollected, cashCollected, setCashCollected
}: any) => {
  const handleReturnedChange = (text: string) => {
    setFullReturned(text);
    const returned = parseInt(text) || 0;
    const sold = Math.max(0, gp.full_bottles_out - returned);
    const pricePerBottle = gp.full_bottles_out > 0 ? (gp.cash_expected / gp.full_bottles_out) : 0;
    const expected = sold * pricePerBottle;
    setCashCollected(expected.toString());
  };

  return (
  <View className={`p-5 mb-4 rounded-[24px] border shadow-sm ${statusBg(gp.status, darkTheme)}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
    <View className="flex-row justify-between items-center">
      <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-slate-900"}`}>
        Rider #{gp.deliverer_id.substring(0, 8)}
      </Text>
      <View className="bg-accentbg/20 px-3 py-1 rounded-full border border-accentbg/30">
        <Text className="text-accentbg font-bold text-[10px] uppercase">Active</Text>
      </View>
    </View>
    <Text className={`text-sm mt-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-600"}`}>
      {gp.full_bottles_out} bottles out <Text className="font-normal text-slate-400">· Started {new Date(gp.created_at).toLocaleTimeString()}</Text>
    </Text>
    <Text className={`text-xs mt-1 font-bold ${darkTheme ? "text-slate-500" : "text-slate-500"}`}>
      Expected Base Cash: KSH {gp.cash_expected}
    </Text>

    {closingId === gp.id ? (
      <View className="mt-5 pt-5 border-t border-accentbg/20 gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className={`text-[10px] mb-1 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Returned</Text>
            <TextInput value={fullReturned} onChangeText={handleReturnedChange} keyboardType="numeric" placeholder="0"
              placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
              className={`p-3 rounded-[12px] border text-center font-bold text-lg ${darkTheme ? "bg-slate-800 border-slate-700 text-white focus:border-accentbg" : "bg-white border-slate-200 text-slate-900 focus:border-accentbg"}`}
            />
          </View>
          <View className="flex-1">
            <Text className={`text-[10px] mb-1 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Empties</Text>
            <TextInput value={emptiesCollected} onChangeText={setEmptiesCollected} keyboardType="numeric" placeholder="0"
              placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
              className={`p-3 rounded-[12px] border text-center font-bold text-lg ${darkTheme ? "bg-slate-800 border-slate-700 text-white focus:border-accentbg" : "bg-white border-slate-200 text-slate-900 focus:border-accentbg"}`}
            />
          </View>
          <View className="flex-[1.5]">
            <Text className={`text-[10px] mb-1 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Cash (KSH)</Text>
            <TextInput value={cashCollected} onChangeText={setCashCollected} keyboardType="decimal-pad" placeholder="0"
              placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
              className={`p-3 rounded-[12px] border text-center font-bold text-lg text-[#10b981] ${darkTheme ? "bg-slate-800 border-slate-700 focus:border-[#10b981]" : "bg-white border-slate-200 focus:border-[#10b981]"}`}
            />
          </View>
        </View>
        <View className="flex-row gap-3 mt-2">
          <PressableScale onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setClosingId(null); }} className={`flex-1 py-3.5 rounded-[16px] items-center border ${darkTheme ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-700"}`}>Cancel</Text>
          </PressableScale>
          <PressableScale onPress={handleClose} disabled={submitting} className="flex-[1.5] py-3.5 rounded-[16px] items-center bg-[#10b981] shadow-sm">
            <Text className="text-white font-bold text-base">{submitting ? "..." : "Settle Remittance"}</Text>
          </PressableScale>
        </View>
      </View>
    ) : (
      <PressableScale onPress={() => { 
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
        setClosingId(gp.id); 
        setFullReturned("0");
        setEmptiesCollected(gp.full_bottles_out.toString()); // default assumption
        setCashCollected(gp.cash_expected.toString());
      }} className="mt-5 py-3.5 rounded-[16px] items-center bg-[#10b981]/10 border border-[#10b981]/20">
        <Text className="text-[#10b981] font-bold text-sm uppercase tracking-wider">Settle This Rider</Text>
      </PressableScale>
    )}
  </View>
)});

export default function VendorRemittanceDashboard() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();

  const [remittancees, setRemittancees] = useState<RemittanceItem[]>([]);
  const [myRiders, setMyRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);

  // New gate pass form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDelivererId, setNewDelivererId] = useState("");
  const [newBottlesOut, setNewBottlesOut] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Close form
  const [closingId, setClosingId] = useState<string | null>(null);
  const [fullReturned, setFullReturned] = useState("");
  const [emptiesCollected, setEmptiesCollected] = useState("");
  const [cashCollected, setCashCollected] = useState("");

  const fetchVendorId = async () => {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(VendorApiRoutes.GetProfile.path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVendorId(data.id);
        return data.id;
      }
    } catch (e) {
      if (__DEV__) console.error("Failed to fetch vendor profile", e);
    }
    return null;
  };

  const fetchMyRiders = async () => {
    const token = await getToken();
    try {
      const res = await fetch(VendorApiRoutes.GetMyRiders.path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyRiders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      if (__DEV__) console.error("Error fetching my riders", e);
    }
  };

  const fetchRemittancees = async (id?: string) => {
    const vid = id || vendorId;
    if (!vid) return;
    const token = await getToken();
    try {
      const route = VendorApiRoutes.GetVendorRemittances(vid);
      const res = await fetch(route.path, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setRemittancees(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      if (__DEV__) console.error("Error fetching gate passes", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRemittance = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!vendorId || !newDelivererId.trim() || !newBottlesOut.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.error("Missing Info", "Please fill in the Rider ID and bottle count.");
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    try {
      const res = await fetch(VendorApiRoutes.StartRemittance.path, {
        method: VendorApiRoutes.StartRemittance.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverer_id: newDelivererId.trim(),
          vendor_id: vendorId,
          full_bottles_out: parseInt(newBottlesOut) || 0,
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.success("Remittance Created", "Rider has been checked out successfully.");
        setShowNewForm(false);
        setNewDelivererId("");
        setNewBottlesOut("");
        await fetchRemittancees();
      } else {
        const err = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Toast.error("Error", err.detail || "Failed to create gate pass.");
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.error("Network Error", "Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!closingId) return;
    setSubmitting(true);
    const token = await getToken();
    try {
      const route = VendorApiRoutes.CloseRemittance(closingId);
      const res = await fetch(route.path, {
        method: route.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          full_bottles_returned: parseInt(fullReturned) || 0,
          empty_bottles_collected: parseInt(emptiesCollected) || 0,
          cash_collected: parseFloat(cashCollected) || 0,
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.success("Settled", "Gate pass has been closed successfully.");
        setClosingId(null);
        setFullReturned("");
        setEmptiesCollected("");
        setCashCollected("");
        await fetchRemittancees();
      } else {
        const err = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Toast.error("Error", err.detail || "Failed to settle gate pass.");
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.error("Network Error", "Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const [riderSearch, setRiderSearch] = useState("");

  useEffect(() => {
    (async () => {
      const id = await fetchVendorId();
      if (id) await fetchRemittancees(id);
      await fetchMyRiders();
      setLoading(false);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRemittancees(), fetchMyRiders()]);
    setRefreshing(false);
  }, [vendorId]);

  const openPasses = remittancees.filter((g) => g.status === "open");
  const closedPasses = remittancees.filter((g) => g.status !== "open");

  const renderClosedItem = useCallback(({ item }: { item: RemittanceItem }) => (
    <SettledRemittanceCard gp={item} darkTheme={darkTheme} />
  ), [darkTheme]);

  if (!vendorId && !loading) {
    return (
      <DataFallbackUI 
        title="Vendor Data Unavailable"
        message="We couldn't load your vendor dashboard. Please retry to connect."
        onRetry={async () => {
          setLoading(true);
          const id = await fetchVendorId();
          if (id) await fetchRemittancees(id);
          await fetchMyRiders();
          setLoading(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

      {/* Fixed Top Header */}
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
              Vendor Remittance Ledger
            </Text>
            <Text className={`text-xs mt-0.5 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
              Track rider bottle accountability
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FlashList
          data={closedPasses}
          keyExtractor={(item: any) => item.id}
          // @ts-ignore
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkTheme ? "white" : "black"} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          ListHeaderComponent={
            <View>
              {/* Actions Header */}
              <View className="pt-4 pb-2 flex-row justify-end items-center">
                <PressableScale
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowNewForm(!showNewForm);
                  }}
                  className={`px-5 py-2.5 rounded-full shadow-sm ${showNewForm ? (darkTheme ? "bg-slate-800" : "bg-slate-200") : "bg-accentbg"}`}
                >
                  <Text className={`font-bold text-sm ${showNewForm ? (darkTheme ? "text-white" : "text-slate-900") : "text-white"}`}>
                    {showNewForm ? "Cancel" : "+ New"}
                  </Text>
                </PressableScale>
              </View>

              {/* New Remittance Form */}
              {showNewForm && (
                <View className={`mt-4 p-5 rounded-[24px] border shadow-sm ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <Text className={`font-bold text-lg mb-4 ${darkTheme ? "text-white" : "text-slate-900"}`}>
                    Check Out Rider
                  </Text>
                  <View className="gap-3">
                    <View>
                      <Text className={`text-[10px] mb-1 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Select Rider</Text>
                      {myRiders.filter(r => r.status === "approved").length > 0 ? (
                        <View>
                          <TextInput
                            value={riderSearch}
                            onChangeText={setRiderSearch}
                            placeholder="Search rider by name..."
                            placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                            className={`p-3.5 rounded-[16px] border font-medium text-base ${darkTheme ? "bg-slate-800 border-slate-700 text-white focus:border-accentbg" : "bg-white border-slate-200 text-slate-900 focus:border-accentbg"}`}
                          />
                          <ScrollView style={{ maxHeight: 160 }} className="mt-2" showsVerticalScrollIndicator={false} nestedScrollEnabled>
                            {myRiders
                              .filter(r => r.status === "approved")
                              .filter(r => !riderSearch || (r.name || "").toLowerCase().includes(riderSearch.toLowerCase()))
                              .map(r => (
                                <PressableScale
                                  key={r.deliverer_id}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setNewDelivererId(r.deliverer_id);
                                    setRiderSearch(r.name || r.deliverer_id.substring(0, 8));
                                  }}
                                  className={`p-3 mb-1.5 rounded-[12px] border flex-row items-center ${
                                    newDelivererId === r.deliverer_id
                                      ? "border-accentbg bg-accentbg/10"
                                      : darkTheme ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <View className="w-8 h-8 rounded-full bg-accentbg/10 items-center justify-center mr-3">
                                    <Ionicons name="person" size={16} color={BRAND.primary} />
                                  </View>
                                  <View className="flex-1">
                                    <Text className={`font-bold text-sm ${darkTheme ? "text-white" : "text-slate-900"}`}>{r.name || "Unnamed"}</Text>
                                    <Text className={`text-[10px] font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>{r.phone_number} · {r.vehicle_type}</Text>
                                  </View>
                                  {newDelivererId === r.deliverer_id && (
                                    <Ionicons name="checkmark-circle" size={20} color={BRAND.primary} />
                                  )}
                                </PressableScale>
                              ))}
                          </ScrollView>
                        </View>
                      ) : (
                        <View className={`p-3.5 rounded-[16px] border items-center ${darkTheme ? "border-slate-700 bg-slate-800" : "border-slate-200"}`}>
                          <Text className={`text-sm font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>No approved riders available</Text>
                        </View>
                      )}
                    </View>
                    <View>
                      <Text className={`text-[10px] mb-1 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Full Bottles Out</Text>
                      <TextInput
                        value={newBottlesOut}
                        onChangeText={(text) => setNewBottlesOut(text.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="e.g. 20"
                        placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                        className={`p-3.5 rounded-[16px] border font-bold text-base ${darkTheme ? "bg-slate-800 border-slate-700 text-white focus:border-accentbg" : "bg-white border-slate-200 text-slate-900 focus:border-accentbg"}`}
                      />
                    </View>
                  </View>
                  <PressableScale
                    onPress={handleStartRemittance}
                    disabled={submitting || !newDelivererId || !newBottlesOut}
                    className={`mt-5 py-3.5 rounded-[16px] items-center shadow-sm ${submitting || !newDelivererId || !newBottlesOut ? "bg-accentbg/50" : "bg-accentbg"}`}
                  >
                    <Text className="text-white font-bold text-base">
                      {submitting ? "Creating..." : "Issue Remittance"}
                    </Text>
                  </PressableScale>
                </View>
              )}

              {/* Stats Summary */}
              <View className="flex-row mt-6 mb-6 gap-3">
                <View className={`flex-1 p-4 rounded-[20px] shadow-sm border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <Text className={`text-2xl font-black ${darkTheme ? "text-white" : "text-slate-900"}`}>
                    {openPasses.length}
                  </Text>
                  <Text className={`text-xs mt-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Active Shifts</Text>
                </View>
                <View className={`flex-1 p-4 rounded-[20px] shadow-sm border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <Text className={`text-2xl font-black ${darkTheme ? "text-white" : "text-slate-900"}`}>
                    {closedPasses.filter((g) => g.status === "settled").length}
                  </Text>
                  <Text className={`text-xs mt-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Settled Today</Text>
                </View>
                <View className={`flex-1 p-4 rounded-[20px] shadow-sm border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <Text className={`text-2xl font-black text-red-500`}>
                    {closedPasses.filter((g) => g.status === "discrepancy").length}
                  </Text>
                  <Text className={`text-xs mt-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Discrepancies</Text>
                </View>
              </View>

              {/* Active Passes */}
              {openPasses.length > 0 && (
                <>
                  <Text className={`font-bold text-xl mb-4 ${darkTheme ? "text-white" : "text-slate-900"}`}>
                    Active Riders
                  </Text>
                  <View className="gap-0 mb-6">
                    {openPasses.map((gp) => (
                      <ActiveRemittanceCard 
                        key={gp.id}
                        gp={gp}
                        darkTheme={darkTheme}
                        closingId={closingId}
                        setClosingId={setClosingId}
                        handleClose={handleClose}
                        submitting={submitting}
                        fullReturned={fullReturned}
                        setFullReturned={setFullReturned}
                        emptiesCollected={emptiesCollected}
                        setEmptiesCollected={setEmptiesCollected}
                        cashCollected={cashCollected}
                        setCashCollected={setCashCollected}
                      />
                    ))}
                  </View>
                </>
              )}

              <Text className={`font-bold text-xl mb-4 mt-2 ${darkTheme ? "text-white" : "text-gray-900"}`}>
                Settled History
              </Text>
            </View>
          }
          ListEmptyComponent={
              loading ? (
                <View className="py-6 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} width="100%" height={160} borderRadius={24} />
                  ))}
                </View>
              ) : closedPasses.length === 0 ? (
                <View className="py-16 items-center">
                  <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                    <Ionicons name="key-outline" size={48} color={BRAND.primary} />
                  </View>
                  <Text className={`text-lg mt-2 text-center font-bold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    No settled gate passes yet.
                  </Text>
                  <Text className={`text-sm mt-2 text-center px-10 font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>
                    Once a rider completes their deliveries and checks back in, their settlement record will appear here.
                  </Text>
                </View>
              ) : null
          }
          renderItem={renderClosedItem}
        />
      </View>
    </SafeAreaView>
  );
}
