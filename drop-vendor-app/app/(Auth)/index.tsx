import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";

export default function AuthIndex() {
  useFocusEffect(
    useCallback(() => {
      router.replace("/(Auth)/sign-in/screen");
    }, [])
  );
  return null;
}
