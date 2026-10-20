import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "none",
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
        <Stack.Screen name="(auth)" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
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
          name="wallet/transaction/dispute/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen name="services/nin-validation" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="services/nin-validation-history" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="services/nin-modification" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="services/nin-modification-history" options={{ headerShown: false, animation: "none" }} />
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

