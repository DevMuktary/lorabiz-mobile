import React, { useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Updates from "expo-updates";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import AppLockModal from "../components/AppLockModal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutContent() {
  const { colors, isDark } = useTheme();
  const isCheckingUpdateRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const hasPromptedUpdateRef = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || Updates.isEmergencyLaunch) {
      return;
    }

    const checkAndApplyUpdate = async (autoReloadImmediately: boolean) => {
      const now = Date.now();
      if (isCheckingUpdateRef.current || now - lastCheckAtRef.current < 60_000) {
        return;
      }

      isCheckingUpdateRef.current = true;
      lastCheckAtRef.current = now;

      try {
        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable) {
          return;
        }

        const result = await Updates.fetchUpdateAsync();
        if (!result.isNew) {
          return;
        }

        if (autoReloadImmediately) {
          await Updates.reloadAsync();
        } else if (!hasPromptedUpdateRef.current) {
          hasPromptedUpdateRef.current = true;
          Alert.alert(
            "Update Available",
            "A new version of LoraBiz has been downloaded. Restart now to load the latest features.",
            [
              { text: "Later", style: "cancel" },
              {
                text: "Restart Now",
                onPress: () => {
                  Updates.reloadAsync().catch(() => {});
                },
              },
            ]
          );
        }
      } catch {
        // Ignore transient offline or rate-limit update check errors
      } finally {
        isCheckingUpdateRef.current = false;
      }
    };

    checkAndApplyUpdate(true);

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkAndApplyUpdate(false);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            animation: "none",
            contentStyle: { backgroundColor: "#C82D75" },
          }}
        />
        <Stack.Screen name="(auth)" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="wallet/fund"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="wallet/transaction/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="wallet/disputes"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="wallet/transaction/dispute/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen name="services/annual-returns" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/annual-returns-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/business-name" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/business-name-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/tax-id" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/tax-id-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/scuml" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/scuml-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-validation" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-validation-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-modification" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-modification-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-personalization" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-personalization-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-ipe" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-ipe-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/nin-slip" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/bvn-slip" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/bvn-retrieval" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/bvn-retrieval-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/bvn-modification" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/bvn-modification-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="services/slip-history" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen
          name="profile/personal-details"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="profile/settings"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="profile/security"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="profile/legal"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
      </Stack>
      <AppLockModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <RootLayoutContent />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

