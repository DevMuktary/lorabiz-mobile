import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Lock, Fingerprint, LogOut, Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { colors as defaultColors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function AppLockModal() {
  const { colors, isDark } = useTheme();
  const {
    user,
    isAppLocked,
    unlockApp,
    unlockWithPassword,
    logout,
    biometricAvailable,
    biometricEnabled,
  } = useAuth();

  const [isVerifyingBio, setIsVerifyingBio] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasAutoPromptedRef = useRef(false);

  // Auto-prompt biometrics when the lock modal appears
  useEffect(() => {
    if (isAppLocked && biometricAvailable && biometricEnabled && !hasAutoPromptedRef.current) {
      hasAutoPromptedRef.current = true;
      const t = setTimeout(() => {
        handleBiometricUnlock();
      }, 350);
      return () => clearTimeout(t);
    }
    if (!isAppLocked) {
      hasAutoPromptedRef.current = false;
      setPassword("");
      setShowPasswordForm(false);
      setErrorMessage(null);
    }
  }, [isAppLocked, biometricAvailable, biometricEnabled]);

  async function handleBiometricUnlock() {
    setIsVerifyingBio(true);
    setErrorMessage(null);
    try {
      const success = await unlockApp();
      if (!success) {
        setErrorMessage("Biometric verification not confirmed. Please try again or use password.");
      }
    } catch {
      setErrorMessage("Could not verify identity. Please use your password.");
    } finally {
      setIsVerifyingBio(false);
    }
  }

  async function handlePasswordUnlock() {
    if (!password.trim()) {
      setErrorMessage("Please enter your account password");
      return;
    }

    setIsVerifyingPassword(true);
    setErrorMessage(null);
    try {
      const success = await unlockWithPassword(password.trim());
      if (success) {
        setPassword("");
      } else {
        setErrorMessage("Incorrect password. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to verify password. Please try again.");
    } finally {
      setIsVerifyingPassword(false);
    }
  }

  if (!isAppLocked) return null;

  const displayName = user?.name || user?.firstName || "Account Owner";

  return (
    <Modal
      visible={isAppLocked}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          {/* Lock Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark ? "rgba(200, 45, 117, 0.12)" : "rgba(200, 45, 117, 0.08)",
                borderColor: isDark ? "rgba(200, 45, 117, 0.35)" : "rgba(200, 45, 117, 0.22)",
              },
            ]}
          >
            <Lock size={36} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Session Locked</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Confirm your identity to continue where you left off.
          </Text>

          {/* User Badge */}
          <View
            style={[
              styles.userBadge,
              {
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.85)" : colors.surface,
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder,
              },
            ]}
          >
            <Text style={[styles.userBadgeLabel, { color: colors.textMuted }]}>Signed In Account</Text>
            <Text style={[styles.userBadgeName, { color: colors.text }]}>{displayName}</Text>
            {user?.email && (
              <Text style={[styles.userBadgeEmail, { color: colors.textSecondary }]}>
                {user.email}
              </Text>
            )}
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Biometrics Button */}
          {biometricAvailable && biometricEnabled && !showPasswordForm ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleBiometricUnlock}
              disabled={isVerifyingBio}
              activeOpacity={0.88}
            >
              {isVerifyingBio ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Fingerprint size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Unlock with Biometrics</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Password Option */}
          {showPasswordForm ? (
            <View style={styles.passwordForm}>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.9)" : colors.surface,
                    borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : colors.surfaceBorder,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter your account password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handlePasswordUnlock}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handlePasswordUnlock}
                disabled={isVerifyingPassword}
                activeOpacity={0.88}
              >
                {isVerifyingPassword ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Unlock Session</Text>
                )}
              </TouchableOpacity>

              {biometricAvailable && biometricEnabled && (
                <TouchableOpacity
                  onPress={() => setShowPasswordForm(false)}
                  style={styles.switchOptionBtn}
                >
                  <Text style={[styles.switchOptionText, { color: colors.textSecondary }]}>
                    Use Biometrics Instead
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowPasswordForm(true)}
              style={styles.switchOptionBtn}
            >
              <Text style={[styles.switchOptionText, { color: colors.textSecondary }]}>
                Unlock with Password
              </Text>
            </TouchableOpacity>
          )}

          {/* Explicit Sign Out Button */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={logout}
            activeOpacity={0.7}
          >
            <LogOut size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.signOutText, { color: colors.textMuted }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  userBadge: {
    width: "100%",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
  },
  userBadgeLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  userBadgeName: {
    fontSize: 15,
    fontWeight: "700",
  },
  userBadgeEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  errorBox: {
    width: "100%",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  passwordForm: {
    width: "100%",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  switchOptionBtn: {
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 6,
  },
  switchOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

