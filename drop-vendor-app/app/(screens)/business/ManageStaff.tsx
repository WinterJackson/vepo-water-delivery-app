import React, { useContext, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { View, Text, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { Toast } from "@/lib/toast";
import { PressableScale } from "@/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BRAND } from "@/constants/brandColors";
import { useDashboard } from "@/hooks/queries/useDashboard";
import { useVendorProfile } from "@/hooks/queries/useVendorProfile";

export default function ManageStaff() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const router = useRouter();
    const queryClient = useQueryClient();
    const { getToken } = useAuth();
    const { data: dashboard } = useDashboard();
    const { data: vendorProfile } = useVendorProfile();

    React.useEffect(() => {
        if (vendorProfile?.role === "staff") {
            Toast.error("Access Denied", "Staff members cannot manage other staff.");
            router.replace("/(screens)");
        }
    }, [vendorProfile]);

    const [email, setEmail] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsFocused(true);
    };

    const handleSave = async () => {
        if (!email.trim() || !email.includes("@")) {
            Toast.error("Invalid Input", "Please enter a valid email address.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const token = await getToken();
            const res = await fetch(VendorApiRoutes.AssignStaff(email.trim()).path, {
                method: VendorApiRoutes.AssignStaff(email.trim()).method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                }
            });

            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["vendorDashboard"] });
                Toast.success("Staff Assigned", "The staff member has been successfully assigned to your store.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => router.back(), 500);
            } else {
                const error = await res.json();
                Toast.error("Error", error.detail || "Could not assign staff.");
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
                        <Text className={`text-xl font-bold flex-1 ${darkTheme ? "text-white" : "text-slate-900"}`}>
                            Manage Staff
                        </Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
                    {/* Information Card */}
                    <View className={`p-4 rounded-2xl mb-8 flex-row items-start ${darkTheme ? "bg-slate-800" : "bg-blue-50"}`}>
                        <Ionicons name="people" size={24} color={BRAND.primary} />
                        <View className="flex-1 ml-3">
                            <Text className={`font-bold text-sm mb-1 ${darkTheme ? "text-white" : "text-gray-900"}`}>
                                Delegate Store Operations
                            </Text>
                            <Text className={`text-xs mb-2 ${darkTheme ? "text-gray-400" : "text-gray-600"} leading-5`}>
                                By assigning a staff member to your store, they will be able to process orders, manage inventory, and handle daily operations on your behalf.
                            </Text>
                            <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-600"} leading-5 font-semibold`}>
                                Permissions: Staff CANNOT manage payouts, edit your owner profile, or delete the store.
                            </Text>
                        </View>
                    </View>

                    <View className="mb-8">
                        <Text className={`font-semibold mb-2 text-base ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
                            Staff Member Email
                        </Text>
                        <View className={`flex-row items-center px-4 h-[55px] rounded-2xl border-2 ${isFocused ? "border-green-500 bg-green-500/5" : (darkTheme ? "bg-black border-gray-800" : "bg-white border-gray-200")}`}>
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${darkTheme ? "bg-white/10" : "bg-green-100"}`}>
                                <Ionicons name="mail-outline" size={16} color={BRAND.primary} />
                            </View>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                onFocus={handleFocus}
                                onBlur={() => setIsFocused(false)}
                                className={`flex-1 ml-3 text-base font-bold tracking-wider ${darkTheme ? "text-white" : "text-black"}`}
                                placeholder="staff@example.com"
                                placeholderTextColor={darkTheme ? "#6b7280" : "#9ca3af"}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoCorrect={false}
                            />
                        </View>
                        <Text className={`mt-2 text-xs text-center ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                            The staff member must download the Drop Vendor App and create an account before you can assign them.
                        </Text>
                    </View>

                    <PressableScale activeOpacity={0.8} onPress={handleSave} disabled={isSaving || !email.trim()}>
                        <View className={`mt-4 py-4 rounded-2xl items-center ${isSaving || !email.trim() ? "bg-accentbg/50" : "bg-accentbg"}`}>
                            {isSaving ? (
                                <ActivityIndicator color={BRAND.white} />
                            ) : (
                                <Text className="text-white text-lg font-bold">Assign Staff</Text>
                            )}
                        </View>
                    </PressableScale>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
