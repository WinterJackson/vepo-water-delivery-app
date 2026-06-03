import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UIThemeContext } from "@/context/ThemeContext";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { RiderCashoutSkeleton } from "@/components/skeletons/ContextualSkeletons";
import { Toast } from "@/lib/toast";
import PressableScale from "@/components/ui/PressableScale";
import { BRAND, TOAST } from "@/constants/brandColors";

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

export default function Cashout() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { currentTheme } = React.useContext<any>(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  
  const [metrics, setMetrics] = useState<BalanceMetrics | null>(null);
  const [history, setHistory] = useState<PayoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [accountDetails, setAccountDetails] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchLedgers = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/payouts/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if(data.balance) {
        setMetrics(data.balance);
        setHistory(data.history);
      }
    } catch (e) {
      if (__DEV__) console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  const handleWithdrawal = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return Toast.error("Error", "Enter a valid amount.");
    if (!accountDetails) return Toast.error("Error", "Enter account or phone parameters.");
    
    setProcessing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/payouts/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          payment_method: "mpesa",
          account_details: accountDetails
        })
      });
      
      const response = await res.json();
      if(!res.ok) throw new Error(response.detail || "Transaction failed");

      Toast.success("Withdrawal submitted", "Your payout request is being processed.");
      setWithdrawAmount("");
      fetchLedgers();
    } catch (error: any) {
      Toast.error("Withdrawal failed", error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : "bg-white"}`}>
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
                  Earnings & Payouts
              </Text>
          </View>
      </View>

      {loading ? (
          <RiderCashoutSkeleton />
      ) : (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex: 1}}>
        <FlatList
          className="flex-1 px-4"
          data={history}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View className="mb-6">
              <View className="p-6 rounded-3xl shadow-lg mt-6" style={{ backgroundColor: BRAND.primary }}>
                <Text className="text-white/80 font-medium">Available Balance</Text>
                <Text className="text-4xl font-bold text-white mt-1">KSh {metrics?.available_balance?.toLocaleString() || "0"}</Text>
                
                <View className="flex-row justify-between mt-6 pt-4 border-t border-white/20">
                  <View>
                    <Text className="text-white/80 text-xs">Total Earned</Text>
                    <Text className="text-white font-semibold">KSh {metrics?.lifetime_earnings?.toLocaleString() || "0"}</Text>
                  </View>
                  <View>
                    <Text className="text-white/80 text-xs">Pending</Text>
                    <Text className="text-white font-semibold">KSh {metrics?.pending_payouts?.toLocaleString() || "0"}</Text>
                  </View>
                </View>
              </View>

              {/* Gamified Progress Bar for Free Cashout */}
              <View className={`mt-4 p-4 rounded-2xl shadow-sm border ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-100"}`}>
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center gap-2">
                    { (metrics?.available_balance || 0) >= 2500 && (
                      <Ionicons name="gift" size={16} color={TOAST.success} />
                    )}
                    <Text className={`font-bold ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>
                      {(metrics?.available_balance || 0) >= 2500 ? "Free Cashout Unlocked!" : "Withdrawal Fee Waiver"}
                    </Text>
                  </View>
                  <Text className={`text-xs font-semibold ${darkTheme ? "text-on-surface-variant" : "text-gray-500"}`}>
                    {Math.min(100, Math.round(((metrics?.available_balance || 0) / 2500) * 100))}%
                  </Text>
                </View>
                
                {/* Progress Track */}
                <View className={`h-3 w-full rounded-full overflow-hidden mb-2 ${darkTheme ? "bg-gray-800" : "bg-white"}`}>
                  <View 
                    className="h-full rounded-full" 
                    style={{ 
                      width: `${Math.min(100, Math.round(((metrics?.available_balance || 0) / 2500) * 100))}%`, 
                      backgroundColor: (metrics?.available_balance || 0) >= 2500 ? TOAST.success : BRAND.primary 
                    }} 
                  />
                </View>

                {((metrics?.available_balance || 0) < 2500) ? (
                  <Text className={`text-xs font-medium leading-relaxed ${darkTheme ? "text-on-surface-variant" : "text-gray-500"}`}>
                    Earn <Text className={`font-bold ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>KSh {2500 - (metrics?.available_balance || 0)}</Text> more to unlock <Text style={{ color: TOAST.success }} className="font-bold">ZERO</Text> withdrawal fees. Small batches cost KSh {metrics?.transaction_fee || 50}.
                  </Text>
                ) : (
                  <Text className="text-xs font-medium leading-relaxed" style={{ color: TOAST.success }}>
                    You've reached the threshold! Your next cashout is completely free.
                  </Text>
                )}
              </View>

              <View className={`p-5 rounded-2xl shadow-sm mt-6 border ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-100"}`}>
                <Text className={`text-lg font-bold mb-4 ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>Request Withdrawal</Text>
                
                <Text className={`text-xs font-semibold mb-1 ml-1 ${darkTheme ? "text-on-surface-variant" : "text-gray-500"}`}>Amount (KSh)</Text>
                <TextInput
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  keyboardType="numeric"
                  placeholder="e.g. 5000"
                  placeholderTextColor={darkTheme ? "#6b7280" : "#9ca3af"}
                  className={`p-4 rounded-xl border mb-4 font-medium ${darkTheme ? "bg-black border-gray-800 text-white" : "bg-white border-gray-200 text-black"}`}
                />

                <Text className={`text-xs font-semibold mb-1 ml-1 ${darkTheme ? "text-on-surface-variant" : "text-gray-500"}`}>M-Pesa Number</Text>
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
                  placeholderTextColor={darkTheme ? "#6b7280" : "#9ca3af"}
                  className={`p-4 rounded-xl border font-medium ${darkTheme ? "bg-black border-gray-800 text-white" : "bg-white border-gray-200 text-black"}`}
                />

                {metrics?.minimum_threshold !== undefined && (
                  <View className={`mt-3 mb-6 p-3 rounded-xl border ${(metrics?.available_balance || 0) >= 2500 ? 'border-green-500/20 bg-green-500/10' : (darkTheme ? 'border-gray-800 bg-black' : 'border-gray-200 bg-white')}`}>
                    <Text className={`text-xs font-semibold ${((metrics?.available_balance || 0) >= 2500) ? '' : (darkTheme ? 'text-gray-400 ml-1' : 'text-gray-500 ml-1')}`} style={{ color: ((metrics?.available_balance || 0) >= 2500) ? TOAST.success : undefined }}>
                      {((metrics?.available_balance || 0) >= 2500) 
                        ? 'Zero Network Fee Applied' 
                        : `Min: KSh ${metrics.minimum_threshold} • Network Fee: KSh ${metrics.transaction_fee}`}
                    </Text>
                  </View>
                )}

                <PressableScale 
                  onPress={handleWithdrawal}
                  disabled={processing || !metrics?.available_balance || metrics.available_balance <= 0}
                  className={`py-4 rounded-xl items-center shadow-sm`}
                  style={{ backgroundColor: processing || !metrics?.available_balance || metrics.available_balance <= 0 ? BRAND.gray500 : (((metrics?.available_balance || 0) >= 2500) ? TOAST.success : BRAND.primary) }}
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

              <Text className={`text-lg font-bold mt-8 mb-2 px-1 ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>Transaction History</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className={`p-4 rounded-xl mb-3 flex-row justify-between items-center shadow-sm border ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-50"}`}>
              <View className="flex-row items-center">
                <View className={`h-10 w-10 rounded-full items-center justify-center mr-3 ${item.status === 'completed' ? 'bg-green-100' : 'bg-orange-100'}`}>
                  <Ionicons name={item.status === 'completed' ? 'checkmark' : 'time'} size={20} color={item.status === 'completed' ? '#16a34a' : '#f59e0b'} />
                </View>
                <View>
                  <Text className={`font-bold ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>Withdrawal</Text>
                  <Text className={`text-xs mt-0.5 ${darkTheme ? "text-on-surface-variant" : "text-gray-500"}`}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className={`font-bold ${darkTheme ? "text-on-surface" : "text-gray-800"}`}>-KSh {Number(item.amount).toLocaleString()}</Text>
                <Text className={`text-xs font-medium uppercase mt-0.5 ${item.status === 'completed' ? 'text-green-600' : 'text-orange-500'}`}>{item.status}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text className="text-center text-gray-400 mt-4">No recent payouts found.</Text>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
