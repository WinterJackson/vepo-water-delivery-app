import 'react-native-gesture-handler';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import ModernToast from '@/components/ui/ModernToast';
import PopupModal from '@/components/ui/PopupModal';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Dimensions, LogBox, AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { ErrorBoundary } from '../components/common/ErrorBoundary';
import ThemeContextProvider from '../context/ThemeContext';
import { initSentry } from '../utils/sentry';
import OfflineBanner from '../components/ui/OfflineBanner';
import "../global.css";
import { initAnalytics } from '../utils/analytics';
import { checkForAppUpdate } from '../utils/appUpdate';
import { UIThemeContext } from '../context/ThemeContext';
import { BRAND } from '../constants/brandColors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutes
      gcTime: 1000 * 60 * 15,         // 15 minutes GC
      retry: 2,
      refetchOnWindowFocus: true,     // Enables refetch on app foreground
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'DROP_CUSTOMER_QUERY_CACHE',
});

import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Silently fail in Expo Go where keep-awake is unavailable
});

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'App update check failed',
]);
 
const { height, width } = Dimensions.get("window");
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const RootAppNavigation = () => {
  const { currentTheme } = React.useContext(UIThemeContext);
  const isDark = currentTheme === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}>
          <BottomSheetModalProvider>
            <OfflineBanner />
            <ErrorBoundary>
              <Stack screenOptions={{ 
                headerShown: false, 
                animation: 'fade',
                contentStyle: { backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight }
              }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(screens)" options={{ headerShown: false }} />
                <Stack.Screen name="(Auth)" options={{ headerShown: false }} />
              </Stack>
            </ErrorBoundary>
          </BottomSheetModalProvider>
        </PersistQueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
};

export default function Layout() {
  // Keep screen awake during app usage
  useKeepAwake();

  // ── Font loading ──
  const [fontsLoaded] = useFonts({
    'Inter_400Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter_500Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter_600SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter_700Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  // ── AppState Focus Manager for React Query ──
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });
    return () => subscription.remove();
  }, []);

  // <------------------HOOKES------------------>
  const darkTheme = useColorScheme() === "dark"

  // Hide the native splash screen once fonts are ready and init production tools
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }

    // Production tools
    initSentry();
    initAnalytics(null as any);
    checkForAppUpdate(process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "");
  }, [fontsLoaded]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(darkTheme ? 'light' : 'dark');
    }
  }, [darkTheme]);

  // <------------------STATES------------------>
  // waits for the native splash screen to hide before starting its timer.
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: darkTheme ? BRAND.bgDark : BRAND.bgLight }}>
        <ThemeContextProvider>
          <RootAppNavigation />
          <ModernToast />
          <PopupModal />
        </ThemeContextProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
