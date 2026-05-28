import React, { useContext } from "react";
import { View, Text, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND } from "@/constants/brandColors";
import PressableScale from "@/components/ui/PressableScale";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { Popup } from "@/lib/popup";
import { useQueryClient } from "@tanstack/react-query";

export default function OwnerProfile() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Popup.show({
      title: "Sign Out",
      message: "Are you sure you want to log out of your account?",
      cancelText: "Cancel",
      confirmText: "Sign Out",
      isDestructive: true,
      onConfirm: () => {
          Popup.hide();
          queryClient.clear();
          signOut();
      }
    });
  };

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <View className={`flex-row justify-between py-3 border-b ${darkTheme ? "border-slate-800/80" : "border-slate-100"}`}>
      <Text className={`${darkTheme ? "text-slate-400" : "text-slate-500"}`}>{label}</Text>
      <Text className={`font-semibold ${darkTheme ? "text-slate-200" : "text-slate-900"}`}>{value || "—"}</Text>
    </View>
  );

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

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
          <Text className={`text-xl font-bold flex-1 ${darkTheme ? "text-white" : "text-slate-900"}`}>Owner Profile</Text>
        </View>
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Personal Identity */}
        <View className="items-center pt-8 pb-8">
          <View 
            className={`w-28 h-28 rounded-full items-center justify-center mb-4 border-[3px] p-1 ${darkTheme ? "bg-surface-container" : "bg-white"}`}
            style={{
              borderColor: BRAND.primary,
              ...(darkTheme ? {} : {
                ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
              })
            }}
          >
            <View className={`w-full h-full rounded-full items-center justify-center overflow-hidden ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={{ width: "100%", height: "100%" }} cachePolicy="disk" transition={200} />
              ) : (
                <Ionicons name="person-outline" size={40} color={BRAND.primary} />
              )}
            </View>
          </View>
          <Text className={`text-2xl font-bold text-center ${darkTheme ? "text-white" : "text-slate-900"}`}>
            {user?.fullName || "Vendor Owner"}
          </Text>
          <Text className={`text-base mt-1 font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
            {user?.primaryEmailAddress?.emailAddress}
          </Text>
        </View>

        {/* Identity Details */}
        <View className={`rounded-[24px] p-6 mb-8 border shadow-sm ${darkTheme ? "bg-surface-container" : "bg-white border-gray-100"}`}>
          <Text className={`font-bold text-xl mb-3 ${darkTheme ? "text-white" : "text-slate-900"}`}>Personal Information</Text>
          <InfoRow label="Full Name" value={user?.fullName || ""} />
          <InfoRow label="Email" value={user?.primaryEmailAddress?.emailAddress || ""} />
          <InfoRow label="Auth Method" value={user?.externalAccounts?.length ? user.externalAccounts[0].provider : "Email / Password"} />
          <View className={`flex-row justify-between py-3 pt-4`}>
            <Text className={`${darkTheme ? "text-slate-400" : "text-slate-500"}`}>KYC Status</Text>
            <View className={`px-3 py-1 rounded-full bg-green-500/20`}>
              <Text className={`font-bold text-xs uppercase text-green-500`}>Verified</Text>
            </View>
          </View>
        </View>

        <PressableScale activeOpacity={0.8} onPress={handleSignOut} className="mt-8 mb-4 bg-red-50 py-4 rounded-2xl items-center border border-red-100 dark:bg-red-900/20 dark:border-red-900/30">
          <Text className="text-red-600 font-bold text-lg">Sign Out</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}
