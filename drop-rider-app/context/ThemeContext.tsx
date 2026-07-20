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

  const _retrieveTheme = async () => {
    try {
      const value = await AsyncStorage.getItem("THEME");
      if (value !== null) {
        setCurrentTheme(value as ColorSchemeName);
        return true;
      }
    } catch (error) {
      // Error retrieving data
    }
    return false;
  };

  const setTheme = async () => {
    try {
      if (currentTheme === "dark") {
        setCurrentTheme("light");
        await AsyncStorage.setItem("THEME", "light");
      } else {
        setCurrentTheme("dark");
        await AsyncStorage.setItem("THEME", "dark");
      }
    } catch (error) {
      if (__DEV__) console.error("Theme toggle error:", error);
    }
  };

  useEffect(() => {
    const initTheme = async () => {
      const hasStoredTheme = await _retrieveTheme();
      if (!hasStoredTheme && theme) {
        setCurrentTheme(theme);
        try {
          await AsyncStorage.setItem("THEME", theme);
        } catch (error) {
          // Silent fail for storage
        }
      }
    };
    initTheme();
  }, []);

  return (
    <UIThemeContext.Provider value={{ setTheme, currentTheme }}>
      {children}
    </UIThemeContext.Provider>
  );
};

export default ThemeContextProvider;
