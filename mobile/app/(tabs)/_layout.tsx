import React, { useState, useEffect } from "react";
import { Tabs, Redirect } from "expo-router";
import { LayoutDashboard, Briefcase, Clock, User } from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import BiometricPromptModal from "../../components/BiometricPromptModal";
import CustomAlertModal from "../../components/CustomAlertModal";
import { getBioPromptDismissed, setBioPromptDismissed } from "../../lib/storage";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const {
    token,
    isLoading,
    user,
    biometricAvailable,
    biometricEnabled,
    toggleBiometrics,
  } = useAuth();
  const bottomInset = insets.bottom;
  const bottomPadding = Math.max(bottomInset, Platform.OS === "ios" ? 16 : 8);
  const tabHeight = 52 + bottomPadding;

  const [showBioPrompt, setShowBioPrompt] = useState(false);
  const [isSettingUpBio, setIsSettingUpBio] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: "success" | "warning" | "error" | "info" | "confirm";
    title: string;
    message: string;
    confirmText?: string;
  }>({ visible: false, title: "", message: "" });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    async function checkBioPrompt() {
      if (!token || !user || !biometricAvailable || biometricEnabled) return;
      const dismissed = await getBioPromptDismissed();
      if (dismissed) return;

      timer = setTimeout(() => {
        setShowBioPrompt(true);
      }, 1500);
    }

    checkBioPrompt();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [token, user, biometricAvailable, biometricEnabled]);

  async function handleSetupBio() {
    setIsSettingUpBio(true);
    try {
      const success = await toggleBiometrics(true);
      setShowBioPrompt(false);
      if (success) {
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Face ID Enabled",
          message: "Face ID has been set up for your account. You can now use it to sign in instantly.",
          confirmText: "Awesome",
        });
      } else {
        setAlertConfig({
          visible: true,
          type: "warning",
          title: "Setup Cancelled",
          message: "Biometric setup could not be completed at this time.",
          confirmText: "OK",
        });
      }
    } catch {
      setShowBioPrompt(false);
    } finally {
      setIsSettingUpBio(false);
    }
  }

  async function handleDismissBioForever() {
    await setBioPromptDismissed(true);
    setShowBioPrompt(false);
  }

  if (!isLoading && !token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceBorder,
          borderTopWidth: 1,
          height: tabHeight,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="slips"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          href: null,
        }}
      />
    </Tabs>

    <BiometricPromptModal
      visible={showBioPrompt}
      isLoading={isSettingUpBio}
      onSetup={handleSetupBio}
      onDismissForever={handleDismissBioForever}
      onClose={() => setShowBioPrompt(false)}
    />

    <CustomAlertModal
      visible={alertConfig.visible}
      type={alertConfig.type}
      title={alertConfig.title}
      message={alertConfig.message}
      confirmText={alertConfig.confirmText}
      onConfirm={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
    />
  </>
  );
}
