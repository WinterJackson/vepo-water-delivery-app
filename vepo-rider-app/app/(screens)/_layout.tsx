import TabIcon from "@/components/ui/TabIcon";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND } from "@/constants/brandColors";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNetworkQueue } from "@/hooks/useNetworkQueue";
import { useAuth } from "@clerk/clerk-expo";
import { Stack, usePathname, useRouter, Redirect } from "expo-router";
import { useContext } from "react";
import { PressableScale } from "@/components/ui/PressableScale";
import { Dimensions, View, ActivityIndicator, Text } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from "@tanstack/react-query";
import RiderApiRoutes from "@/API/routes/RiderApiRoutes";

const { width } = Dimensions.get("window");

export default function ScreensLayout() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const router = useRouter();
  const path = usePathname();
  const { isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  useNetworkQueue();
  usePushNotifications('rider');

  // Fetch KYC & Operational Status globally for layout gating
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['rider', 'kyc_status'],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(process.env.EXPO_PUBLIC_BACKEND_BASE_URL + "/api/deliverer/kyc/status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: !!isSignedIn,
    staleTime: 60000, // 1 minute
  });

  const active = (pathname: string) => {
    return pathname === path;
  };

  if (isSignedIn === false) {
    return <Redirect href={'/(Auth)'} />
  }

  // Force redirection to VerificationWall if unsubmitted/pending/rejected
  if (!statusLoading && statusData) {
    if (statusData.kyc_status !== "approved" && !path.includes("VerificationWall")) {
      return <Redirect href={'/(screens)/VerificationWall'} />
    }
  }

  const isOperational = statusData?.kyc_status === "approved" && !!statusData?.employer_vendor_id;

  return (
      <View
        className={`flex-1`}
        style={[{ minWidth: width, backgroundColor: darkTheme ? BRAND.bgDark : BRAND.bgLight }]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade', // Default to fade for the main custom tab transitions
            statusBarAnimation: "slide",
            contentStyle: { backgroundColor: darkTheme ? BRAND.bgDark : BRAND.bgLight }
          }}
        >
          {/* Main Tabs (Fade) */}
          <Stack.Screen name="index" />
          <Stack.Screen name="TripRadar" />
          <Stack.Screen name="ActiveDelivery" />
          <Stack.Screen name="VendorRemittance" />
          <Stack.Screen name="Profile" />
          
          {/* General Pages (Slide) */}
          <Stack.Screen name="Orders" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Earnings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Cashout" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SettingsMain" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="OperationBase" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="DiscoverVendors" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="VerificationWall" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rider/VehicleDetails" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rider/BankDetails" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rider/Preferences" options={{ animation: 'slide_from_right' }} />
        </Stack>

        {/* Bottom Navigation Bar - Hide on VerificationWall */}
        {path !== "/VerificationWall" && (
        <View 
          className="bg-transparent items-center px-gutter w-full absolute z-50 pointer-events-box-none"
          style={{ bottom: insets.bottom + 8 }}
        >
          {/* Debug Overlay */}
          {!isOperational && !statusLoading && (
            <View className="bg-red-500/90 rounded-md px-2 py-1 mb-2">
              <Text className="text-white text-[10px]">
                DEBUG: isOp={String(isOperational)} | kyc={statusData?.kyc_status} | vend={String(statusData?.employer_vendor_id)}
              </Text>
            </View>
          )}

          <View 
            className={`rounded-full px-4 flex-row justify-around items-center w-full max-w-[350px] h-[64px] ${ darkTheme? "bg-surface-container border" : "bg-white border border-gray-100"}`}
            style={darkTheme ? { borderColor: 'rgba(255,255,255,0.1)' } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
          >
            {/* Home */}
            <PressableScale onPress={() => router.push("/(screens)")}>
              <View className={`w-14 h-14 items-center justify-center ${active("/") ? "bg-primary-container rounded-full" : ""}`}>
                <TabIcon name="home" active={active("/")} />
              </View>
            </PressableScale>
            
            {/* Radar - Hidden if not operational */}
            {isOperational && (
              <PressableScale onPress={() => router.push("/(screens)/TripRadar")}>
                <View className={`w-14 h-14 items-center justify-center ${active("/TripRadar") ? "bg-primary-container rounded-full" : ""}`}>
                  <TabIcon name="radar" active={active("/TripRadar")} />
                </View>
              </PressableScale>
            )}
            
            {/* Active Delivery - Hidden if not operational */}
            {isOperational && (
              <PressableScale onPress={() => router.push("/(screens)/ActiveDelivery")}>
                <View className={`w-14 h-14 items-center justify-center ${active("/ActiveDelivery") ? "bg-primary-container rounded-full" : ""}`}>
                  <TabIcon name="delivery" active={active("/ActiveDelivery")} />
                </View>
              </PressableScale>
            )}
            
            {/* Vendor Remittance */}
            <PressableScale onPress={() => router.push("/(screens)/VendorRemittance")}>
              <View className={`w-14 h-14 items-center justify-center ${active("/VendorRemittance") ? "bg-primary-container rounded-full" : ""}`}>
                <TabIcon name="shift" active={active("/VendorRemittance")} />
              </View>
            </PressableScale>

            {/* Profile */}
            <PressableScale onPress={() => router.push("/(screens)/Profile")}>
              <View className={`w-14 h-14 items-center justify-center ${active("/Profile") ? "bg-primary-container rounded-full" : ""}`}>
                <TabIcon name="profile" active={active("/Profile")} />
              </View>
            </PressableScale>
          </View>
        </View>
        )}
      </View>
  );
}
