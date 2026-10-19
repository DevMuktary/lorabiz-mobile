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
import { colors } from "../constants/theme";
import { useAuth } from "../context/AuthContext";

export default function AppLockModal() {
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          {/* Lock Icon */}
          <View style={styles.iconCircle}>
            <Lock size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>Session Locked</Text>
          <Text style={styles.subtitle}>
            Confirm your identity to continue where you left off.
          </Text>

          {/* User Badge */}
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeLabel}>Signed In Account</Text>
            <Text style={styles.userBadgeName}>{displayName}</Text>
            {user?.email && <Text style={styles.userBadgeEmail}>{user.email}</Text>}
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
              style={styles.primaryBtn}
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
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your account password"
                  placeholderTextColor="#64748B"
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
                    <EyeOff size={18} color="#94A3B8" />
                  ) : (
                    <Eye size={18} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
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
                  <Text style={styles.switchOptionText}>Use Biometrics Instead</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowPasswordForm(true)}
              style={styles.switchOptionBtn}
            >
              <Text style={styles.switchOptionText}>Unlock with Password</Text>
            </TouchableOpacity>
          )}

          {/* Explicit Sign Out Button */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={logout}
            activeOpacity={0.7}
          >
            <LogOut size={15} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070B14", // Luxury Lorabiz dark canvas
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
    backgroundColor: "rgba(200, 45, 117, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(200, 45, 117, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  userBadge: {
    width: "100%",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  userBadgeLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  userBadgeName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  userBadgeEmail: {
    fontSize: 12,
    color: "#94A3B8",
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
    color: "#FCA5A5",
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    backgroundColor: colors.primary, // #C82D75
    borderRadius: 12,
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
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 48,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
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
    color: "#94A3B8",
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
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
});
