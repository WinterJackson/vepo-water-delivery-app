import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { Toast } from "@/lib/toast";
import { ROUTES } from "@/API/routes/ApiRoutes";
import PressableScale from "@/components/ui/PressableScale";
import { BRAND } from "@/constants/brandColors";
import * as Location from 'expo-location';
import { Ionicons } from "@expo/vector-icons";
import { CustomerOnboardingSkeleton } from "@/components/skeletons/ContextualSkeletons";

export default function CustomerOnboarding() {
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";
    const { getToken, isLoaded } = useAuth();
    const { user } = useUser();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [missingFields, setMissingFields] = useState<string[]>([]);
    
    // Form States
    const [phoneNumber, setPhoneNumber] = useState("");

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const token = await getToken();
                const res = await fetch(ROUTES.GET_PROFILE_STATUS("customer"), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (!data.exists || (data.missing_fields && data.missing_fields.length > 0)) {
                        setMissingFields(data.missing_fields);
                    } else {
                        // Nothing missing, safe to route
                        router.replace("/(screens)");
                    }
                }
            } catch (error) {
                if (__DEV__) console.error("Failed to check profile status", error);
            } finally {
                setLoading(false);
            }
        };
        if (isLoaded) {
            checkStatus();
        }
    }, [isLoaded]);

    const handleSubmit = async () => {
        // Validation
        if (missingFields.includes("phone_number")) {
            if (!phoneNumber || phoneNumber.length < 9) {
                Toast.error("Required", "Please enter a valid phone number");
                return;
            }
        }

        setSubmitting(true);
        try {
            const token = await getToken();
            const payload = {
                // CRIT-04: clerk_id removed — backend derives identity from JWT sub claim
                full_name: user?.fullName || "",
                email: user?.emailAddresses[0]?.emailAddress || "",
                phone_number: phoneNumber,
                profile_pic: user?.imageUrl || ""
            };

            const res = await fetch(ROUTES.CREATE_USER, {
                method: "POST",
                headers: { 
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                Toast.success("Success", "Profile updated successfully!");
                router.replace("/(screens)");
            } else {
                const errorData = await res.json();
                Toast.error("Error", errorData?.detail || "Failed to update profile");
            }
        } catch (error) {
            Toast.error("Error", "Network error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
                <StatusBar barStyle={darkTheme ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
                <CustomerOnboardingSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
            <StatusBar
                barStyle={darkTheme ? "light-content" : "dark-content"}
                backgroundColor="transparent"
                translucent
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                    
                    <View className="mt-8 mb-6 items-center">
                        <Text className={`text-3xl text-center ${darkTheme ? "text-white" : "text-black"}`}>{"Complete Your Profile"}</Text>
                        <Text className={`mt-3 text-center ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                            Hey {user?.firstName}! We just need a few more details before you can start ordering.
                        </Text>
                    </View>

                    {missingFields.includes("phone_number") && (
                        <View className={`mt-6 p-5 rounded-3xl ${darkTheme ? "bg-white/5" : "bg-white border border-gray-100"}`}>
                            <Text className={`text-base font-bold mb-2 ${darkTheme ? "text-white" : "text-gray-800"}`}>
                                Phone Number
                            </Text>
                            <Text className={`text-xs mb-4 ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                                We need your phone number for M-Pesa payments and delivery updates.
                            </Text>
                            
                            <View className={`flex-row items-center h-[55px] rounded-2xl px-4 ${darkTheme ? "bg-black border border-white/20" : "bg-white border border-gray-200"}`}>
                                <Ionicons name="call" size={24} color={BRAND.primary} />
                                <Text className={`ml-3 mr-1 font-bold ${darkTheme ? "text-gray-300" : "text-gray-600"}`}>+254</Text>
                                <TextInput
                                    className={`flex-1 h-full ml-1 text-base ${darkTheme ? "text-white" : "text-black"}`}
                                    placeholder="712345678"
                                    placeholderTextColor={darkTheme ? "#888" : "#A0AEC0"}
                                    keyboardType="phone-pad"
                                    value={phoneNumber}
                                    onChangeText={(text) => {
                                        // Strictly strip non-digits to prevent dirty payloads propagating
                                        let cleaned = text.replace(/[^0-9]/g, '');
                                        // Format organically (strip leading zero or country code)
                                        if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
                                        if (cleaned.startsWith('254')) cleaned = cleaned.substring(3);
                                        setPhoneNumber(cleaned);
                                    }}
                                    maxLength={12} // Allow space for pasted buffers before trimming
                                />
                            </View>
                        </View>
                    )}

                    <PressableScale
                        onPress={handleSubmit}
                        disabled={submitting}
                        className={`mt-10 h-[55px] rounded-full items-center justify-center ${submitting ? "bg-accentbg/50" : "bg-accentbg"}`}
                    >
                        {submitting ? (
                            <ActivityIndicator color={BRAND.white} />
                        ) : (
                            <Text className="text-white font-bold text-lg">Complete Profile</Text>
                        )}
                    </PressableScale>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
