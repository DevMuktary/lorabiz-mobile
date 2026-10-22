import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useColorScheme, Appearance, AppState } from "react-native";
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
  const hookScheme = useColorScheme();
  const [currentSystemScheme, setCurrentSystemScheme] = useState<"light" | "dark">(
    Appearance.getColorScheme() === "dark" || hookScheme === "dark" ? "dark" : "light"
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system"); // Default to device system theme

  useEffect(() => {
    let isMounted = true;
    getThemeModePref().then((stored) => {
      if (isMounted && stored) {
        setThemeModeState(stored);
      }
    });

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (isMounted && colorScheme) {
        setCurrentSystemScheme(colorScheme === "dark" ? "dark" : "light");
      }
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && isMounted) {
        const osScheme = Appearance.getColorScheme();
        if (osScheme) {
          setCurrentSystemScheme(osScheme === "dark" ? "dark" : "light");
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
      appStateSub.remove();
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await setThemeModePref(mode);
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === "dark") return true;
    if (themeMode === "light") return false;
    // "system": follows device OS setting in real-time
    const activeScheme = hookScheme || currentSystemScheme || Appearance.getColorScheme() || "light";
    return activeScheme === "dark";
  }, [themeMode, currentSystemScheme, hookScheme]);

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

const defaultThemeValue: ThemeContextType = {
  themeMode: "system",
  isDark: false,
  colors: lightColors,
  setThemeMode: async () => {},
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return defaultThemeValue;
  }
  return context;
}

