import React, { useContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StatusBar, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND } from "@/constants/brandColors";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import PressableScale from "@/components/ui/PressableScale";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { Toast } from '@/lib/toast';

export default function StoreProfile() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();

  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Bottom Sheets
  const hoursSheetRef = useRef<BottomSheetModal>(null);
  const depositSheetRef = useRef<BottomSheetModal>(null);
  const staffSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["50%", "75%"], []);

  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [tempDepositFee, setTempDepositFee] = useState("");
  const [staffEmail, setStaffEmail] = useState("");

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
  ), []);

  const fetchProfile = async () => {
    try {
      const token = await getToken();
      const res = await fetch(VendorApiRoutes.GetProfile.path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVendor(data);
        if (data.shift_start) setTempStart(data.shift_start);
        if (data.shift_end) setTempEnd(data.shift_end);
        if (data.deposit_fee != null) setTempDepositFee(String(data.deposit_fee));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleUpdate = async (payload: any, successMessage: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const token = await getToken();
    try {
      const res = await fetch(VendorApiRoutes.UpdateProfile.path, {
        method: VendorApiRoutes.UpdateProfile.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Update failed");
      setVendor((prev: any) => ({ ...prev, ...payload }));
      Toast.success("Success", successMessage);
      return true;
    } catch (e) {
      Toast.error("Error", "Failed to update store settings");
      return false;
    }
  };

  const saveHours = async () => {
    hoursSheetRef.current?.dismiss();
    await handleUpdate({ shift_start: tempStart, shift_end: tempEnd }, "Operating hours updated.");
  };

  const saveDeposit = async () => {
    const feeValue = parseFloat(tempDepositFee);
    if (isNaN(feeValue) || feeValue < 0 || feeValue > 5000) {
      Toast.error("Invalid", "Fee must be between KSH 0 and KSH 5,000.");
      return;
    }
    depositSheetRef.current?.dismiss();
    await handleUpdate({ deposit_fee: feeValue }, `Deposit fee updated to KSH ${feeValue.toLocaleString()}.`);
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
          <Text className={`text-xl font-bold flex-1 ${darkTheme ? "text-white" : "text-slate-900"}`}>Store Profile</Text>
        </View>
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Store Identity */}
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
              {vendor?.profile_pic ? (
                <Image source={{ uri: vendor.profile_pic }} style={{ width: "100%", height: "100%" }} cachePolicy="disk" transition={200} />
              ) : (
                <Ionicons name="storefront-outline" size={40} color={BRAND.primary} />
              )}
            </View>
          </View>
          <Text className={`text-2xl font-bold text-center ${darkTheme ? "text-white" : "text-slate-900"}`}>
            {vendor?.business_name || "Store Name"}
          </Text>
          <View className={`px-3 py-1 mt-2 rounded-full ${vendor?.verification_status === 'verified' ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
            <Text className={`font-bold text-xs uppercase ${vendor?.verification_status === 'verified' ? 'text-green-500' : 'text-yellow-600'}`}>
              {vendor?.verification_status || 'Pending'}
            </Text>
          </View>
        </View>

        {/* Public Details */}
        <View className={`rounded-[24px] p-6 mb-8 border shadow-sm ${darkTheme ? "bg-surface-container" : "bg-white border-gray-100"}`}>
          <Text className={`font-bold text-xl mb-3 ${darkTheme ? "text-white" : "text-slate-900"}`}>Public Details</Text>
          <InfoRow label="Business Name" value={vendor?.business_name} />
          <InfoRow label="Support Phone" value={vendor?.phone_number} />
          <InfoRow label="Location" value={vendor?.location_address} />
          <InfoRow label="Delivery Radius" value={vendor?.delivery_radius ? `${vendor.delivery_radius} km` : "Not set"} />
        </View>

        <Text className={`mb-4 ml-2 font-bold text-xl tracking-tight ${darkTheme ? "text-white" : "text-slate-900"}`}>Operations</Text>

        <PressableScale
          onPress={() => hoursSheetRef.current?.present()}
          activeOpacity={0.7}
          className={`rounded-3xl p-5 mb-3 flex-row justify-between items-center border shadow-sm ${darkTheme ? "bg-surface-container" : "bg-white border-gray-100"}`}
        >
          <View className="flex-row items-center">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
               <Ionicons name="time-outline" size={24} color={BRAND.primary} />
            </View>
            <View>
              <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Operating Hours</Text>
              <Text className={`text-sm mt-1 font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                {vendor?.shift_start || "Not set"} - {vendor?.shift_end || "Not set"}
              </Text>
            </View>
          </View>
          <Ionicons name="pencil" size={20} color="#d9a31b" />
        </PressableScale>

        <PressableScale
          onPress={() => depositSheetRef.current?.present()}
          activeOpacity={0.7}
          className={`rounded-3xl p-5 mb-3 flex-row justify-between items-center border shadow-sm ${darkTheme ? "bg-surface-container" : "bg-white border-gray-100"}`}
        >
          <View className="flex-row items-center">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
               <Ionicons name="water-outline" size={24} color={BRAND.primary} />
            </View>
            <View>
              <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Bottle Deposit Fee</Text>
              <Text className={`text-sm mt-1 font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                {vendor?.deposit_fee != null ? `KSH ${Number(vendor.deposit_fee).toLocaleString()}` : "Not set"}
              </Text>
            </View>
          </View>
          <Ionicons name="pencil" size={20} color="#d9a31b" />
        </PressableScale>

        {/* Staff Management */}
        <Text className={`mt-6 mb-4 ml-2 font-bold text-xl tracking-tight ${darkTheme ? "text-white" : "text-slate-900"}`}>Team</Text>
        <PressableScale
          onPress={() => staffSheetRef.current?.present()}
          activeOpacity={0.7}
          className={`rounded-3xl p-5 mb-8 flex-row justify-between items-center border shadow-sm ${darkTheme ? "bg-surface-container" : "bg-white border-gray-100"}`}
        >
          <View className="flex-row items-center">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
               <Ionicons name="people-circle-outline" size={24} color={BRAND.primary} />
            </View>
            <View>
              <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Store Staff</Text>
              <Text className={`text-sm mt-1 font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                {vendor?.staff_clerk_id ? "Staff member linked" : "Assign your station staff"}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={BRAND.primary} />
        </PressableScale>

      </ScrollView>

      {/* Sheets */}
      <BottomSheetModal
        ref={hoursSheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: darkTheme ? BRAND.bgDark : BRAND.white }}
      >
        <BottomSheetView className="flex-1 px-6">
          <Text className={`text-2xl font-bold mb-6 mt-4 ${darkTheme ? "text-white" : "text-slate-900"}`}>Edit Operating Hours</Text>
          <View className="mb-5">
            <Text className={`text-sm mb-2 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Shift Start</Text>
            <TextInput value={tempStart} onChangeText={setTempStart} placeholder="08:00" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} className={`p-4 rounded-2xl border text-lg font-semibold ${darkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`} />
          </View>
          <View className="mb-8">
            <Text className={`text-sm mb-2 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Shift End</Text>
            <TextInput value={tempEnd} onChangeText={setTempEnd} placeholder="17:00" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} className={`p-4 rounded-2xl border text-lg font-semibold ${darkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`} />
          </View>
          <PressableScale onPress={saveHours} className="py-4 rounded-2xl bg-accentbg items-center">
            <Text className="text-white font-bold text-lg">Save Hours</Text>
          </PressableScale>
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={depositSheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: darkTheme ? BRAND.bgDark : BRAND.white }}
      >
        <BottomSheetView className="flex-1 px-6">
          <Text className={`text-2xl font-bold mb-6 mt-4 ${darkTheme ? "text-white" : "text-slate-900"}`}>Empty Bottle Deposit</Text>
          <View className="mb-8">
            <Text className={`text-sm mb-2 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Deposit Fee (KSH)</Text>
            <TextInput value={tempDepositFee} onChangeText={(text) => setTempDepositFee(text.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="e.g. 500" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} className={`p-4 rounded-2xl border text-lg font-semibold ${darkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`} />
          </View>
          <PressableScale onPress={saveDeposit} className="py-4 rounded-2xl bg-accentbg items-center">
            <Text className="text-white font-bold text-lg">Save Deposit</Text>
          </PressableScale>
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={staffSheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: darkTheme ? BRAND.bgDark : BRAND.white }}
      >
        <BottomSheetView className="flex-1 px-6">
          <Text className={`text-2xl font-bold mb-2 mt-4 ${darkTheme ? "text-white" : "text-slate-900"}`}>Staff Account</Text>
          <Text className={`text-sm mb-6 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Only ONE staff member is permitted per station. Enter their Clerk ID to grant them access to this store's operations.
          </Text>
          <View className="mb-8">
            <Text className={`text-sm mb-2 font-bold uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>Staff Clerk ID</Text>
            <TextInput value={staffEmail} onChangeText={setStaffEmail} placeholder="user_..." placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} className={`p-4 rounded-2xl border text-lg font-semibold ${darkTheme ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`} />
          </View>
          <PressableScale onPress={() => {Toast.info("Coming soon", "Staff assignment is being integrated."); staffSheetRef.current?.dismiss();}} className="py-4 rounded-2xl bg-accentbg items-center">
            <Text className="text-white font-bold text-lg">Assign Staff</Text>
          </PressableScale>
        </BottomSheetView>
      </BottomSheetModal>

    </SafeAreaView>
  );
}
