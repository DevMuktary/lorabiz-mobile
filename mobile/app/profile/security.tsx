import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Fingerprint,
  Shield,
  KeyRound,
  Clock,
  ChevronRight,
  X,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const {
    user,
    biometricAvailable,
    biometricEnabled,
    toggleBiometrics,
    autoLockTimeout,
    setAutoLockSetting,
    refreshProfile,
  } = useAuth();

  // Active Dialog state
  const [activeDialog, setActiveDialog] = useState<
    "CHANGE_PASSWORD" | "TWO_FACTOR" | "AUTO_LOCK" | null
  >(null);

  // Change Password Form State
  const [passwordStep, setPasswordStep] = useState<"CURRENT" | "NEW">("CURRENT");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA Management State
  const [twoFactorMethod, setTwoFactorMethod] = useState<"AUTHENTICATOR" | "EMAIL">("AUTHENTICATOR");
  const [twoFactorQrCode, setTwoFactorQrCode] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [twoFactorOtp, setTwoFactorOtp] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Custom Branded Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  // Handle Toggle Biometrics
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

  // =========================================================================
  // Change Password Handlers
  // =========================================================================
  function handleOpenChangePassword() {
    setPasswordStep("CURRENT");
    setPasswordError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordOtp("");
    setActiveDialog("CHANGE_PASSWORD");
  }

  async function handleSendPasswordOtp() {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    setIsPasswordLoading(true);
    try {
      const res = await api.post("/api/user/security/password", {
        action: "SEND_OTP",
        currentPassword,
      });

      if (res?.success) {
        setPasswordStep("NEW");
      } else {
        setPasswordError(res?.message || "Incorrect current password.");
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Could not verify password. Please try again.");
    } finally {
      setIsPasswordLoading(false);
    }
  }

  async function handleVerifyNewPassword() {
    setPasswordError(null);
    if (!passwordOtp || passwordOtp.trim().length < 6) {
      setPasswordError("Please enter the 6-digit code sent to your email.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsPasswordLoading(true);
    try {
      const res = await api.post("/api/user/security/password", {
        action: "VERIFY_OTP",
        otpCode: passwordOtp.trim(),
        newPassword,
      });

      if (res?.success) {
        setActiveDialog(null);
        setPasswordStep("CURRENT");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordOtp("");
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Password Changed",
          message: "Your account password has been updated securely.",
          confirmText: "Done",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      } else {
        setPasswordError(res?.message || "Failed to update password.");
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password.");
    } finally {
      setIsPasswordLoading(false);
    }
  }

  // =========================================================================
  // 2FA Handlers
  // =========================================================================
  function handleOpen2FA() {
    setTwoFactorError(null);
    setTwoFactorOtp("");
    setDisablePassword("");
    if (!user?.twoFactorEnabled) {
      handleInit2FASetup("AUTHENTICATOR");
    }
    setActiveDialog("TWO_FACTOR");
  }

  async function handleInit2FASetup(method: "AUTHENTICATOR" | "EMAIL") {
    setTwoFactorMethod(method);
    setTwoFactorError(null);
    setTwoFactorOtp("");
    setIs2FALoading(true);
    try {
      const res = await api.post("/api/auth/2fa/setup", { method });
      if (res?.success) {
        setTwoFactorSecret(res.secret || null);
        setTwoFactorQrCode(res.qrCode || null);
      } else {
        setTwoFactorError(res?.error || "Could not initialize two-factor setup.");
      }
    } catch (err: any) {
      setTwoFactorError(err?.message || "Could not initialize two-factor setup.");
    } finally {
      setIs2FALoading(false);
    }
  }

  async function handleConfirm2FASetup() {
    setTwoFactorError(null);
    if (!twoFactorOtp || twoFactorOtp.trim().length < 6) {
      setTwoFactorError("Please enter the 6-digit verification code.");
      return;
    }

    setIs2FALoading(true);
    try {
      const res = await api.post("/api/auth/2fa/confirm-setup", {
        method: twoFactorMethod,
        code: twoFactorOtp.trim(),
      });

      if (res?.success) {
        await refreshProfile();
        setActiveDialog(null);
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Two-Factor Enabled",
          message: "Two-Factor Authentication is now active on your Lorabiz account.",
          confirmText: "Done",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      } else {
        setTwoFactorError(res?.error || "Invalid verification code.");
      }
    } catch (err: any) {
      setTwoFactorError(err?.message || "Verification failed. Check your code.");
    } finally {
      setIs2FALoading(false);
    }
  }

  async function handleDisable2FA() {
    setTwoFactorError(null);
    if (!disablePassword) {
      setTwoFactorError("Please enter your account password to confirm.");
      return;
    }

    setIs2FALoading(true);
    try {
      const res = await api.post("/api/auth/2fa/disable", {
        password: disablePassword,
      });

      if (res?.success) {
        await refreshProfile();
        setActiveDialog(null);
        setDisablePassword("");
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Two-Factor Disabled",
          message: "Two-factor authentication has been turned off.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      } else {
        setTwoFactorError(res?.error || "Incorrect password.");
      }
    } catch (err: any) {
      setTwoFactorError(err?.message || "Failed to disable two-factor authentication.");
    } finally {
      setIs2FALoading(false);
    }
  }

  function handleCopySecret() {
    if (twoFactorSecret) {
      try {
        if (Clipboard && typeof (Clipboard as any).setString === "function") {
          Clipboard.setString(twoFactorSecret);
        }
      } catch {}
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  }

  const getAutoLockLabel = (timeout: string) => {
    switch (timeout) {
      case "immediately":
        return "Immediate";
      case "1m":
        return "1 Min";
      case "5m":
        return "5 Mins";
      case "15m":
        return "15 Mins";
      case "30m":
        return "30 Mins";
      case "1h":
        return "1 Hour";
      case "2h":
        return "2 Hours";
      default:
        return "Never";
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 16),
            backgroundColor: colors.surfaceElevated,
            borderBottomColor: colors.surfaceBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Security</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Access Control */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>Access Control</Text>
        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          {/* Biometrics Toggle */}
          {biometricAvailable ? (
            <View
              style={[
                styles.menuItem,
                {
                  borderBottomColor: isDark
                    ? "rgba(255, 255, 255, 0.06)"
                    : colors.surfaceBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.menuIconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(200, 45, 117, 0.15)"
                      : "rgba(200, 45, 117, 0.10)",
                  },
                ]}
              >
                <Fingerprint size={19} color={colors.primary} />
              </View>
              <View style={styles.menuTexts}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Biometric Unlock</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  Face ID / Touch ID instant login
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: isDark ? "#334155" : "#CBD5E1", true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          ) : null}

          {/* Two-Factor Authentication */}
          <TouchableOpacity
            style={[
              styles.menuItem,
              {
                borderBottomColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : colors.surfaceBorder,
              },
            ]}
            onPress={handleOpen2FA}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.menuIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(16, 185, 129, 0.10)",
                },
              ]}
            >
              <Shield size={19} color={colors.success} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>
                Two-Factor Authentication
              </Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                {user?.twoFactorEnabled ? "Active & Enforced" : "Disabled (Tap to setup)"}
              </Text>
            </View>
            <View
              style={[
                styles.statusChip,
                { backgroundColor: user?.twoFactorEnabled ? "#10B98118" : "#64748B18" },
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
            <ChevronRight size={18} color={colors.textMuted} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          {/* Change Password */}
          <TouchableOpacity
            style={[
              styles.menuItem,
              {
                borderBottomColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : colors.surfaceBorder,
              },
            ]}
            onPress={handleOpenChangePassword}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.menuIconBox,
                { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7" },
              ]}
            >
              <KeyRound size={19} color={colors.gold} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Change Password</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                Update your account login password
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* App Auto-Lock */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => setActiveDialog("AUTO_LOCK")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.menuIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(139, 92, 246, 0.15)"
                    : "rgba(139, 92, 246, 0.10)",
                },
              ]}
            >
              <Clock size={19} color={colors.purple} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>App Auto-Lock</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                Lock session when inactive
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                  {getAutoLockLabel(autoLockTimeout)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Dialog */}
      {activeDialog === "CHANGE_PASSWORD" && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingModal}
          >
            <Pressable style={styles.modalDismissOverlay} onPress={() => setActiveDialog(null)} />
            <View style={styles.modalBackdropCenter}>
              <View
                style={[
                  styles.formDialogCard,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <View style={styles.dialogHeader}>
                  <Text style={[styles.dialogTitle, { color: colors.text }]}>Change Password</Text>
                  <TouchableOpacity
                    onPress={() => setActiveDialog(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {passwordError ? (
                  <View style={styles.errorBanner}>
                    <AlertTriangle size={15} color={colors.error} style={{ marginRight: 6 }} />
                    <Text style={styles.errorBannerText}>{passwordError}</Text>
                  </View>
                ) : null}

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  {passwordStep === "CURRENT" ? (
                    <View style={{ marginTop: 14 }}>
                      <Text style={[styles.modalExplainer, { color: colors.textSecondary }]}>
                        For your security, enter your current password. We will send a 6-digit confirmation code to your email.
                      </Text>

                      <Text style={[styles.inputLabel, { color: colors.text }]}>Current Password</Text>
                      <View
                        style={[
                          styles.passwordInputWrapper,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                            borderColor: colors.surfaceBorder,
                          },
                        ]}
                      >
                        <TextInput
                          style={[styles.passwordInput, { color: colors.text }]}
                          value={currentPassword}
                          onChangeText={setCurrentPassword}
                          placeholder="Enter current password"
                          placeholderTextColor={colors.textMuted}
                          secureTextEntry={!showCurrentPass}
                          selectionColor={colors.primary}
                          autoFocus
                        />
                        <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                          {showCurrentPass ? (
                            <EyeOff size={19} color={colors.textMuted} />
                          ) : (
                            <Eye size={19} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.dialogSaveBtn,
                          { backgroundColor: colors.primary, marginTop: 18 },
                          (!currentPassword || isPasswordLoading) && styles.btnDisabled,
                        ]}
                        onPress={handleSendPasswordOtp}
                        disabled={!currentPassword || isPasswordLoading}
                        activeOpacity={0.88}
                      >
                        {isPasswordLoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.dialogSaveText}>Send Verification Code</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ marginTop: 14 }}>
                      <Text style={[styles.modalExplainer, { color: colors.textSecondary }]}>
                        Enter the 6-digit code sent to your registered email and your new password.
                      </Text>

                      <Text style={[styles.inputLabel, { color: colors.text }]}>
                        6-Digit Verification Code
                      </Text>
                      <TextInput
                        style={[
                          styles.highContrastInput,
                          styles.otpInput,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                            borderColor: colors.surfaceBorder,
                            color: colors.text,
                          },
                        ]}
                        value={passwordOtp}
                        onChangeText={setPasswordOtp}
                        placeholder="123456"
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor={colors.textMuted}
                        selectionColor={colors.primary}
                        autoFocus
                      />

                      <Text style={[styles.inputLabel, { color: colors.text, marginTop: 14 }]}>
                        New Password
                      </Text>
                      <View
                        style={[
                          styles.passwordInputWrapper,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                            borderColor: colors.surfaceBorder,
                          },
                        ]}
                      >
                        <TextInput
                          style={[styles.passwordInput, { color: colors.text }]}
                          value={newPassword}
                          onChangeText={setNewPassword}
                          placeholder="At least 8 characters"
                          placeholderTextColor={colors.textMuted}
                          secureTextEntry={!showNewPass}
                          selectionColor={colors.primary}
                        />
                        <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
                          {showNewPass ? (
                            <EyeOff size={19} color={colors.textMuted} />
                          ) : (
                            <Eye size={19} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.inputLabel, { color: colors.text, marginTop: 14 }]}>
                        Confirm New Password
                      </Text>
                      <View
                        style={[
                          styles.passwordInputWrapper,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                            borderColor: colors.surfaceBorder,
                          },
                        ]}
                      >
                        <TextInput
                          style={[styles.passwordInput, { color: colors.text }]}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          placeholder="Confirm new password"
                          placeholderTextColor={colors.textMuted}
                          secureTextEntry={!showConfirmPass}
                          selectionColor={colors.primary}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                          {showConfirmPass ? (
                            <EyeOff size={19} color={colors.textMuted} />
                          ) : (
                            <Eye size={19} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      </View>

                      {newPassword && confirmPassword && newPassword !== confirmPassword ? (
                        <Text style={{ fontSize: 11.5, color: colors.error, marginTop: 6 }}>
                          Passwords do not match.
                        </Text>
                      ) : null}

                      <TouchableOpacity
                        style={[
                          styles.dialogSaveBtn,
                          { backgroundColor: colors.primary, marginTop: 18 },
                          (!passwordOtp || !newPassword || isPasswordLoading) && styles.btnDisabled,
                        ]}
                        onPress={handleVerifyNewPassword}
                        disabled={!passwordOtp || !newPassword || isPasswordLoading}
                        activeOpacity={0.88}
                      >
                        {isPasswordLoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.dialogSaveText}>Update Password</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Two-Factor Authentication Dialog */}
      {activeDialog === "TWO_FACTOR" && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingModal}
          >
            <Pressable style={styles.modalDismissOverlay} onPress={() => setActiveDialog(null)} />
            <View style={styles.modalBackdropCenter}>
              <View
                style={[
                  styles.formDialogCard,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <View style={styles.dialogHeader}>
                  <Text style={[styles.dialogTitle, { color: colors.text }]}>
                    Two-Factor Authentication
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveDialog(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {twoFactorError ? (
                  <View style={styles.errorBanner}>
                    <AlertTriangle size={15} color={colors.error} style={{ marginRight: 6 }} />
                    <Text style={styles.errorBannerText}>{twoFactorError}</Text>
                  </View>
                ) : null}

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  {user?.twoFactorEnabled ? (
                    <View style={{ alignItems: "center", paddingVertical: 12 }}>
                      <View
                        style={[
                          styles.shieldActiveOrb,
                          { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5" },
                        ]}
                      >
                        <Shield size={36} color={colors.success} />
                      </View>
                      <Text style={[styles.dialogTitle, { color: colors.text, marginTop: 12 }]}>
                        2FA is Currently Active
                      </Text>
                      <Text
                        style={[
                          styles.modalExplainer,
                          { textAlign: "center", color: colors.textSecondary, marginTop: 4 },
                        ]}
                      >
                        Your account requires a two-factor security code during sign-ins. To disable, enter your account password below.
                      </Text>

                      <TextInput
                        style={[
                          styles.highContrastInput,
                          {
                            width: "100%",
                            marginTop: 16,
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                            borderColor: colors.surfaceBorder,
                            color: colors.text,
                          },
                        ]}
                        value={disablePassword}
                        onChangeText={setDisablePassword}
                        placeholder="Enter account password"
                        secureTextEntry
                        placeholderTextColor={colors.textMuted}
                        selectionColor={colors.primary}
                      />

                      <TouchableOpacity
                        style={[
                          styles.destructiveBtn,
                          { backgroundColor: colors.error, width: "100%", marginTop: 16 },
                          (!disablePassword || is2FALoading) && styles.btnDisabled,
                        ]}
                        onPress={handleDisable2FA}
                        disabled={!disablePassword || is2FALoading}
                        activeOpacity={0.88}
                      >
                        {is2FALoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.destructiveBtnText}>Disable Two-Factor Auth</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.modalExplainer, { color: colors.textSecondary }]}>
                        Add an extra layer of security. Choose an authenticator app (Google Authenticator, Microsoft Authenticator) or Email verification.
                      </Text>

                      <View
                        style={[
                          styles.methodTabRow,
                          {
                            backgroundColor: isDark
                              ? "rgba(255, 255, 255, 0.06)"
                              : "#F1F5F9",
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.methodTab,
                            twoFactorMethod === "AUTHENTICATOR" && [
                              styles.methodTabActive,
                              { backgroundColor: isDark ? colors.surfaceElevated : "#FFFFFF" },
                            ],
                          ]}
                          onPress={() => handleInit2FASetup("AUTHENTICATOR")}
                        >
                          <Text
                            style={[
                              styles.methodTabText,
                              { color: colors.textSecondary },
                              twoFactorMethod === "AUTHENTICATOR" && styles.methodTabTextActive,
                            ]}
                          >
                            Authenticator App
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.methodTab,
                            twoFactorMethod === "EMAIL" && [
                              styles.methodTabActive,
                              { backgroundColor: isDark ? colors.surfaceElevated : "#FFFFFF" },
                            ],
                          ]}
                          onPress={() => handleInit2FASetup("EMAIL")}
                        >
                          <Text
                            style={[
                              styles.methodTabText,
                              { color: colors.textSecondary },
                              twoFactorMethod === "EMAIL" && styles.methodTabTextActive,
                            ]}
                          >
                            Email Passkey
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {twoFactorMethod === "AUTHENTICATOR" ? (
                        <View style={{ alignItems: "center", marginTop: 12 }}>
                          {twoFactorQrCode ? (
                            <View
                              style={[
                                styles.qrCodeBox,
                                {
                                  borderColor: colors.surfaceBorder,
                                  backgroundColor: "#FFFFFF",
                                },
                              ]}
                            >
                              <Image
                                source={{ uri: twoFactorQrCode }}
                                style={{ width: 140, height: 140 }}
                              />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.qrCodeBox,
                                {
                                  height: 140,
                                  width: 140,
                                  justifyContent: "center",
                                  borderColor: colors.surfaceBorder,
                                  backgroundColor: "#FFFFFF",
                                },
                              ]}
                            >
                              <ActivityIndicator color={colors.primary} size="small" />
                            </View>
                          )}

                          {twoFactorSecret ? (
                            <TouchableOpacity
                              style={[
                                styles.secretPill,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(200, 45, 117, 0.15)"
                                    : "#FDF2F8",
                                },
                              ]}
                              onPress={handleCopySecret}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.secretText, { color: colors.primary }]}>
                                Key: {twoFactorSecret}
                              </Text>
                              {copiedSecret ? (
                                <Check size={13} color={colors.primary} style={{ marginLeft: 6 }} />
                              ) : (
                                <Copy size={13} color={colors.primary} style={{ marginLeft: 6 }} />
                              )}
                            </TouchableOpacity>
                          ) : null}

                          <Text
                            style={[
                              styles.inputLabel,
                              { color: colors.text, alignSelf: "flex-start", marginTop: 12 },
                            ]}
                          >
                            Enter 6-Digit Authenticator Code
                          </Text>
                          <TextInput
                            style={[
                              styles.highContrastInput,
                              styles.otpInput,
                              {
                                width: "100%",
                                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                                borderColor: colors.surfaceBorder,
                                color: colors.text,
                              },
                            ]}
                            value={twoFactorOtp}
                            onChangeText={setTwoFactorOtp}
                            placeholder="123456"
                            keyboardType="number-pad"
                            maxLength={6}
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.primary}
                          />
                        </View>
                      ) : (
                        <View style={{ marginTop: 12 }}>
                          <Text style={[styles.modalExplainer, { color: colors.textSecondary }]}>
                            A 6-digit verification code has been dispatched to {user?.email}.
                          </Text>
                          <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>
                            Enter 6-Digit Email Code
                          </Text>
                          <TextInput
                            style={[
                              styles.highContrastInput,
                              styles.otpInput,
                              {
                                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                                borderColor: colors.surfaceBorder,
                                color: colors.text,
                              },
                            ]}
                            value={twoFactorOtp}
                            onChangeText={setTwoFactorOtp}
                            placeholder="123456"
                            keyboardType="number-pad"
                            maxLength={6}
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.primary}
                          />
                        </View>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.dialogSaveBtn,
                          { backgroundColor: colors.primary, marginTop: 18 },
                          (!twoFactorOtp || is2FALoading) && styles.btnDisabled,
                        ]}
                        onPress={handleConfirm2FASetup}
                        disabled={!twoFactorOtp || is2FALoading}
                        activeOpacity={0.88}
                      >
                        {is2FALoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.dialogSaveText}>Verify & Enable 2FA</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Auto-Lock Picker Dialog */}
      {activeDialog === "AUTO_LOCK" && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <Pressable style={styles.modalDismissOverlay} onPress={() => setActiveDialog(null)} />
          <View style={styles.modalBackdropCenter}>
            <View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.surfaceBorder,
                },
              ]}
            >
              <View style={styles.dialogHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dialogTitle, { color: colors.text }]}>
                    App Auto-Lock Timeout
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    Select inactivity duration before locking
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setActiveDialog(null)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 12, gap: 8 }}>
                {[
                  { id: "immediately", label: "Immediately upon leaving" },
                  { id: "1m", label: "1 Minute of inactivity" },
                  { id: "5m", label: "5 Minutes of inactivity" },
                  { id: "15m", label: "15 Minutes of inactivity" },
                  { id: "30m", label: "30 Minutes of inactivity" },
                  { id: "never", label: "Never (Require manual sign out)" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.autoLockOptionRow,
                      {
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
                        borderColor:
                          autoLockTimeout === option.id ? colors.primary : colors.surfaceBorder,
                      },
                      autoLockTimeout === option.id && styles.autoLockOptionRowActive,
                    ]}
                    onPress={() => {
                      setAutoLockSetting(option.id as any);
                      setActiveDialog(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.autoLockOptionLabel,
                        { color: colors.text },
                        autoLockTimeout === option.id && {
                          color: colors.primary,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {autoLockTimeout === option.id && (
                      <View
                        style={[styles.optionRadioActive, { backgroundColor: colors.primary }]}
                      >
                        <Check size={13} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* In-Page Custom Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  backBtnPlaceholder: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuTexts: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  menuSub: {
    fontSize: 12,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalBackdropCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  formDialogCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalExplainer: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  highContrastInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  otpInput: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
  },
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  dialogSaveBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogSaveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  errorBannerText: {
    fontSize: 12,
    color: "#EF4444",
    flex: 1,
  },
  shieldActiveOrb: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  destructiveBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  destructiveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  methodTabRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    marginVertical: 12,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  methodTabActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  methodTabTextActive: {
    fontWeight: "700",
  },
  qrCodeBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  secretPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  secretText: {
    fontSize: 12,
    fontWeight: "600",
  },
  autoLockOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  autoLockOptionRowActive: {
    borderWidth: 1.5,
  },
  autoLockOptionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  optionRadioActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
