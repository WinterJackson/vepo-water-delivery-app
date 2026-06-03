import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaymentRecordSkeleton } from "@/components/skeletons/ContextualSkeletons";
import { UIThemeContext } from "@/context/ThemeContext";
import { usePaymentHistory } from "@/hooks/queries/useOrders";
import { useRouter } from "expo-router";
import { useContext } from "react";
import { PressableScale } from "@/components/ui/PressableScale";
import {
    RefreshControl,
    StatusBar,
    Text,
    View
} from "react-native";
import { FlashList as OriginalFlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND } from "@/constants/brandColors";

const FlashList = OriginalFlashList as any;

interface PaymentRecord {
    id: string;
    order_id: string;
    total_price: number;
    order_status: string;
    created_at: string;
    vendor?: { business_name: string };
}

export default function PaymentHistory() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { data: payments = [], isLoading: loading, refetch: fetchPayments } = usePaymentHistory();

    const getStatusColor = (status: string) => {
        switch (status) {
            case "delivered": return "text-green-500";
            case "cancelled": return "text-red-500";
            case "rejected": return "text-red-500";
            default: return "text-yellow-500";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "delivered": return "✅";
            case "cancelled": return "❌";
            case "rejected": return "❌";
            case "pending": return "⏳";
            default: return "🔄";
        }
    };

    return (
        <View className={`flex-1 ${darkTheme ? "bg-black" : ""}`} style={{ paddingTop: StatusBar.currentHeight }}>
            <StatusBar translucent backgroundColor="transparent" barStyle={darkTheme ? "light-content" : "dark-content"} />

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
                <PressableScale onPress={() => router.back()} activeOpacity={0.7}>
                    <BackButtonMinimal />
                </PressableScale>
                <Text className={`font-bold text-xl ${darkTheme ? "text-white" : "text-black"}`}>
                    Payment History
                </Text>
            </View>
            </View>

            <View className="flex-1 px-4">
                <FlashList
                    data={loading && payments.length === 0 ? [1, 2, 3] : payments}
					// @ts-ignore
					estimatedItemSize={100}
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 120}}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={fetchPayments}
                            tintColor={darkTheme ? "#fff" : "#000"}
                        />
                    }
                    ListEmptyComponent={() => {
                        if (loading) return null;
                        return (
                            <View className="mt-8">
                                <EmptyState 
                                    title="No Payment History" 
                                    subtitle="No payment history is available at this time." 
                                    mood="search"
                                />
                            </View>
                        );
                    }}
                    renderItem={({ item }: { item: any }) => {
                        if (loading && payments.length === 0) {
                            return <PaymentRecordSkeleton />;
                        }
                        const payment = item as PaymentRecord;
                        return (
                            <PressableScale
                                key={payment.id}
                                activeOpacity={0.8}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(screens)/OrderDetail",
                                        params: { orderId: payment.id },
                                    })
                                }
                                className="mb-3"
                            >
                                <View
                                    className={`p-4 rounded-2xl ${darkTheme ? "bg-white/5" : "bg-white"}`}
                                >
                                    <View className="flex-row justify-between items-center mb-2">
                                        <View className="flex-row items-center gap-2">
                                            <Text style={{ fontSize: 18 }}>{getStatusIcon(payment.order_status)}</Text>
                                            <Text className={`font-bold text-base ${darkTheme ? "text-white" : "text-black"}`}>
                                                {payment.vendor?.business_name || "Vendor"}
                                            </Text>
                                        </View>
                                        <Text className={`font-bold text-lg text-green-500`}>
                                            KSH {payment.total_price?.toFixed(2) || "0.00"}
                                        </Text>
                                    </View>
                                    <View className="flex-row justify-between items-center">
                                        <Text className={`text-sm ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                                            {new Date(payment.created_at).toLocaleDateString("en-US", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </Text>
                                        <Text className={`text-sm font-semibold capitalize ${getStatusColor(payment.order_status)}`}>
                                            {payment.order_status.replace("_", " ")}
                                        </Text>
                                    </View>
                                </View>
                            </PressableScale>
                        );
                    }}
                />
            </View>
        </View>
    );
}
