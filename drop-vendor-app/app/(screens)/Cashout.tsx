import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/lib/toast";
import PressableScale from "@/components/ui/PressableScale";
import { FlashList } from "@shopify/flash-list";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import * as Haptics from "expo-haptics";
import { BRAND, TOAST } from "@/constants/brandColors";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";

interface BalanceMetrics {
  lifetime_earnings: number;
  pending_payouts: number;
  completed_payouts: number;
  available_balance: number;
  minimum_threshold?: number;
  transaction_fee?: number;
}

interface PayoutLog {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

const PayoutItem = React.memo(({ item, darkTheme }: { item: PayoutLog, darkTheme: boolean }) => (
  <View className={`p-5 rounded-[20px] mb-3 flex-row justify-between items-center shadow-sm border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
    <View className="flex-row items-center">
      <View className={`h-12 w-12 rounded-full items-center justify-center mr-4 ${item.status === 'completed' ? 'bg-[#10b981]/10' : 'bg-[#f59e0b]/10'}`}>
        <Ionicons name={item.status === 'completed' ? 'checkmark' : 'time'} size={24} color={item.status === 'completed' ? '#10b981' : '#f59e0b'} />
      </View>
      <View>
        <Text className={`font-bold text-base ${darkTheme ? "text-white" : "text-slate-900"}`}>Withdrawal</Text>
        <Text className={`text-xs mt-1 font-semibold ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </View>
    <View className="items-end">
      <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-slate-900"}`}>-KSh {Number(item.amount).toLocaleString()}</Text>
      <Text className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${item.status === 'completed' ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>{item.status}</Text>
    </View>
  </View>
));

export default function Cashout() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  
  const [metrics, setMetrics] = useState<BalanceMetrics | null>(null);
  const [history, setHistory] = useState<PayoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [accountDetails, setAccountDetails] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchLedgers = async () => {
    try {
      const token = await getToken();
      const res = await fetch(VendorApiRoutes.GetPayouts.path, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if(data.balance) {
          setMetrics(data.balance);
          setHistory(data.history || []);
        }
      }
    } catch (e) {
      if (__DEV__) console.log("Fetch ledgers error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLedgers();
    setRefreshing(false);
  }, []);

  const handleWithdrawal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return Toast.error("Validation Error", "Please enter a valid amount.");
    }
    if (!accountDetails || accountDetails.length < 9) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return Toast.error("Validation Error", "Please enter a valid M-Pesa number.");
    }
    
    setProcessing(true);
    try {
      const token = await getToken();
      const res = await fetch(VendorApiRoutes.RequestPayout.path, {
        method: VendorApiRoutes.RequestPayout.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          payment_method: "mpesa",
          account_details: accountDetails,
          idempotency_key: `cashout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        })
      });
      
      const response = await res.json();
      if(!res.ok) throw new Error(response.detail || "Transaction failed");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.success("Request Submitted", "Your payout request is being processed.");
      setWithdrawAmount("");
      fetchLedgers();
    } catch (error: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.error("Withdrawal Failed", (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: PayoutLog }) => (
    <PayoutItem item={item} darkTheme={darkTheme} />
  ), [darkTheme]);

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <View style={{ overflow: "hidden", paddingBottom: 4 }}>
        <View 
          className="flex-row items-center px-4 py-3 pb-4 mb-2"
          style={{ 
            backgroundColor: darkTheme ? "#000" : "#fff",
            borderBottomWidth: 1, 
            borderBottomColor: darkTheme ? BRAND.gray500 : BRAND.gray200,
            ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
          }}
        >
          <PressableScale onPress={() => router.back()} className="mr-4">
            <BackButtonMinimal />
          </PressableScale>
          <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Earnings & Payouts</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 px-5 pt-6 gap-6">
          <Skeleton width="100%" height={180} borderRadius={24} />
          <Skeleton width="100%" height={280} borderRadius={24} />
          <Skeleton width="100%" height={80} borderRadius={20} />
          <Skeleton width="100%" height={80} borderRadius={20} />
        </View>
      ) : (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex: 1}}>
        <View style={{ flex: 1 }}>
          <FlashList
            data={history}
            keyExtractor={(item: any) => item.id}
            // @ts-ignore
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkTheme ? "white" : "black"} />}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View className="mb-6">
                <View className="p-6 rounded-[24px] shadow-sm mt-6" style={{ ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }), backgroundColor: BRAND.primary }}>
                  <Text className="text-white/80 font-semibold mb-1 uppercase tracking-wider text-xs">Available Balance</Text>
                  <Text className="text-3xl font-black text-white">KSh {metrics?.available_balance?.toLocaleString() || "0"}</Text>
                  
                  <View className="flex-row justify-between mt-6 pt-4 border-t border-white/20">
                    <View>
                      <Text className="text-white/80 text-xs font-semibold mb-0.5 uppercase tracking-wider">Total Earned</Text>
                      <Text className="text-white font-bold text-lg">KSh {metrics?.lifetime_earnings?.toLocaleString() || "0"}</Text>
                    </View>
                    <View>
                      <Text className="text-white/80 text-xs font-semibold mb-0.5 text-right uppercase tracking-wider">Pending</Text>
                      <Text className="text-white font-bold text-lg text-right">KSh {metrics?.pending_payouts?.toLocaleString() || "0"}</Text>
                    </View>
                  </View>
                </View>

                {/* Gamified Progress Bar for Free Cashout */}
                <View className={`mt-4 p-4 rounded-2xl shadow-sm border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`}>
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center gap-2">
                    { (metrics?.available_balance || 0) >= 2500 && (
                      <Ionicons name="gift" size={16} color={TOAST.success} />
                    )}
                    <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>
                      {(metrics?.available_balance || 0) >= 2500 ? "Free Cashout Unlocked!" : "Withdrawal Fee Waiver"}
                    </Text>
                  </View>
                  <Text className={`text-xs font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    {Math.min(100, Math.round(((metrics?.available_balance || 0) / 2500) * 100))}%
                  </Text>
                </View>
                  
                  {/* Progress Track */}
                  <View className={`h-3 w-full rounded-full overflow-hidden mb-2 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                    <View 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${Math.min(100, Math.round(((metrics?.available_balance || 0) / 2500) * 100))}%`, 
                        backgroundColor: (metrics?.available_balance || 0) >= 2500 ? TOAST.success : BRAND.primary 
                      }} 
                    />
                  </View>

                  {((metrics?.available_balance || 0) < 2500) ? (
                    <Text className={`text-xs font-medium leading-relaxed ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                      Earn <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>KSh {2500 - (metrics?.available_balance || 0)}</Text> more to unlock <Text style={{ color: TOAST.success }} className="font-bold">ZERO</Text> withdrawal fees. Small batches cost KSh {metrics?.transaction_fee || 50}.
                    </Text>
                  ) : (
                    <Text className="text-xs font-medium leading-relaxed" style={{ color: TOAST.success }}>
                      You've reached the threshold! Your next cashout is completely free.
                    </Text>
                  )}
                </View>

                <View className={`p-6 rounded-[24px] shadow-sm mt-6 border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
                  <Text className={`text-xl font-bold mb-5 ${darkTheme ? "text-white" : "text-slate-900"}`}>Request Withdrawal</Text>
                  
                  <Text className={`text-xs font-bold mb-2 uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Amount (KSh)</Text>
                  <TextInput
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    keyboardType="numeric"
                    placeholder="e.g. 5000"
                    placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                    className={`p-4 rounded-[16px] border mb-5 font-bold text-base ${darkTheme ? "bg-slate-800 border-slate-700 text-white focus:border-accentbg" : "bg-white border-slate-200 text-slate-900 focus:border-accentbg"}`}
                  />

                  <Text className={`text-xs font-bold mb-2 uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>M-Pesa Number</Text>
                  <TextInput
                    value={accountDetails}
                    onChangeText={(text) => {
                      let cleaned = text.replace(/[^0-9]/g, '');
                      if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
                      if (cleaned.startsWith('254')) cleaned = cleaned.substring(3);
                      if (cleaned.length === 9) {
                        setAccountDetails(`254${cleaned}`);
                      } else {
                        setAccountDetails(cleaned); // Allow typing freely until matched
                      }
                    }}
                    keyboardType="phone-pad"
                    placeholder="2547XXXXXXXX"
                    placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                    className={`p-4 rounded-[16px] border font-bold text-base tracking-wider ${darkTheme ? "bg-slate-800 border-slate-700 text-white focus:border-accentbg" : "bg-white border-slate-200 text-slate-900 focus:border-accentbg"}`}
                  />
                  
                  {metrics?.minimum_threshold !== undefined && (
                    <View className={`mt-3 mb-6 p-3 rounded-xl border ${(metrics?.available_balance || 0) >= 2500 ? 'border-green-500/20 bg-green-500/10' : (darkTheme ? 'border-outline-variant bg-surface-container' : 'border-slate-200 bg-white')}`}>
                      <Text className={`text-xs font-semibold px-1 ${((metrics?.available_balance || 0) >= 2500) ? '' : (darkTheme ? "text-slate-400" : "text-slate-500")}`} style={{ color: ((metrics?.available_balance || 0) >= 2500) ? TOAST.success : undefined }}>
                        {((metrics?.available_balance || 0) >= 2500) 
                          ? 'Zero Network Fee Applied' 
                          : `Min: KSh ${metrics.minimum_threshold} • Network Fee: KSh ${metrics.transaction_fee}`}
                      </Text>
                    </View>
                  )}

                  <PressableScale 
                    onPress={handleWithdrawal}
                    disabled={processing || !metrics?.available_balance || metrics.available_balance <= 0}
                    style={{ backgroundColor: processing || !metrics?.available_balance || metrics.available_balance <= 0 ? BRAND.gray500 : (((metrics?.available_balance || 0) >= 2500) ? TOAST.success : BRAND.primary) }}
                    className="w-full h-[55px] justify-center items-center rounded-xl my-4"
                  >
                    {processing ? (
                      <Skeleton width={80} height={20} borderRadius={4} style={{ alignSelf: 'center' }} />
                    ) : (
                      <Text className="text-white font-bold text-lg">
                        {((metrics?.available_balance || 0) >= 2500) ? "Free Withdraw" : "Withdraw Funds"}
                      </Text>
                    )}
                  </PressableScale>
                </View>

                <Text className={`text-xl font-bold mt-8 mb-2 px-1 ${darkTheme ? "text-white" : "text-slate-900"}`}>Transaction History</Text>
              </View>
            }
            renderItem={renderItem}
            ListEmptyComponent={
              <View className="py-10 items-center">
                 <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                   <Ionicons name="receipt-outline" size={40} color={BRAND.primary} />
                </View>
                <Text className={`text-center font-semibold text-base ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>No recent payouts found.</Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
