import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useContext, useEffect } from "react";
import { Dimensions, StatusBar, View } from "react-native";

export const useWarmUpBrowser = () => {
  useEffect(() => {
    // Preloads the browser for Android devices to reduce authentication load time
    // See: https://docs.expo.dev/guides/authentication/#improving-user-experience
    void WebBrowser.warmUpAsync();
    return () => {
      // Cleanup: closes browser when component unmounts
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");

const Layout = () => {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const { currentTheme } = useContext(UIThemeContext);
  const { user } = useUser();
  const darkTheme = currentTheme === "dark";
  const statusbarHeight = StatusBar.currentHeight || 50;

  useWarmUpBrowser();

  return (
    <>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <View
        className={`absolute ${darkTheme ? "bg-black" : ""}`}
        style={{ minHeight: height + statusbarHeight, minWidth: width }}
      >
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
      </View>
    </>
  );
};

export default Layout;

