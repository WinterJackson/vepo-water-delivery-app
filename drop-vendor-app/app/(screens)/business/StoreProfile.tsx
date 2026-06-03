import React, { useContext, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { View, Text, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { Toast } from "@/lib/toast";
import { useDashboard } from "@/hooks/queries/useDashboard";
import { useQueryClient } from "@tanstack/react-query";
import { PressableScale } from "@/components/ui/PressableScale";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { BRAND } from "@/constants/brandColors";

const InputField = ({ label, value, onChangeText, keyboardType = "default" as any, editable = true, fieldKey, isFocused, onFocus, onBlur, darkTheme }: any) => {
    return (
        <View className="mb-6">
            <Text className={`font-semibold mb-2 text-base ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
                {label}
            </Text>
            <View className={`px-4 h-[55px] justify-center rounded-2xl border-2 ${!editable ? "opacity-50" : ""} ${isFocused ? "border-accentbg bg-accentbg/5" : (darkTheme ? "bg-black border-gray-800" : "bg-white border-gray-200")}`}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={() => editable && onFocus(fieldKey)}
                    onBlur={onBlur}
                    keyboardType={keyboardType}
                    editable={editable}
                    className={`text-lg font-medium ${darkTheme ? "text-white" : "text-black"}`}
                    placeholderTextColor={darkTheme ? "#6b7280" : "#9ca3af"}
                />
            </View>
        </View>
    );
};

export default function StoreProfile() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const router = useRouter();
    const { data: dashboard } = useDashboard();
    const queryClient = useQueryClient();
    const { getToken } = useAuth();

    const [businessName, setBusinessName] = useState(dashboard?.business_name || "");
    const [ownersName, setOwnersName] = useState(dashboard?.owners_name || "");
    const [phone, setPhone] = useState(dashboard?.phone_number || "");
    
    // Location state
    const [locationData, setLocationData] = useState<{lat: number, lng: number, address: string} | null>(null);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [manualAddress, setManualAddress] = useState("");
    const [showManualEntry, setShowManualEntry] = useState(false);
    
    const [isSaving, setIsSaving] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const handleFocus = (field: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFocusedField(field);
    };

    const getLocation = async () => {
        setFetchingLocation(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Toast.error("Permission Denied", "We need location access to map your store. Please enable it in Settings.");
                setShowManualEntry(true);
                setFetchingLocation(false);
                return;
            }

            let coords: { latitude: number; longitude: number } | null = null;

            try {
                const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                coords = current.coords;
            } catch (_e1) {
                if (__DEV__) console.warn("Tier 1 (High) GPS failed, trying Low...");
            }

            if (!coords) {
                try {
                    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
                    coords = current.coords;
                } catch (_e2) {
                    if (__DEV__) console.warn("Tier 2 (Low) GPS failed, trying last known...");
                }
            }

            if (!coords) {
                try {
                    const lastKnown = await Location.getLastKnownPositionAsync();
                    if (lastKnown) {
                        coords = lastKnown.coords;
                    }
                } catch (_e3) {
                    if (__DEV__) console.warn("Tier 3 (LastKnown) also failed.");
                }
            }

            if (!coords) {
                Toast.error("GPS Unavailable", "Could not get your position. Please enter your address manually below.");
                setShowManualEntry(true);
                setFetchingLocation(false);
                return;
            }

            const { latitude, longitude } = coords;

            let address = "Unknown Location";
            try {
                const geocodeResponse = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geocodeResponse.length > 0) {
                    const place = geocodeResponse[0];
                    address = [place.name, place.street, place.city, place.region].filter(Boolean).join(", ");
                }
            } catch (geocodeError) {
                address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            }

            setLocationData({ lat: latitude, lng: longitude, address });
            setShowManualEntry(false);
            Toast.success("Location Found", address);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            Toast.error("Location Error", "GPS failed. Please enter your address manually.");
            setShowManualEntry(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setFetchingLocation(false);
        }
    };

    const handleManualLocation = async () => {
        if (!manualAddress || manualAddress.length < 5) {
            return Toast.error("Required", "Please enter a valid store address.");
        }
        
        setFetchingLocation(true);
        try {
            const geocodeResponse = await Location.geocodeAsync(manualAddress);
            if (geocodeResponse.length > 0) {
                const { latitude, longitude } = geocodeResponse[0];
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setLocationData({ lat: latitude, lng: longitude, address: manualAddress });
                Toast.success("Address Saved", manualAddress);
            } else {
                Toast.error("Location Not Found", "Could not pinpoint this address. Please be more specific (e.g., add city/country).");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error) {
            Toast.error("Geocoding Error", "Failed to resolve address to map coordinates.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setFetchingLocation(false);
        }
    };

    const handleSave = async () => {
        if (!businessName.trim() || !ownersName.trim()) {
            Toast.error("Validation Error", "Store Name and Owner Name cannot be empty.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const token = await getToken();
            const payload: any = {
                business_name: businessName.trim(),
                owners_name: ownersName.trim(),
                phone_number: phone.trim() || null,
            };

            if (locationData) {
                payload.lat = locationData.lat;
                payload.lng = locationData.lng;
                payload.location_address = locationData.address;
            }

            const res = await fetch(VendorApiRoutes.UpdateProfile.path, {
                method: VendorApiRoutes.UpdateProfile.method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["vendorDashboard"] });
                Toast.success("Saved", "Store Profile updated successfully.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => router.back(), 500);
            } else {
                const err = await res.json();
                Toast.error("Update Failed", err.detail || "Unable to update profile.");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error: any) {
            Toast.error("Network Error", "Check your connection and try again.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSaving(false);
        }
    };

    const shadowStyle = darkTheme 
        ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } 
        : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 };

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
                            ...shadowStyle
                        }}
                    >
                        <PressableScale onPress={() => router.back()} className="mr-4">
                            <BackButtonMinimal />
                        </PressableScale>
                        <Text className={`text-2xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                            Store Profile
                        </Text>
                    </View>
                </View>
                
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                    
                    <Text className={`text-base font-bold mb-4 ${darkTheme ? "text-white" : "text-gray-800"}`}>
                        Business Information
                    </Text>
                    <InputField label="Store Name" value={businessName} onChangeText={setBusinessName} fieldKey="business" isFocused={focusedField === "business"} onFocus={handleFocus} onBlur={() => setFocusedField(null)} darkTheme={darkTheme} />
                    <InputField label="Owner Name" value={ownersName} onChangeText={setOwnersName} fieldKey="owner" isFocused={focusedField === "owner"} onFocus={handleFocus} onBlur={() => setFocusedField(null)} darkTheme={darkTheme} />
                    <InputField label="Email Address" value={dashboard?.email || ""} editable={false} fieldKey="email" isFocused={focusedField === "email"} onFocus={handleFocus} onBlur={() => setFocusedField(null)} darkTheme={darkTheme} />
                    <InputField label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" fieldKey="phone" isFocused={focusedField === "phone"} onFocus={handleFocus} onBlur={() => setFocusedField(null)} darkTheme={darkTheme} />

                    {/* Location Update Section */}
                    <View className="mt-4 mb-8">
                        <Text className={`text-base font-bold mb-2 ${darkTheme ? "text-white" : "text-gray-800"}`}>
                            Store Location
                        </Text>
                        <Text className={`text-xs mb-4 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                            Update your warehouse or store location if you have moved. This ensures riders can find you.
                        </Text>

                        {/* Auto-Detect Button */}
                        <PressableScale
                            onPress={getLocation}
                            disabled={fetchingLocation}
                            className={`h-[55px] rounded-2xl items-center justify-center border-2 border-dashed ${darkTheme ? "border-accentbg/50 bg-accentbg/10" : "border-accentbg bg-accentbg/5"}`}
                        >
                            {fetchingLocation ? (
                                <ActivityIndicator color={BRAND.primary} />
                            ) : (
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="location" size={18} color={BRAND.primary} />
                                    <Text className={`font-bold text-base ${darkTheme ? "text-accentbg" : "text-blue-600"}`}>Update via GPS</Text>
                                </View>
                            )}
                        </PressableScale>

                        {/* Divider */}
                        {(showManualEntry || locationData) && (
                            <View className="flex-row items-center my-4">
                                <View className={`flex-1 h-[1px] ${darkTheme ? "bg-white/10" : "bg-white"}`} />
                                <Text className={`mx-3 text-xs ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>or</Text>
                                <View className={`flex-1 h-[1px] ${darkTheme ? "bg-white/10" : "bg-white"}`} />
                            </View>
                        )}

                        {/* Manual Address Entry */}
                        {showManualEntry && !locationData && (
                            <View className="gap-3">
                                <TextInput
                                    className={`h-[55px] px-4 rounded-2xl text-base ${darkTheme ? "bg-black text-white border border-white/20" : "bg-white text-black border border-gray-200"}`}
                                    placeholder="e.g. Moi Avenue, Nairobi CBD"
                                    placeholderTextColor={darkTheme ? "#555" : "#A0AEC0"}
                                    value={manualAddress}
                                    onChangeText={setManualAddress}
                                />
                                <PressableScale
                                    onPress={handleManualLocation}
                                    disabled={!manualAddress || manualAddress.length < 5}
                                    className={`h-[48px] rounded-2xl items-center justify-center ${!manualAddress || manualAddress.length < 5 ? (darkTheme ? "bg-white/5" : "bg-white") : (darkTheme ? "bg-white/10" : "bg-white")}`}
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="pencil" size={14} color={BRAND.primary} />
                                        <Text className={`font-semibold ${darkTheme ? "text-gray-400" : "text-gray-600"}`}>Use This Address</Text>
                                    </View>
                                </PressableScale>
                            </View>
                        )}

                        {/* Location Confirmation */}
                        {locationData && (
                            <View className={`p-4 rounded-xl border ${darkTheme ? "bg-black border-green-900" : "bg-green-50 border-green-200"}`}>
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="checkmark-circle" size={20} color={BRAND.primary} />
                                    <Text className={`text-base font-bold ${darkTheme ? "text-green-400" : "text-green-700"}`}>New Location Ready</Text>
                                </View>
                                <Text className={`mt-2 ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>{locationData.address}</Text>
                            </View>
                        )}
                    </View>

                    <PressableScale activeOpacity={0.8} onPress={handleSave} disabled={isSaving}>
                        <View className={`py-4 rounded-2xl items-center ${isSaving ? "bg-accentbg/50" : "bg-accentbg"}`} style={shadowStyle}>
                            {isSaving ? (
                                <ActivityIndicator color={BRAND.white} />
                            ) : (
                                <Text className="text-white text-lg font-bold">Save Changes</Text>
                            )}
                        </View>
                    </PressableScale>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
