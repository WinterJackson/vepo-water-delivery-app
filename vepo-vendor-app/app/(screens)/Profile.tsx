import { UIThemeContext } from "@/context/ThemeContext";
import { useContext } from "react";
import { useUser } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import {
    ScrollView,
    StatusBar,
    Text,
    View,
    TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { BRAND } from "@/constants/brandColors";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVendorProfile } from "@/hooks/queries/useVendorProfile";

export default function Profile() {
  const { currentTheme, setTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { user } = useUser();
  const router = useRouter();

  const { data: vendor } = useVendorProfile();
  const isStaff = vendor?.role === "staff";

  const NavItem = ({ icon, label, description, path }: { icon: any, label: string, description: string, path: string }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(path as any);
      }}
      className={`rounded-3xl p-5 mb-3 flex-row items-center border ${darkTheme ? "bg-surface-container" : "bg-white border-gray-100"}`}
      style={darkTheme ? {} : { 
        ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) 
      }}
    >
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
        <Ionicons name={icon} size={24} color={BRAND.primary} />
      </View>
      <View className="flex-1">
        <Text className={`text-lg font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{label}</Text>
        <Text className={`text-sm mt-1 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={BRAND.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

      {/* Header */}
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
          <Text className={`text-xl font-bold flex-1 ${darkTheme ? "text-white" : "text-slate-900"}`}>Settings</Text>

          {/* THEME TOGGLE — matches Customer & Rider app pattern */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTheme();
            }}
          >
            <View className={`w-10 h-10 items-center justify-center rounded-full ${darkTheme ? "bg-gray-800" : "bg-white"}`}>
              <Ionicons name={darkTheme ? "sunny-outline" : "moon-outline"} size={22} color={BRAND.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hub Header */}
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
            {vendor?.business_name || "Settings Hub"}
          </Text>
          <Text className={`text-base mt-1 font-medium ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Managed by {user?.fullName || "Owner"}
          </Text>
        </View>

        <Text className={`mb-4 ml-2 font-bold text-xl tracking-tight ${darkTheme ? "text-white" : "text-slate-900"}`}>Account & Identity</Text>
        
        {!isStaff && (
          <>
            <NavItem 
              icon="storefront-outline" 
              label="Store Profile" 
              description="Manage public store details and operations" 
              path="/(screens)/StoreProfile" 
            />
            
            <NavItem 
              icon="person-circle-outline" 
              label="Owner Profile" 
              description="Manage personal KYC and sign-in details" 
              path="/(screens)/OwnerProfile" 
            />
          </>
        )}

        <Text className={`mt-6 mb-4 ml-2 font-bold text-xl tracking-tight ${darkTheme ? "text-white" : "text-slate-900"}`}>Business Tools</Text>
        
        {!isStaff && (
          <NavItem 
            icon="wallet-outline" 
            label="Wallet & Cashout" 
            description="Manage your earnings and payouts" 
            path="/(screens)/Cashout" 
          />
        )}
        
        <NavItem 
          icon="map-outline" 
          label="Live Map" 
          description="Track active orders and riders" 
          path="/(screens)/MyMap" 
        />

        <NavItem 
          icon="key-outline" 
          label="Vendor Remittances" 
          description="Verify pickup remittances" 
          path="/(screens)/VendorRemittanceDashboard" 
        />
        
        {!isStaff && (
          <NavItem 
            icon="people-outline" 
            label={vendor?.vendor_type === "wholesale_b2b" ? "Link TukTuk Drivers" : "Manage Riders"}
            description={vendor?.vendor_type === "wholesale_b2b" ? "Link drivers to your Vendor ID" : "View and approve gig rider applications"}
            path="/(screens)/RiderManagement" 
          />
        )}

        <Text className={`mt-6 mb-4 ml-2 font-bold text-xl tracking-tight ${darkTheme ? "text-white" : "text-slate-900"}`}>System & Security</Text>
        
        <NavItem 
          icon="options-outline" 
          label="Advanced Settings" 
          description="Manage operating hours, payouts, and sign out" 
          path="/(screens)/SettingsMain" 
        />
      </ScrollView>
    </SafeAreaView>
  );
}
