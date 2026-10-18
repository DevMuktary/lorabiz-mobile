import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Shield, Fingerprint, LogOut } from "lucide-react-native";
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";

interface AppLockModalProps {
  visible: boolean;
}

export default function AppLockModal({ visible }: AppLockModalProps) {
  const router = useRouter();
  const { user, unlockApp, logout, biometricAvailable } = useAuth();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleUnlock() {
    setIsUnlocking(true);
    setErrorMessage(null);
    try {
      const unlocked = await unlockApp();
      if (!unlocked) {
        setErrorMessage("Biometric verification not confirmed. Please try again.");
      }
    } catch {
      setErrorMessage("Could not verify identity. Please try again.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  const displayName = user?.name || user?.firstName || "User";

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Shield size={44} color={colors.primary} />
          </View>

          <Text style={styles.title}>Lorabiz Security Lock</Text>
          <Text style={styles.subtitle}>
            Your session was locked due to inactivity. Verify your identity to resume.
          </Text>

          <View style={styles.userBadge}>
            <Text style={styles.userBadgeLabel}>Signed in as</Text>
            <Text style={styles.userBadgeName}>{displayName}</Text>
            <Text style={styles.userBadgeEmail}>{user?.email}</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {biometricAvailable ? (
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={handleUnlock}
              disabled={isUnlocking}
              activeOpacity={0.88}
            >
              {isUnlocking ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Fingerprint size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.unlockBtnText}>Unlock with Biometrics</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={16} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.signOutText}>Sign In with Password</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  content: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(200, 45, 117, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(200, 45, 117, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  userBadge: {
    width: "100%",
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  userBadgeLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  userBadgeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  userBadgeEmail: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  unlockBtn: {
    width: "100%",
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14,
  },
  unlockBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  signOutText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
});
