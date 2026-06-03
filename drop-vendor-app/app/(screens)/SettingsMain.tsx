import React, { useContext } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Stack, useRouter } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import UserAvatar from "@/components/ui/UserAvatar";
import { Ionicons } from "@expo/vector-icons";
import { useDashboard } from "@/hooks/queries/useDashboard";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { Toast } from "@/lib/toast";
import { Popup } from "@/lib/popup";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { BRAND } from "@/constants/brandColors";
import { useVendorProfile } from "@/hooks/queries/useVendorProfile";

export default function SettingsMain() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const router = useRouter();
    const { signOut, getToken } = useAuth();
    const { data: dashboard } = useDashboard();
    const { data: vendorProfile } = useVendorProfile();
    const isStaff = vendorProfile?.role === "staff";

    const handleSignOut = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Popup.show({
            title: "Secure Logout",
            message: "Are you sure you want to sign out? Your store will remain active, but you won't receive immediate push notifications or be able to accept live orders until you securely log back in.",
            cancelText: "Cancel",
            confirmText: "Sign Out",
            isDestructive: true,
            onConfirm: async () => {
                Popup.setLoading(true);
                try {
                    await signOut();
                    Popup.hide();
                    router.replace("/(Auth)");
                } catch (error) {
                    if (__DEV__) console.error("Sign out error", error);
                    Popup.hide();
                }
            }
        });
    };

    const handleDeleteAccount = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Popup.show({
            title: "Delete Vendor Account",
            message: "Your store profile, bank details, and personal identifiers will be permanently removed. Your store will immediately go offline. Past payouts and orders will be irreversibly anonymized for financial auditing. You cannot recover this account. Do you wish to proceed?",
            cancelText: "Cancel",
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                Popup.setLoading(true);
                try {
                    const res = await fetch(VendorApiRoutes.DeleteAccount.path, {
                        method: VendorApiRoutes.DeleteAccount.method,
                        headers: {
                            Authorization: `Bearer ${await getToken()}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ app_type: "vendor", confirmation: "DELETE MY ACCOUNT" })
                    });

                    if (res.ok) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Toast.success("Goodbye", "Store deleted successfully.");
                        await signOut();
                        Popup.hide();
                        router.replace("/(Auth)");
                    } else {
                        const data = await res.json();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        Popup.show({ title: "Cannot Delete", message: data.detail || "You have active orders preventing deletion." });
                    }
                } catch (error) {
                    Popup.show({ title: "Error", message: "Network error occurred." });
                }
            }
        });
    };

    const SettingItem = ({ title, description, icon, onPress, danger = false }: any) => (
        <PressableScale 
            activeOpacity={0.7} 
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            className={`flex-row items-center justify-between p-5 mb-3 rounded-[24px] border ${danger ? (darkTheme ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-100") : (darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100")}`} style={darkTheme ? {} : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
        >
            <View className="flex-row items-center gap-4 flex-1">
                <View className={`w-12 h-12 items-center justify-center rounded-full ${danger ? "bg-red-500/20" : (darkTheme ? "bg-blue-900/40" : "bg-blue-50")}`}>
                    <Ionicons name={icon} size={24} color={danger ? "#ef4444" : BRAND.primary} />
                </View>
                <View className="flex-1 pr-4">
                    <Text className={`text-lg font-bold ${danger ? "text-red-500" : (darkTheme ? "text-white" : "text-slate-900")}`}>
                        {title}
                    </Text>
                    {description && (
                        <Text className={`text-xs mt-0.5 font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                            {description}
                        </Text>
                    )}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={BRAND.primary} />
        </PressableScale>
    );

    return (
        <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
            <StatusBar translucent backgroundColor="transparent" barStyle={darkTheme ? "light-content" : "dark-content"} />
            <Stack.Screen options={{ headerShown: false }} />
            
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
                    <View>
                        <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>
                            Store Settings
                        </Text>
                        <Text className={`text-xs font-semibold mt-0.5 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Manage your operational details</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 30, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View className="items-center mb-10">
                    <UserAvatar 
                        profilePicUrl={null} 
                        fullName={dashboard?.business_name || "Vendor"} 
                        size={100} 
                    />
                    <Text className={`text-2xl font-bold mt-4 ${darkTheme ? "text-white" : "text-black"}`}>
                        {dashboard?.business_name || "Drop Vendor"}
                    </Text>
                    <Text className={`text-sm mt-1 font-semibold ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Manage your store operations
                    </Text>
                </View>

                {!isStaff && (
                  <>
                    <Text className={`text-[10px] font-bold mb-3 pl-2 uppercase tracking-widest ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>
                        Business Profile
                    </Text>
                    <View className="mb-6">
                        <SettingItem 
                            title="Store Details & Location" 
                            description="Update business name, pin, and GPS location"
                            icon="location-outline" 
                            onPress={() => router.push("/(screens)/business/StoreProfile")} 
                        />
                        <SettingItem 
                            title="Operating Hours" 
                            description="Set open and close times"
                            icon="time-outline" 
                            onPress={() => router.push("/(screens)/business/OperatingHours")} 
                        />
                    </View>

                    <Text className={`text-[10px] font-bold mb-3 pl-2 uppercase tracking-widest ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>
                        Financials
                    </Text>
                    <View className="mb-6">
                        <SettingItem 
                            title="Payout Methods" 
                            description="Configure bank or M-Pesa details"
                            icon="card-outline" 
                            onPress={() => router.push("/(screens)/business/PayoutSettings")} 
                        />
                    </View>
                  </>
                )}

                <View className="mb-8 mt-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <SettingItem title="Sign Out" icon="log-out-outline" onPress={handleSignOut} />
                    {!isStaff && (
                        <SettingItem title="Delete Store" description="Permanently erase account" icon="trash-outline" danger={true} onPress={handleDeleteAccount} />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
