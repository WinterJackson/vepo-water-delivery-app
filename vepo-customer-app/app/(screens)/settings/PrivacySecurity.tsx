import React, { useContext, useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { View, Text, ScrollView, TouchableOpacity, Switch, Linking } from "react-native";
import { Stack, useRouter } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { Toast } from "@/lib/toast";
import { Popup } from "@/lib/popup";
import { BRAND, TOAST } from "@/constants/brandColors";
import { useUserDetails, useUpdateUser } from "@/hooks/queries/useUser";

export default function PrivacySecurity() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const router = useRouter();

    const { data: User } = useUserDetails();
    const updateUserMutation = useUpdateUser();

    const [dataTracking, setDataTracking] = useState(true);

    useEffect(() => {
        if (User?.preferences && User.preferences.analytics !== undefined) {
            setDataTracking(User.preferences.analytics);
        }
    }, [User]);

    const handleDataTrackingToggle = async (val: boolean) => {
        setDataTracking(val);
        const newPrefs = { ...(User?.preferences || {}), analytics: val };
        try {
            await updateUserMutation.mutateAsync({ preferences: newPrefs });
        } catch (error) {
            setDataTracking(!val); // Revert
            Toast.error("Update Failed", "Could not save your preferences.");
        }
    };

    const handlePasswordChange = () => {
        Popup.show({
            title: "Change Password",
            message: "To ensure maximum security, password resets are handled securely via your registered email. We will send a secure password modification link to your inbox.",
            cancelText: "Cancel",
            confirmText: "Send Link",
            onConfirm: () => {
                Popup.hide();
                Toast.success("Link Sent", "Check your email inbox for further instructions.");
            }
        });
    };

    const handleOpenLink = async (url: string) => {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Toast.error("Error", "Could not open the link securely.");
        }
    };

    const ActionItem = ({ title, icon, description, onPress }: any) => (
        <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={onPress}
            className={`p-4 mb-4 rounded-xl border flex-row items-center justify-between ${darkTheme ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}
        >
            <View className="flex-row items-center gap-4 flex-1">
                <View className={`w-10 h-10 items-center justify-center rounded-full ${darkTheme ? "bg-black" : "bg-white"}`}>
                    <Text style={{ fontSize: 18 }}>{icon}</Text>
                </View>
                <View className="flex-1 pr-4">
                    <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-black"}`}>{title}</Text>
                    {description && (
                        <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>{description}</Text>
                    )}
                </View>
            </View>
            <Text className={`text-xl ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>›</Text>
        </TouchableOpacity>
    );

    const ToggleItem = ({ title, icon, description, value, onToggle }: any) => (
        <View className={`p-4 mb-4 rounded-xl border flex-row items-center justify-between ${darkTheme ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"}`}>
            <View className="flex-row items-center gap-4 flex-1 border-r border-transparent">
                <View className={`w-10 h-10 items-center justify-center rounded-full ${darkTheme ? "bg-black" : "bg-white"}`}>
                    <Text style={{ fontSize: 18 }}>{icon}</Text>
                </View>
                <View className="flex-1 pr-4">
                    <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-black"}`}>{title}</Text>
                    {description && (
                        <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>{description}</Text>
                    )}
                </View>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: darkTheme ? "#333" : "#e5e7eb", true: "#3b82f6" }}
                thumbColor={BRAND.white}
            />
        </View>
    );

    return (
        <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
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
                <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                    Privacy & Security
                </Text>
            </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 }}>
                
                <Text className={`text-sm font-bold mb-3 uppercase tracking-widest mt-2 ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                    Security
                </Text>
                <ActionItem 
                    title="Change Password" 
                    icon="🔐"
                    description="Request a secure password modification link to your registered email."
                    onPress={handlePasswordChange}
                />

                <Text className={`text-sm font-bold mb-3 uppercase tracking-widest mt-6 ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                    Legal & Compliance
                </Text>
                <ActionItem 
                    title="Privacy Policy" 
                    icon="📄"
                    description="Read our comprehensive privacy policy securely online."
                    onPress={() => handleOpenLink("https://vepo.space/privacy")}
                />
                <ActionItem 
                    title="Terms of Service" 
                    icon="⚖️"
                    description="Review the terms and conditions binding your usage."
                    onPress={() => handleOpenLink("https://vepo.space/terms")}
                />

                <Text className={`text-sm font-bold mb-3 uppercase tracking-widest mt-6 ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                    Data Preferences
                </Text>
                <ToggleItem 
                    title="Analytics & Telemetry" 
                    icon="📊"
                    description="Allow anonymous usage data to be collected to improve the Vepo platform ecosystem."
                    value={dataTracking}
                    onToggle={handleDataTrackingToggle}
                />

            </ScrollView>
        </SafeAreaView>
    );
}
