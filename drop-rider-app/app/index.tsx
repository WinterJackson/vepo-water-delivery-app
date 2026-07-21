import { useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import { AnimatedSplash } from "@/components/splash/AnimatedSplash";

export default function Index() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";

  const [splashDone, setSplashDone] = useState(false);
  const [isVerifyingProfile, setIsVerifyingProfile] = useState(false);
  const [readyToRoute, setReadyToRoute] = useState<"onboarding" | "main" | null>(null);
  
  // Follow Customer App pattern for fallback
  const fallbackTimeoutMs = 5000;

  useEffect(() => {
    const verifyOnboardingAndProceed = async () => {
      if (!isSignedIn) return;
      setIsVerifyingProfile(true);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), fallbackTimeoutMs);
      
      try {
        const token = await getToken();
        // The backend exposes /api/auth/profile-status internally 
        const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? "";
        const res = await fetch(`${BASE_URL}/api/auth/profile-status?app_type=rider`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.exists || (data.missing_fields && data.missing_fields.length > 0)) {
            setReadyToRoute("onboarding");
          } else {
            setReadyToRoute("main");
          }
        } else {
          setReadyToRoute("onboarding");
        }
      } catch (e) {
        // Fallback to onboarding if network fails or unregistered
        setReadyToRoute("onboarding");
      } finally {
        clearTimeout(timeoutId);
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
        variant="rider"
        isDark={darkTheme}
        onComplete={() => setSplashDone(true)}
      />
    );
  }

  // EXACT emulation of customer app fallback routing
  if (isSignedIn) {
    if (readyToRoute === "onboarding") return <Redirect href={"/(Auth)/Onboarding" as any} />;
    return <Redirect href={"/(screens)" as any} />;
  } else {
    return <Redirect href={"/(Auth)" as any} />;
  }
}

