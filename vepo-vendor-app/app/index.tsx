import { useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { AnimatedSplash } from "@/components/splash/AnimatedSplash";
import VendorApiRoutes from "@/API/routes/VendorApiRoutes";

export default function Index() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const [splashDone, setSplashDone] = useState(false);
  const [isVerifyingProfile, setIsVerifyingProfile] = useState(false);
  const [readyToRoute, setReadyToRoute] = useState<"onboarding" | "main" | null>(null);

  useEffect(() => {
    const verifyOnboardingAndProceed = async () => {
      if (!isSignedIn) return;
      setIsVerifyingProfile(true);
      try {
        const token = await getToken();
        // The backend exposes /api/auth/profile-status internally 
        // We'll reuse the BASE_URL logic from VendorApiRoutes to form this specific URL
        const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? "";
        const res = await fetch(`${BASE_URL}/api/auth/profile-status?app_type=vendor`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.exists || (data.missing_fields && data.missing_fields.length > 0)) {
            setReadyToRoute("onboarding");
          } else {
            // Fetch stores to integrate multi-store selection into startup flow
            const storesRes = await fetch(`${BASE_URL}/api/vendor/stores`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (storesRes.ok) {
                const stores = await storesRes.json();
                if (stores.length > 1) {
                    // Owner with multiple stores: Here we could route to a StoreSelector screen.
                    // For now, we route to main and let them switch from the Header.
                    setReadyToRoute("main");
                } else if (stores.length === 1) {
                    // Staff member or single-store Owner: Automatically routed into their store's dashboard
                    setReadyToRoute("main");
                } else {
                    setReadyToRoute("onboarding");
                }
            } else {
                setReadyToRoute("main");
            }
          }
        } else {
          setReadyToRoute("onboarding");
        }
      } catch (e) {
        setReadyToRoute("onboarding");
      } finally {
        setIsVerifyingProfile(false);
      }
    };

    if (splashDone && isLoaded) {
      if (isSignedIn) verifyOnboardingAndProceed();
    }
  }, [splashDone, isLoaded, isSignedIn]);

  // Show splash until both animation completes AND Clerk auth resolves
  // We also wait for the profile verification to finish cleanly if they are signed in.
  const canProceed = splashDone && isLoaded;
  const isFullyReady = canProceed && (!isSignedIn || readyToRoute !== null);

  if (!isFullyReady) {
    return (
      <AnimatedSplash
        variant="vendor"
        isDark={darkTheme}
        onComplete={() => setSplashDone(true)}
      />
    );
  }

  if (isSignedIn) {
    if (readyToRoute === "onboarding") return <Redirect href="/(Auth)/Onboarding" />;
    return <Redirect href="/(screens)" />;
  }
  return <Redirect href="/(Auth)" />;
}
