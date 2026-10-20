import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useColorScheme } from "react-native";
import { lightColors, darkColors } from "../constants/theme";
import { getThemeModePref, setThemeModePref, ThemeMode } from "../lib/storage";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: typeof lightColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light"); // Default light per specification

  useEffect(() => {
    let isMounted = true;
    getThemeModePref().then((stored) => {
      if (isMounted && stored) {
        setThemeModeState(stored);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await setThemeModePref(mode);
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === "dark") return true;
    if (themeMode === "light") return false;
    // "system"
    return systemScheme === "dark";
  }, [themeMode, systemScheme]);

  const activeColors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors: activeColors,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
