import React, { useContext } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { 
    View, 
    Text, 
    ScrollView, 
    StatusBar, 
    Dimensions,
    TouchableOpacity,
    ActivityIndicator
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth, useUser } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useUserDetails } from "@/hooks/queries/useUser";
import UserAvatar from "@/components/ui/UserAvatar";
import { Image } from "expo-image";

import { ApiRoutes } from "@/API/routes/ApiRoutes";
import { Toast } from "@/lib/toast";
import { BRAND } from "@/constants/brandColors";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import CloudinaryUpload from "@/Helpers/imageUpload";
import { Popup } from "@/lib/popup";

const { width } = Dimensions.get("window");

export default function SettingsMain() {
    const { currentTheme, setTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: User } = useUserDetails();
    const [isUploadingPic, setIsUploadingPic] = React.useState(false);
    const { user } = useUser();
    const { signOut, getToken } = useAuth();

    const handleUpdateProfilePic = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setIsUploadingPic(true);
                const imageUri = result.assets[0].uri;
                
                // Upload to Cloudinary
                const uploadedData = await CloudinaryUpload(imageUri, `avatar_${user?.id}`);
                
                if (uploadedData && uploadedData.secure_url) {
                    const secureUrl = uploadedData.secure_url;
                    
                    // Send to backend
                    const res = await fetch(ApiRoutes.UpdateProfilePic.path, {
                        method: ApiRoutes.UpdateProfilePic.method,
                        headers: {
                            Authorization: `Bearer ${await getToken()}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ profile_pic: secureUrl })
                    });
                    
                    if (res.ok) {
                        queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
                        Toast.success("Success", "Profile picture updated!");
                    } else {
                        Toast.error("Error", "Failed to update profile picture on server.");
                    }
                } else {
                    Toast.error("Error", "Failed to upload image.");
                }
            }
        } catch (error) {
            console.error("Profile pic update error:", error);
            Toast.error("Error", "An error occurred while updating profile picture.");
        } finally {
            setIsUploadingPic(false);
        }
    };

    const handleSignOut = () => {
        Popup.show({
            title: "Secure Logout",
            message: "Are you sure you want to sign out? You will need to log back in to place orders, track deliveries, or access your account.",
            confirmText: "Sign Out",
            onConfirm: () => {
                executeSignOut();
            }
        });
    };

    const executeSignOut = async () => {
        Popup.setLoading(true);
        try {
            // Unregister push token before signing out to prevent cross-account notification leakage
            try {
                const token = await getToken();
                if (token) {
                    await fetch(ApiRoutes.ClearPushToken.path, {
                        method: ApiRoutes.ClearPushToken.method,
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    });
                }
            } catch (e) {
                if (__DEV__) console.warn("Failed to unregister push token", e);
            }

            await signOut();
            // HIGH-01: Clear all cached data to prevent cross-user data leakage
            const { QueryClient } = require('@tanstack/react-query');
            const queryClient = new QueryClient();
            queryClient.clear();
            Popup.hide();
            router.replace("/(Auth)");
        } catch (error) {
            if (__DEV__) console.error("Sign out error", error);
            Popup.hide();
        }
    };

    const handleDeleteAccount = () => {
        Popup.show({
            title: "Delete Account",
            message: "Your profile, saved locations, and personal identifiers will be permanently removed from our active databases. Your past order history will be permanently disconnected and anonymized for financial auditing purposes only. You cannot recover this account. Do you wish to proceed?",
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: () => {
                executeDeleteAccount();
            }
        });
    };

    const executeDeleteAccount = async () => {
        Popup.setLoading(true);
        try {
            const res = await fetch(ApiRoutes.DeleteAccount.path, {
                method: ApiRoutes.DeleteAccount.method,
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ app_type: "customer", confirmation: "DELETE MY ACCOUNT" })
            });

            if (res.ok) {
                Toast.success("Goodbye", "Account deleted successfully.");
                await signOut();
                Popup.hide();
                router.replace("/(Auth)");
            } else {
                const data = await res.json();
                Toast.error("Cannot Delete", data.detail || "You have active orders preventing deletion.");
                Popup.hide();
            }
        } catch (error) {
            Toast.error("Error", "Network error occurred.");
            Popup.hide();
        }
    };

    const SettingItem = ({ title, iconName, onPress, danger = false }: any) => (
        <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => {
                Haptics.selectionAsync();
                onPress();
            }}
            className={`flex-row items-center justify-between p-4 mb-3 rounded-2xl border ${danger ? (darkTheme ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-100") : (darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-200")}`}
            style={darkTheme ? {} : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
        >
            <View className="flex-row items-center gap-4">
                <View className={`w-10 h-10 items-center justify-center rounded-full ${danger ? "bg-red-500/10" : (darkTheme ? "bg-blue-900/40" : "bg-blue-50")}`}>
                    <Ionicons name={iconName} size={20} color={danger ? "#ef4444" : BRAND.primary} />
                </View>
                <Text className={`text-lg font-semibold ${danger ? "text-red-500" : (darkTheme ? "text-white" : "text-gray-900")}`}>
                    {title}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={BRAND.primary} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
            <StatusBar
                translucent
                backgroundColor={darkTheme ? "black" : "white"}
                barStyle={darkTheme ? "light-content" : "dark-content"}
            />
            
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
                    Settings
                </Text>
            </View>
            </View>

            <ScrollView 
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 120 }} 
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header Block */}
                <View className="items-center mb-10">
                <View className="relative">
                <View style={{ 
                    borderWidth: 2, 
                    borderColor: BRAND.primary, 
                    borderRadius: 999, 
                    padding: 2 
                }}>
                    <UserAvatar 
                        profilePicUrl={User?.profile_pic || user?.imageUrl} 
                        fullName={User?.full_name || user?.fullName || "Customer"} 
                        size={100} 
                    />
                    {isUploadingPic && (
                        <View className="absolute inset-0 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.5)', margin: 2, zIndex: 10 }}>
                            <ActivityIndicator size="large" color={BRAND.white} />
                        </View>
                    )}
                </View>
                <TouchableOpacity 
                    onPress={handleUpdateProfilePic}
                    disabled={isUploadingPic}
                    activeOpacity={0.8}
                    className="absolute bottom-0 right-0 rounded-full items-center justify-center z-20 shadow-sm"
                    style={{ 
                        backgroundColor: BRAND.primary, 
                        width: 32, 
                        height: 32,
                        borderWidth: 3,
                        borderColor: darkTheme ? "black" : "white"
                    }}
                >
                    <Ionicons name="camera" size={16} color={BRAND.white} />
                </TouchableOpacity>
                </View>
                    <Text className={`text-2xl font-bold mt-4 ${darkTheme ? "text-white" : "text-black"}`}>
                        {User?.full_name || user?.fullName || "Water Drinker"}
                    </Text>
                    <Text className={`text-sm mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                        {user?.emailAddresses?.[0]?.emailAddress || User?.email || "No email available"}
                    </Text>
                </View>

                {/* Settings Groups */}
                <Text className={`text-sm font-bold mb-2 uppercase tracking-widest ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                    Account Settings
                </Text>
                <View className="mb-8">
                    <SettingItem 
                        title="Personal Details" 
                        iconName="person-outline" 
                        onPress={() => router.push("/(screens)/settings/PersonalDetails")} 
                    />
                    <SettingItem 
                        title="Saved Locations" 
                        iconName="location-outline" 
                        onPress={() => router.push("/(screens)/settings/SavedLocations")} 
                    />
                    <SettingItem 
                        title="Payment Methods" 
                        iconName="card-outline" 
                        onPress={() => router.push("/(screens)/settings/PaymentMethods")} 
                    />
                </View>

                <Text className={`text-sm font-bold mb-2 uppercase tracking-widest ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                    Preferences
                </Text>
                <View className="mb-8">
                    <SettingItem 
                        title="Notifications" 
                        iconName="notifications-outline" 
                        onPress={() => router.push("/(screens)/settings/NotificationPreferences")} 
                    />
                    <SettingItem 
                        title="Privacy & Security" 
                        iconName="lock-closed-outline" 
                        onPress={() => router.push("/(screens)/settings/PrivacySecurity")} 
                    />
                    <TouchableOpacity 
                        activeOpacity={0.7} 
                        onPress={async () => {
                            Haptics.selectionAsync();
                            setTheme();
                        }}
                        className={`flex-row items-center justify-between p-4 mb-3 rounded-2xl border ${darkTheme ? "bg-surface-container border-gray-800" : "bg-white border-gray-200"}`}
                        style={darkTheme ? {} : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
                    >
                        <View className="flex-row items-center gap-4">
                            <View className={`w-10 h-10 items-center justify-center rounded-full ${darkTheme ? "bg-blue-900/40" : "bg-blue-50"}`}>
                                <Ionicons name={darkTheme ? "moon-outline" : "sunny-outline"} size={20} color={BRAND.primary} />
                            </View>
                            <Text className={`text-lg font-semibold ${darkTheme ? "text-white" : "text-gray-900"}`}>
                                Dark Mode
                            </Text>
                        </View>
                        <View 
                            className={`w-12 h-6 rounded-full justify-center px-1 ${darkTheme ? "bg-primary" : "bg-gray-300"}`}
                        >
                            <View className={`w-4 h-4 rounded-full bg-white shadow-sm ${darkTheme ? "self-end" : "self-start"}`} />
                        </View>
                    </TouchableOpacity>
                </View>

                <Text className={`text-sm font-bold mb-2 uppercase tracking-widest ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                    System
                </Text>
                <View className="mb-8">
                    <SettingItem 
                        title="Sign Out" 
                        iconName="log-out-outline" 
                        onPress={handleSignOut} 
                    />
                    <SettingItem 
                        title="Delete Account" 
                        iconName="trash-outline" 
                        danger={true} 
                        onPress={handleDeleteAccount} 
                    />
                </View>
            </ScrollView>

        </SafeAreaView>
    );
}
