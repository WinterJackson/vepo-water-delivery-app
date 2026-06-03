import RiderApiRoutes from "@/API/routes/RiderApiRoutes";
import { UIThemeContext } from "@/context/ThemeContext";
import { useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
    Image,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
    KeyboardAvoidingView,
    Platform, TouchableOpacity
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { BRAND } from "@/constants/brandColors";
import PressableScale from "@/components/ui/PressableScale";
import { Toast } from '@/lib/toast';
import { useRouter } from "expo-router";
import VehicleDropdown from "@/components/ui/VehicleDropdown";
import { Ionicons } from "@expo/vector-icons";
import { Popup } from "@/lib/popup";
import { RiderProfileSkeleton } from "@/components/skeletons/ContextualSkeletons";

export default function Profile() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken, signOut } = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<any>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    const token = await getToken();
    try {
      const res = await fetch(RiderApiRoutes.GetProfile.path, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setEditForm({ name: data.name, phone_number: data.phone_number, vehicle_type: data.vehicle_type, plate_number: data.plate_number });
      }
    } catch (e) { if (__DEV__) console.error("Caught Unhandled Exception:", e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleSignOut = () => {
    Popup.show({
      title: "Sign Out",
      message: "Are you sure?",
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

  const handleSave = async () => {
    // Validate phone
    const phoneRegex = /^(?:\+254|0)[17]\d{8}$/; // Matches +254xxxxxxxxx or 07xxxxxxxx or 01xxxxxxxx
    if (editForm.phone_number && !phoneRegex.test(editForm.phone_number)) {
      Toast.error("Invalid Phone", "Please enter a valid Kenyan phone number (e.g. +254712345678 or 0712345678)");
      return;
    }

    setSaving(true);
    const token = await getToken();
    try {
      const res = await fetch(RiderApiRoutes.UpdateProfile.path, {
        method: RiderApiRoutes.UpdateProfile.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        Toast.success("Success", "Profile updated successfully");
        setProfile({ ...profile, ...editForm });
        setIsEditing(false);
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (e) {
      Toast.error("Error", "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const InfoRow = ({ label, value, field, placeholder }: { label: string; value: string; field: string; placeholder?: string }) => (
    <View className={`flex-row justify-between py-3 border-b ${darkTheme ? "border-white/5" : "border-gray-100"}`}>
      <Text className={`w-1/3 mt-3 text-sm ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>{label}</Text>
      {isEditing ? (
        field === "vehicle_type" ? (
          <VehicleDropdown 
              value={editForm[field]} 
              onValueChange={(val) => setEditForm({ ...editForm, [field]: val })} 
              style="w-[60%] mb-0 h-[40px] px-2"
          />
        ) : (
          <TextInput
            value={editForm[field]}
            onChangeText={(text) => setEditForm({ ...editForm, [field]: text })}
            placeholder={placeholder || `Enter ${label}`}
            placeholderTextColor={darkTheme ? "#666" : "#999"}
            className={`w-[60%] p-3 rounded-lg border ${darkTheme ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
          />
        )
      ) : (
        <Text className={`flex-1 mt-3 font-semibold text-right ${darkTheme ? "text-white" : "text-gray-900"}`}>{value || "—"}</Text>
      )}
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
              <TouchableOpacity onPress={() => router.back()} className="mr-4">
                  <BackButtonMinimal />
              </TouchableOpacity>
              <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                  Profile
              </Text>
          </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex: 1}}>
        <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        {loading ? (
            <RiderProfileSkeleton />
        ) : (
          <>
            <View className="items-center pt-6 pb-8">
              <View className="w-24 h-24 rounded-full bg-accentbg/20 items-center justify-center mb-4 overflow-hidden">
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} className="w-full h-full rounded-full" />
            ) : (
              <Ionicons 
                name={profile?.vehicle_type === 'truck' ? 'car' : profile?.vehicle_type === 'tuktuk' ? 'car-sport' : 'bicycle'} 
                size={40} 
                color={BRAND.primary} 
              />
            )}
          </View>
          <Text className={`text-2xl font-bold ${darkTheme ? "text-white" : "text-gray-900"}`}>
            {profile?.name || user?.fullName || "Rider"}
          </Text>
          <Text className="text-sm mt-1 font-bold text-accentbg">
            {profile?.vehicle_type === 'truck' ? 'Wholesale Capacity (50+ Bottles)' : 
             profile?.vehicle_type === 'tuktuk' ? 'Medium Payload (10-20 Bottles)' : 
             'Standard Payload (Max 5 Bottles)'}
          </Text>
          <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
            {profile?.email || user?.emailAddresses[0]?.emailAddress}
          </Text>
        </View>

        <View className="flex-row justify-between items-center mb-2 px-1">
          <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-gray-900"}`}>Profile Details</Text>
          <PressableScale onPress={() => setIsEditing(!isEditing)} className="px-3 py-1 bg-accentbg/10 rounded-full">
            <Text className="text-accentbg font-semibold">{isEditing ? "Cancel" : "Edit"}</Text>
          </PressableScale>
        </View>

        <View className={`rounded-2xl p-4 ${darkTheme ? "bg-white/5" : "bg-white"}`}>
          <InfoRow field="name" label="Name" value={profile?.name} />
          <InfoRow field="phone_number" label="Phone" value={profile?.phone_number} placeholder="07XXXXXXXX" />
          <InfoRow field="vehicle_type" label="Vehicle" value={profile?.vehicle_type} />
          <InfoRow field="plate_number" label="Plate" value={profile?.plate_number} />
          {!isEditing && <InfoRow field="is_available" label="Available" value={profile?.is_available ? "Yes" : "No"} />}
        </View>

        {isEditing && (
          <PressableScale 
            onPress={handleSave} 
            disabled={saving}
            className={`mt-6 py-4 rounded-2xl items-center shadow-sm ${saving ? "bg-accentbg" : "bg-accentbg"}`}
          >
            <Text className="text-white font-bold text-lg">{saving ? "Saving..." : "Save Profile"}</Text>
          </PressableScale>
        )}

        {/* Vendor Discovery */}
        <Text className={`mt-6 mb-2 ml-1 font-bold ${darkTheme ? "text-white" : "text-gray-800"}`}>Vendor Network</Text>
        <PressableScale
          onPress={() => router.push("/(screens)/DiscoverVendors")}
          activeOpacity={0.7}
          className={`rounded-2xl p-4 flex-row justify-between items-center ${darkTheme ? "bg-white/5" : "bg-white"}`}
        >
          <View>
            <Text className={`text-base font-semibold ${darkTheme ? "text-white" : "text-gray-900"}`}>Discover Vendors</Text>
            <Text className={`text-xs mt-1 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>Find and apply to nearby vendors</Text>
          </View>
          <Text className="text-accentbg font-bold">Open</Text>
        </PressableScale>

        <PressableScale 
          activeOpacity={0.8} 
          onPress={handleSignOut} 
          className={`py-4 rounded-2xl items-center mt-8 bg-red-500/10`}
        >
          <Text className="text-red-500 font-bold text-base">Sign Out</Text>
        </PressableScale>
        </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
