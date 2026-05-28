/** F-025 FIX: Converted from JS to TypeScript with proper types */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useEffect, useState, ReactNode } from "react";
import { useColorScheme, ColorSchemeName } from "react-native";

interface UIThemeContextType {
  setTheme: () => Promise<void>;
  currentTheme: ColorSchemeName;
}

export const UIThemeContext = createContext<UIThemeContextType>({
  setTheme: async () => {},
  currentTheme: "light",
});

interface Props {
  children: ReactNode;
}

const ThemeContextProvider = ({ children }: Props) => {
  const theme = useColorScheme();
  const [currentTheme, setCurrentTheme] = useState<ColorSchemeName>(theme);
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    const _retrieveTheme = async () => {
      try {
        const value = await AsyncStorage.getItem("THEME");
        if (value !== null && (value === "dark" || value === "light")) {
          setCurrentTheme(value as ColorSchemeName);
          setManualOverride(true);
        }
      } catch (error) {}
    };
    _retrieveTheme();
  }, []);

  const setTheme = async () => {
    try {
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      setCurrentTheme(newTheme);
      setManualOverride(true);
      await AsyncStorage.setItem("THEME", newTheme);
    } catch (error) {
      if (__DEV__) console.error("Theme toggle error:", error);
    }
  };

  useEffect(() => {
    if (!manualOverride && theme) {
      setCurrentTheme(theme);
    }
  }, [theme, manualOverride]);

  return (
    <UIThemeContext.Provider value={{ setTheme, currentTheme }}>
      {children}
    </UIThemeContext.Provider>
  );
};

export default ThemeContextProvider;
