import React, { useContext, useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, TextInput, Modal, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND } from "@/constants/brandColors";
import { PressableScale } from "@/components/ui/PressableScale";
import { Skeleton } from "@/components/ui/Skeleton";
import { format } from "date-fns";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { useWalletTransactions, useWalletWithdraw } from "@/hooks/queries/useWallet";
import { ROUTES } from "@/API/routes/ApiRoutes";

interface WalletData {
  bottle_purchased_at: string | null;
  bottle_refill_count: number;
  wallet_balance: number;
  phone_number: string;
}

export default function BottleWallet() {
  const router = useRouter();
  const { currentTheme } = useContext<any>(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { data: transactions, isLoading: isLoadingTx, refetch: refetchTx } = useWalletTransactions();
  const withdrawMutation = useWalletWithdraw();

  const [topUpAmount, setTopUpAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [isTopUpModalVisible, setIsTopUpModalVisible] = useState(false);
  
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);

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
          wallet_balance: data.wallet_balance || 0,
          phone_number: data.phone_number || "",
        });
      }
    } catch (e) {
      if (__DEV__) console.error("Failed to fetch wallet data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWallet();
    await refetchTx();
    setRefreshing(false);
  }, []);

  const handleTopUp = async () => {
    if (!topUpAmount || isNaN(Number(topUpAmount)) || Number(topUpAmount) < 10) {
      Alert.alert("Invalid Amount", "Please enter a valid amount of at least KSH 10 to top up.");
      return;
    }
    if (!phoneNumber) {
      Alert.alert("Invalid Phone", "Please enter a valid M-Pesa phone number.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsProcessingTopUp(true);
      const token = await getToken();
      const response = await fetch(ROUTES.WALLET_TOP_UP, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(topUpAmount),
          phone_number: phoneNumber,
          user_type: "customer"
        })
      });

      const data = await response.json().catch(() => null);

      if (response.ok && !data?.error) {
        Alert.alert("STK Push Sent", "Please check your phone and enter your M-Pesa PIN to complete the top up.");
        setTopUpAmount("");
        setIsTopUpModalVisible(false);
      } else {
        Alert.alert("Top Up Failed", data?.error || data?.detail || "An error occurred during top up.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not process top up at this time.");
    } finally {
      setIsProcessingTopUp(false);
      handleRefresh();
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) < 500) {
      Alert.alert("Invalid Amount", "Please enter a valid amount of at least KSH 500 to withdraw.");
      return;
    }
    if (!phoneNumber) {
      Alert.alert("Invalid Phone", "Please enter a valid M-Pesa phone number.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await withdrawMutation.mutateAsync({
        amount: Number(withdrawAmount),
        phoneNumber: phoneNumber,
        userType: "customer",
      });
      Alert.alert("Withdrawal Successful", "Funds have been disbursed to your M-Pesa number.");
      setWithdrawAmount("");
      setIsWithdrawModalVisible(false);
      handleRefresh();
    } catch (err: any) {
      Alert.alert("Withdrawal Failed", err.message || "An error occurred during withdrawal.");
    }
  };

  const daysSincePurchase = wallet?.bottle_purchased_at
    ? Math.floor((Date.now() - new Date(wallet.bottle_purchased_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : "bg-white"}`}>
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
          <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>Digital Wallet & Bottles</Text>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing || isLoadingTx} onRefresh={handleRefresh} tintColor={BRAND.primary} />}
      >
        {/* Wallet Balance Card */}
        <View className="rounded-[24px] overflow-hidden mb-6" style={{ backgroundColor: BRAND.primary }}>
          <View className="px-6 pt-8 pb-10 items-center">
            <Text className="text-white/80 font-medium text-base mb-2">Available Balance</Text>
            {loading ? (
              <Skeleton width={180} height={48} borderRadius={8} style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
            ) : (
              <Text className="text-white font-bold text-5xl tracking-tight">KSH {(wallet?.wallet_balance || 0).toLocaleString()}</Text>
            )}
            
            <View className="flex-row items-center mt-6 bg-white/10 px-4 py-2 rounded-full">
              <Ionicons name="shield-checkmark" size={16} color="white" />
              <Text className="text-white font-medium ml-2">Zero-Fraud Protection Active</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row justify-between mb-8">
          <PressableScale 
            onPress={() => {
              setPhoneNumber(wallet?.phone_number || "");
              setIsWithdrawModalVisible(true);
            }}
            className={`flex-1 mr-2 p-4 rounded-3xl items-center justify-center border ${darkTheme ? "bg-surface-container border-transparent" : "bg-white border-gray-100"}`}
            style={darkTheme ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
          >
            <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${darkTheme ? "bg-slate-800" : "bg-slate-100"}`}>
              <Ionicons name="arrow-down-outline" size={24} color={BRAND.primary} />
            </View>
            <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Withdraw</Text>
          </PressableScale>

          <PressableScale 
            onPress={() => {
              setPhoneNumber(wallet?.phone_number || "");
              setIsTopUpModalVisible(true);
            }}
            className={`flex-1 ml-2 p-4 rounded-3xl items-center justify-center border ${darkTheme ? "bg-surface-container border-transparent" : "bg-white border-gray-100"}`}
            style={darkTheme ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
          >
            <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${darkTheme ? "bg-slate-800" : "bg-slate-100"}`}>
              <Ionicons name="wallet-outline" size={24} color={BRAND.primary} />
            </View>
            <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Top Up</Text>
          </PressableScale>
        </View>

        {/* Info Section */}
        <View 
          className={`p-5 rounded-3xl border mb-8 ${darkTheme ? "bg-surface-container border-transparent" : "bg-white border-gray-100"}`}
          style={darkTheme ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
        >
          <View className="flex-row items-center mb-3">
            <Ionicons name="information-circle" size={22} color={BRAND.primary} />
            <Text className={`font-bold text-base ml-2 ${darkTheme ? "text-white" : "text-slate-900"}`}>Workflow & Float Guide</Text>
          </View>
          <Text className={`leading-relaxed mb-3 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
            <Text className="font-bold">Seamless Payments:</Text> Top up your wallet to easily pay for water refills without entering your M-Pesa PIN for every order.
          </Text>
          <Text className={`leading-relaxed ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
            <Text className="font-bold">Refunds & Rewards:</Text> Any cancelled orders, refunds, or loyalty bonuses are directly credited to this float balance.
          </Text>
        </View>

        {/* Bottle Tracking Section */}
        <Text className={`font-bold text-lg mb-4 mt-2 ${darkTheme ? "text-white" : "text-slate-900"}`}>My Bottles & Loyalty</Text>
        
        <View className="flex-row gap-3 mb-8">
          <View 
            className={`flex-1 p-5 rounded-3xl border ${darkTheme ? "bg-surface-container border-transparent" : "bg-white border-gray-100"}`}
            style={darkTheme ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
          >
            <Text style={{ fontSize: 28 }}>📅</Text>
            <Text className={`text-xl font-black mt-2 ${darkTheme ? "text-white" : "text-gray-900"}`}>
              {daysSincePurchase !== null ? `${daysSincePurchase} Days` : "No bottle"}
            </Text>
            <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
              Since your first bottle
            </Text>
          </View>
          <View 
            className={`flex-1 p-5 rounded-3xl border ${darkTheme ? "bg-surface-container border-transparent" : "bg-white border-gray-100"}`}
            style={darkTheme ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
          >
            <Text style={{ fontSize: 28 }}>🌱</Text>
            <Text className={`text-xl font-black mt-2 ${darkTheme ? "text-white" : "text-gray-900"}`}>
              {wallet?.bottle_refill_count ? (wallet.bottle_refill_count * 0.5).toFixed(1) : 0} kg
            </Text>
            <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
              Plastic Waste Saved
            </Text>
          </View>
        </View>

        {/* Transaction Ledger */}
        <Text className={`font-bold text-lg mb-4 ${darkTheme ? "text-white" : "text-slate-900"}`}>Recent Transactions</Text>
        
        {isLoadingTx || loading ? (
          <View className="space-y-4 mb-8">
            <Skeleton width="100%" height={70} borderRadius={16} />
            <Skeleton width="100%" height={70} borderRadius={16} />
            <Skeleton width="100%" height={70} borderRadius={16} />
          </View>
        ) : !transactions || transactions.length === 0 ? (
          <View className={`items-center justify-center p-8 rounded-3xl mb-8 ${darkTheme ? "bg-surface-container" : "bg-slate-50"}`}>
            <Ionicons name="receipt-outline" size={48} color={darkTheme ? "#475569" : "#cbd5e1"} />
            <Text className={`mt-4 font-bold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>No transactions yet</Text>
          </View>
        ) : (
          <View className="mb-10 space-y-3">
            {transactions.slice(0, 5).map((tx: any) => {
              const isDeduction = tx.transaction_type === "withdrawal" || tx.transaction_type === "payment";
              return (
                <View 
                  key={tx.id} 
                  className={`p-4 rounded-2xl flex-row items-center justify-between border ${darkTheme ? "bg-surface-container border-transparent" : "bg-white border-slate-100"}`}
                >
                  <View className="flex-row items-center flex-1 pr-4">
                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isDeduction ? "bg-red-100" : "bg-green-100"}`}>
                      <Ionicons 
                        name={isDeduction ? "arrow-up" : "arrow-down"} 
                        size={20} 
                        color={isDeduction ? "#ef4444" : "#22c55e"} 
                      />
                    </View>
                    <View>
                      <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>
                        {tx.transaction_type.replace(/_/g, " ").toUpperCase()}
                      </Text>
                      <Text className={`text-xs mt-1 ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>
                        {format(new Date(tx.created_at), 'MMM dd, yyyy • hh:mm a')}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className={`font-bold ${isDeduction ? "text-red-500" : "text-green-500"}`}>
                      {isDeduction ? "-" : "+"}KSH {Number(tx.amount).toLocaleString()}
                    </Text>
                    <View className={`px-2 py-0.5 mt-1 rounded text-[10px] ${tx.status === 'completed' ? 'bg-green-500/10' : tx.status === 'failed' ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
                      <Text className={`text-[10px] uppercase font-bold ${tx.status === 'completed' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>{tx.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            
            {transactions.length > 5 && (
              <PressableScale 
                onPress={() => router.push("/(screens)/Transactions" as any)}
                className={`w-full py-4 rounded-2xl items-center mt-2 border ${darkTheme ? "bg-slate-800 border-transparent" : "bg-white border-slate-200"}`}
              >
                <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-800"}`}>View All Transactions</Text>
              </PressableScale>
            )}
          </View>
        )}
      </ScrollView>

      {/* Top Up Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isTopUpModalVisible}
        onRequestClose={() => setIsTopUpModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className={`p-6 rounded-t-3xl ${darkTheme ? "bg-surface-container" : "bg-white"}`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Top Up Wallet</Text>
              <PressableScale onPress={() => setIsTopUpModalVisible(false)} className={`w-8 h-8 rounded-full items-center justify-center ${darkTheme ? "bg-black/50" : "bg-slate-100"}`}>
                <Ionicons name="close" size={20} color={darkTheme ? "#fff" : "#0f172a"} />
              </PressableScale>
            </View>

            <Text className={`text-sm mb-4 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
              Enter amount to top up your float via M-Pesa STK Push.
            </Text>

            <View className="mb-4">
              <Text className={`text-xs font-bold mb-2 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>AMOUNT (KSH)</Text>
              <TextInput
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                keyboardType="numeric"
                placeholder="e.g. 500"
                placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                className={`p-4 rounded-xl border font-bold text-lg ${darkTheme ? "bg-black/30 border-transparent text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
              />
            </View>
            <View className="mb-6">
              <Text className={`text-xs font-bold mb-2 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>M-PESA NUMBER</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="2547..."
                placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                className={`p-4 rounded-xl border font-bold text-lg ${darkTheme ? "bg-black/30 border-transparent text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
              />
            </View>

            <PressableScale 
              onPress={handleTopUp}
              disabled={isProcessingTopUp}
              className="w-full h-[55px] justify-center items-center rounded-xl mb-4"
              style={{ backgroundColor: isProcessingTopUp ? BRAND.gray500 : BRAND.primary }}
            >
              {isProcessingTopUp ? (
                <Skeleton width={80} height={20} borderRadius={4} style={{ alignSelf: 'center' }} />
              ) : (
                <Text className="text-white font-bold text-lg">Send STK Push</Text>
              )}
            </PressableScale>
            <SafeAreaView edges={["bottom"]} />
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isWithdrawModalVisible}
        onRequestClose={() => setIsWithdrawModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className={`p-6 rounded-t-3xl ${darkTheme ? "bg-surface-container" : "bg-white"}`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Withdraw Funds</Text>
              <PressableScale onPress={() => setIsWithdrawModalVisible(false)} className={`w-8 h-8 rounded-full items-center justify-center ${darkTheme ? "bg-black/50" : "bg-slate-100"}`}>
                <Ionicons name="close" size={20} color={darkTheme ? "#fff" : "#0f172a"} />
              </PressableScale>
            </View>

            <Text className={`text-sm mb-4 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
              Withdraw your float balance directly to your M-Pesa. Minimum amount is KSH 500.
            </Text>

            <View className="mb-4">
              <Text className={`text-xs font-bold mb-2 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>AMOUNT (KSH)</Text>
              <TextInput
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
                placeholder="e.g. 500"
                placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                className={`p-4 rounded-xl border font-bold text-lg ${darkTheme ? "bg-black/30 border-transparent text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
              />
            </View>
            <View className="mb-6">
              <Text className={`text-xs font-bold mb-2 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>M-PESA NUMBER</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="2547..."
                placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"}
                className={`p-4 rounded-xl border font-bold text-lg ${darkTheme ? "bg-black/30 border-transparent text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
              />
            </View>

            <PressableScale 
              onPress={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className="w-full h-[55px] justify-center items-center rounded-xl mb-4"
              style={{ backgroundColor: withdrawMutation.isPending ? BRAND.gray500 : BRAND.primary }}
            >
              {withdrawMutation.isPending ? (
                <Skeleton width={80} height={20} borderRadius={4} style={{ alignSelf: 'center' }} />
              ) : (
                <Text className="text-white font-bold text-lg">Withdraw to M-Pesa</Text>
              )}
            </PressableScale>
            <SafeAreaView edges={["bottom"]} />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
