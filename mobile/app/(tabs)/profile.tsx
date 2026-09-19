import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  User,
  Fingerprint,
  Shield,
  FileText,
  Lock,
  LogOut,
  Trash2,
  ChevronRight,
  ExternalLink,
  Info,
  Sparkles,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import { useQuery } from "@tanstack/react-query";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user,
    logout,
    biometricAvailable,
    biometricEnabled,
    toggleBiometrics,
  } = useAuth();

  const [isDeactivating, setIsDeactivating] = useState(false);

  // Custom Branded Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    isDestructive?: boolean;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ["mobileLoyaltyProfile"],
    queryFn: async () => {
      try {
        return await api.get("/api/user/loyalty");
      } catch {
        return null;
      }
    },
  });

  const currentTierObj = loyaltyData?.profile?.currentTier || loyaltyData?.currentTier;
  const tierName = currentTierObj?.name || loyaltyData?.profile?.tier || "Gold";
  const tierColor =
    currentTierObj?.colorHex ||
    (tierName.toLowerCase().includes("silver")
      ? "#64748B"
      : tierName.toLowerCase().includes("platinum")
      ? "#0284C7"
      : tierName.toLowerCase().includes("bronze")
      ? "#B45309"
      : "#D97706");

  async function handleToggleBiometrics(val: boolean) {
    const success = await toggleBiometrics(val);
    if (!success && val) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Biometric Notice",
        message: "Biometric verification could not be completed on this device.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  }

  function handleLogout() {
    setAlertConfig({
      visible: true,
      type: "confirm",
      title: "Sign Out",
      message: "Are you sure you want to sign out of Lorabiz?",
      confirmText: "Sign Out",
      cancelText: "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        await logout();
        router.replace("/(auth)/login");
      },
      onCancel: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
    });
  }

  function handleCloseAccount() {
    setAlertConfig({
      visible: true,
      type: "confirm",
      title: "Deactivate Account",
      message:
        "Are you sure you want to deactivate your Lorabiz account? Your active session will be signed out and your profile closed. Past transaction records are retained in compliance with financial regulations.",
      confirmText: "Deactivate",
      cancelText: "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        setIsDeactivating(true);
        try {
          const res = await api.post("/api/user/deactivate");
          if (res?.success) {
            setAlertConfig({
              visible: true,
              type: "success",
              title: "Account Deactivated",
              message: "Your account has been deactivated. You have been signed out.",
              confirmText: "OK",
              onConfirm: async () => {
                setAlertConfig((prev) => ({ ...prev, visible: false }));
                await logout();
                router.replace("/(auth)/login");
              },
            });
          } else {
            setAlertConfig({
              visible: true,
              type: "error",
              title: "Error",
              message: res?.message || "Could not deactivate account.",
              confirmText: "OK",
              onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
            });
          }
        } catch {
          setAlertConfig({
            visible: true,
            type: "error",
            title: "Network Error",
            message: "Unable to reach the server. Please check your internet connection.",
            confirmText: "OK",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
        } finally {
          setIsDeactivating(false);
        }
      },
      onCancel: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: Math.max(insets.bottom, 16) + 72,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account & Settings</Text>
      </View>

      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={{ position: "relative" }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.firstName?.[0] || "U").toUpperCase()}
            </Text>
          </View>
          <View style={[styles.avatarTierBadge, { backgroundColor: tierColor }]}>
            <Sparkles size={11} color="#FFFFFF" />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.userName}>{user?.name || "Lorabiz Customer"}</Text>
          <View style={[styles.tierPill, { backgroundColor: tierColor + "18", borderColor: tierColor + "40" }]}>
            <Sparkles size={10} color={tierColor} style={{ marginRight: 4 }} />
            <Text style={[styles.tierPillText, { color: tierColor }]}>{tierName} Member</Text>
          </View>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.phone ? (
            <Text style={styles.userPhone}>{user.phone}</Text>
          ) : null}
          {user?.referralCode ? (
            <View style={styles.refBadge}>
              <Text style={styles.refText}>Referral: {user.referralCode}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Security Section */}
      <Text style={styles.sectionHeading}>Security & Access</Text>
      <View style={styles.menuCard}>
        {biometricAvailable ? (
          <View style={styles.menuItem}>
            <View style={styles.menuIconBox}>
              <Fingerprint size={20} color={colors.primaryLight} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuTitle}>Biometric Unlock</Text>
              <Text style={styles.menuSub}>Face ID / Fingerprint login</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        ) : null}

        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <View style={styles.menuIconBox}>
            <Shield size={20} color={colors.success} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuTitle}>Two-Factor Authentication</Text>
            <Text style={styles.menuSub}>
              {user?.twoFactorEnabled ? "Active & Enforced" : "Disabled"}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: user?.twoFactorEnabled ? "#10B98122" : "#64748B22" },
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                { color: user?.twoFactorEnabled ? colors.success : colors.textMuted },
              ]}
            >
              {user?.twoFactorEnabled ? "ON" : "OFF"}
            </Text>
          </View>
        </View>
      </View>

      {/* Legal & Policy Section */}
      <Text style={styles.sectionHeading}>Legal & Compliance</Text>
      <View style={styles.menuCard}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() =>
            setAlertConfig({
              visible: true,
              type: "info",
              title: "Regulatory Disclaimer",
              message:
                "Lorabiz is an independent corporate facilitation and business management platform. We are an accredited corporate services facilitator and not an agency of the Corporate Affairs Commission (CAC) or the Federal Government of Nigeria.",
              confirmText: "Understood",
              onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
            })
          }
        >
          <View style={styles.menuIconBox}>
            <Info size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuTitle}>Regulatory Disclaimer</Text>
            <Text style={styles.menuSub}>Corporate facilitation notice</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Linking.openURL("https://lorabiz.com/terms")}
        >
          <View style={styles.menuIconBox}>
            <FileText size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuTitle}>Terms & Conditions</Text>
            <Text style={styles.menuSub}>User service agreements</Text>
          </View>
          <ExternalLink size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={() => Linking.openURL("https://lorabiz.com/privacy")}
        >
          <View style={styles.menuIconBox}>
            <Lock size={20} color={colors.cyan} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuTitle}>Privacy Policy</Text>
            <Text style={styles.menuSub}>NDPR & data protection policy</Text>
          </View>
          <ExternalLink size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <Text style={styles.sectionHeading}>Account Actions</Text>
      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <View style={[styles.menuIconBox, { backgroundColor: "#EF444422" }]}>
            <LogOut size={20} color={colors.error} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>Sign Out</Text>
            <Text style={styles.menuSub}>End current mobile session</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={handleCloseAccount}
          disabled={isDeactivating}
        >
          <View style={[styles.menuIconBox, { backgroundColor: "#EF444422" }]}>
            {isDeactivating ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Trash2 size={20} color={colors.error} />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>
              Deactivate Account
            </Text>
            <Text style={styles.menuSub}>
              Close profile (Retains history for compliance)
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>Lorabiz Mobile • Version 1.0.0 (Build 100)</Text>

      {/* Custom Luxury Alert Modal */}
      <CustomAlertModal {...alertConfig} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  avatarTierBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  refBadge: {
    backgroundColor: "#C82D7522",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  refText: {
    fontSize: 11,
    color: colors.primaryLight,
    fontWeight: "700",
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  menuSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 10,
  },
});
