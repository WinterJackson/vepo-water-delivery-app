import React, { useContext, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { View, Text, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { useDashboard } from "@/hooks/queries/useDashboard";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { Toast } from "@/lib/toast";
import { PressableScale } from "@/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BRAND } from "@/constants/brandColors";

export default function PayoutSettings() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const router = useRouter();
    const { data: dashboard } = useDashboard();
    const queryClient = useQueryClient();
    const { getToken } = useAuth();

    // Since preferred_payment_method is an array of strings, we'll assume [0] is Mpesa Paybill/Till/Number
    const defaultMpesa = dashboard?.preferred_payment_method?.[0] || "";
    const [mpesaNo, setMpesaNo] = useState(defaultMpesa);
    const [isSaving, setIsSaving] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const isValidMpesa = (no: string) => /^254(7|1)\d{8}$/.test(no);
    const isValid = isValidMpesa(mpesaNo);

    const handleFocus = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsFocused(true);
    };

    const handleMpesaChange = (text: string) => {
        let cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '254' + cleaned.substring(1);
        } else if (cleaned.length > 0 && !cleaned.startsWith('2') && (cleaned.startsWith('7') || cleaned.startsWith('1'))) {
            cleaned = '254' + cleaned;
        }
        setMpesaNo(cleaned.substring(0, 12));
    };

    const handleSave = async () => {
        if (!isValid) {
            Toast.error("Invalid Number", "Please enter a valid M-Pesa number starting with 254 (12 digits).");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const token = await getToken();
            const res = await fetch(VendorApiRoutes.UpdateProfile.path, {
                method: VendorApiRoutes.UpdateProfile.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    preferred_payment_method: [mpesaNo]
                })
            });

            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["vendorDashboard"] });
                Toast.success("Saved", "Payout details updated successfully.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => router.back(), 500);
            } else {
                Toast.error("Error", "Could not update payout instructions.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error) {
            Toast.error("Network Error", "Unable to reach servers.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
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
                        <Text className={`text-2xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                            Payout Settings
                        </Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
                    {/* Information Card */}
                    <View className={`p-4 rounded-2xl mb-8 flex-row items-start ${darkTheme ? "bg-[#1E293B]" : "bg-[#EFF6FF]"}`}>
                        <Ionicons name="information-circle" size={24} color={BRAND.primary} />
                        <View className="flex-1 ml-3">
                            <Text className={`font-bold text-sm mb-1 ${darkTheme ? "text-white" : "text-gray-900"}`}>
                                Automated Reconciliation
                            </Text>
                            <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-600"} leading-5`}>
                                All fulfilled payments made by customers via the Drop App will be automatically reconciled and settled to this M-Pesa number.
                            </Text>
                        </View>
                    </View>

                    <View className="mb-8">
                        <Text className={`font-semibold mb-2 text-base ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
                            M-Pesa Payout Number
                        </Text>
                        <View className={`flex-row items-center px-4 h-[55px] rounded-2xl border-2 ${isFocused ? "border-[#00C853] bg-[#00C853]/5" : (darkTheme ? "bg-black border-gray-800" : "bg-white border-gray-200")}`}>
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${darkTheme ? "bg-white/10" : "bg-green-100"}`}>
                                <Ionicons name="cash-outline" size={16} color={BRAND.primary} />
                            </View>
                            <TextInput
                                value={mpesaNo}
                                onChangeText={handleMpesaChange}
                                onFocus={handleFocus}
                                onBlur={() => setIsFocused(false)}
                                keyboardType="number-pad"
                                className={`flex-1 ml-3 text-lg font-bold tracking-wider ${darkTheme ? "text-white" : "text-black"}`}
                                placeholder="e.g. 254712345678"
                                placeholderTextColor={darkTheme ? "#6b7280" : "#9ca3af"}
                                maxLength={12}
                            />
                        </View>
                    </View>

                    <PressableScale activeOpacity={0.8} onPress={handleSave} disabled={isSaving || !isValid}>
                        <View className={`mt-4 py-4 rounded-2xl items-center ${isSaving || !isValid ? "bg-accentbg/50" : "bg-accentbg"}`}>
                            {isSaving ? (
                                <ActivityIndicator color={BRAND.white} />
                            ) : (
                                <Text className="text-white text-lg font-bold">Save Payment Method</Text>
                            )}
                        </View>
                    </PressableScale>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
