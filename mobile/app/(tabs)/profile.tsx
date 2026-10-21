import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Platform,
  Clipboard,
  Pressable,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  User,
  Fingerprint,
  Shield,
  FileText,
  Lock,
  LogOut,
  Trash2,
  ChevronRight,
  Info,
  Sparkles,
  Camera,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Headphones,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  KeyRound,
  ShieldCheck,
  Scale,
  Phone,
  Settings,
  Sun,
  Moon,
  UserCheck,
  ArrowLeft,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";
import { colors as defaultColors } from "../../constants/theme";
const colors = defaultColors;
import { useQuery } from "@tanstack/react-query";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { uploadFileToServer } from "../../lib/upload";
import { TERMS_OF_SERVICE_DOC, PRIVACY_POLICY_DOC } from "../../constants/legalDocuments";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const {
    user,
    logout,
    biometricAvailable,
    biometricEnabled,
    toggleBiometrics,
    autoLockTimeout,
    setAutoLockSetting,
    refreshProfile,
    hideBalance,
    setHideBalancePreference,
  } = useAuth();

  // State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(user?.emailLoginAlerts ?? true);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Active Modals & Sub-screens
  const [activeModal, setActiveModal] = useState<
    | "SETTINGS"
    | "SECURITY"
    | "IDENTITY"
    | "LEGAL"
    | "PHOTO_OPTIONS"
    | "CHANGE_PASSWORD"
    | "TWO_FACTOR"
    | "AUTO_LOCK"
    | "PHONE_CHANGE"
    | "DOCUMENT_VIEWER"
    | null
  >(null);

  // Document Viewer State
  const [documentType, setDocumentType] = useState<"TERMS" | "PRIVACY">("TERMS");

  // Phone Change State (30-day cooldown & 2-step OTP)
  const [phoneStep, setPhoneStep] = useState<"ENTER_PHONE" | "VERIFY_OTP">("ENTER_PHONE");
  const [newPhone, setNewPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

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
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    isDestructive?: boolean;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  // Sync state with user profile updates
  useEffect(() => {
    if (user) {
      setEmailAlerts(user.emailLoginAlerts ?? true);
    }
  }, [user]);

  // Check 30-Day Phone Cooldown
  const isPhoneLocked = () => {
    if (!user?.phoneChangedAt) return false;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return new Date(user.phoneChangedAt) > thirtyDaysAgo;
  };

  const getPhoneDaysRemaining = () => {
    if (!user?.phoneChangedAt) return 0;
    const changeDate = new Date(user.phoneChangedAt).getTime();
    const unlockDate = changeDate + 30 * 24 * 60 * 60 * 1000;
    const msRemaining = unlockDate - Date.now();
    return Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  };

  // Loyalty Tier Query
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

  // Handle Photo Pick
  async function handlePickImage(source: "camera" | "library") {
    setActiveModal(null);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setAlertConfig({
            visible: true,
            type: "warning",
            title: "Camera Permission Required",
            message: "Please allow camera access to take a profile photo.",
            confirmText: "OK",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.82,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setAlertConfig({
            visible: true,
            type: "warning",
            title: "Photo Access Required",
            message: "Please allow photo library access to choose a profile photo.",
            confirmText: "OK",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.82,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingPhoto(true);
        const localUri = result.assets[0].uri;
        const uploadedUrl = await uploadFileToServer({ uri: localUri, mimeType: "image/jpeg" });
        await api.patch("/api/user/profile", { imageUrl: uploadedUrl });
        await refreshProfile();
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Profile Photo Updated",
          message: "Your new profile picture has been updated across your account.",
          confirmText: "Awesome",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Photo Upload Failed",
        message: err?.message || "Could not upload image. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  // Handle Remove Photo
  async function handleRemovePhoto() {
    setActiveModal(null);
    setIsUploadingPhoto(true);
    try {
      await api.patch("/api/user/profile", { imageUrl: null });
      await refreshProfile();
      setAlertConfig({
        visible: true,
        type: "success",
        title: "Photo Removed",
        message: "Your profile picture has been reset to default.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } catch {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Action Failed",
        message: "Could not remove photo. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  }

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

  // Handle Toggle Hide Balances
  async function handleToggleHideBalances(val: boolean) {
    await setHideBalancePreference(val);
  }

  // Handle Toggle Email Login Alerts
  async function handleToggleEmailAlerts(val: boolean) {
    setEmailAlerts(val);
    try {
      const res = await api.put("/api/user/profile", { emailLoginAlerts: val });
      if (res?.success) {
        await refreshProfile();
      } else {
        setEmailAlerts(!val);
      }
    } catch {
      setEmailAlerts(!val);
    }
  }

  // Handle Legal Name Tap (Uneditable Notice)
  function handleLegalNamePress() {
    setAlertConfig({
      visible: true,
      type: "info",
      title: "Name Uneditable",
      message: "Verified legal names cannot be modified directly. Please reach out to customer support if you need to request a name update.",
      confirmText: "Understood",
      onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
    });
  }

  // Handle Email Tap (Verified Identity Notice)
  function handleEmailPress() {
    setAlertConfig({
      visible: true,
      type: "info",
      title: "Registered Email",
      message: "Your email address is verified and securely tied to your Lorabiz account.",
      confirmText: "Understood",
      onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
    });
  }

  // =========================================================================
  // Phone Change Logic (30-day security lock)
  // =========================================================================
  function handleOpenPhoneChange() {
    if (isPhoneLocked()) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Security Lock",
        message: `You updated your phone number recently. You can update it again in ${getPhoneDaysRemaining()} day(s).`,
        confirmText: "Understood",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }
    setIsEditingPhone(true);
    setPhoneStep("ENTER_PHONE");
    setNewPhone("");
    setPhoneOtp("");
    setPhoneError(null);
  }

  function handleCancelPhoneEdit() {
    setIsEditingPhone(false);
    setPhoneStep("ENTER_PHONE");
    setNewPhone("");
    setPhoneOtp("");
    setPhoneError(null);
  }

  async function handleSendPhoneOtp() {
    setPhoneError(null);
    const cleaned = newPhone.trim();
    if (!cleaned || cleaned.length < 10) {
      setPhoneError("Please enter a valid phone number (at least 10 digits).");
      return;
    }

    setIsPhoneLoading(true);
    try {
      const res = await api.post("/api/user/security/phone", {
        action: "SEND_OTP",
        newPhone: cleaned,
      });

      if (res?.success) {
        setPhoneStep("VERIFY_OTP");
      } else {
        setPhoneError(res?.message || "Could not send verification code.");
      }
    } catch (err: any) {
      setPhoneError(err?.message || "Network error. Please try again.");
    } finally {
      setIsPhoneLoading(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    setPhoneError(null);
    if (!phoneOtp || phoneOtp.trim().length < 6) {
      setPhoneError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setIsPhoneLoading(true);
    try {
      const res = await api.post("/api/user/security/phone", {
        action: "VERIFY_OTP",
        newPhone: newPhone.trim(),
        otpCode: phoneOtp.trim(),
      });

      if (res?.success) {
        await refreshProfile();
        setIsEditingPhone(false);
        setPhoneStep("ENTER_PHONE");
        setNewPhone("");
        setPhoneOtp("");
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Phone Number Updated",
          message: "Your phone number has been securely verified and updated.",
          confirmText: "Done",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      } else {
        setPhoneError(res?.message || "Invalid or expired code.");
      }
    } catch (err: any) {
      setPhoneError(err?.message || "Failed to verify phone number.");
    } finally {
      setIsPhoneLoading(false);
    }
  }

  // =========================================================================
  // Change Password Handlers
  // =========================================================================
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
        setActiveModal(null);
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
  // 2FA Setup & Disable Handlers
  // =========================================================================
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
        setActiveModal(null);
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
        setActiveModal(null);
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

  function handleCopyReferral() {
    if (user?.referralCode) {
      try {
        if (Clipboard && typeof (Clipboard as any).setString === "function") {
          Clipboard.setString(user.referralCode);
        }
      } catch {}
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
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
        "Are you sure you want to deactivate your Lorabiz account? Your active session will be signed out and your profile closed. In compliance with financial regulations and anti-money laundering laws, past transaction records are securely retained.",
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

  const getAutoLockLabel = (timeout: string) => {
    switch (timeout) {
      case "immediately":
        return "Immediately";
      case "1m":
        return "1 Minute";
      case "5m":
        return "5 Minutes";
      case "15m":
        return "15 Minutes";
      case "1h":
        return "1 Hour";
      case "2h":
        return "2 Hours";
      default:
        return "Never";
    }
  };

  const userFirstName = user?.firstName || user?.name?.split(" ")[0] || "User";
  const userLastName = user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 48,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header Bar */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <TouchableOpacity
          style={[
            styles.headerSettingsBtn,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" },
          ]}
          onPress={() => setActiveModal("SETTINGS")}
          activeOpacity={0.7}
        >
          <Settings size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* User Info Hero Card */}
      <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.avatarWrapper}>
          <TouchableOpacity
            style={styles.avatarTouchTarget}
            onPress={() => setActiveModal("PHOTO_OPTIONS")}
            activeOpacity={0.85}
          >
            {user?.image ? (
              <Image source={{ uri: user.image }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {(userFirstName[0] || "U").toUpperCase()}
                </Text>
              </View>
            )}

            {isUploadingPhoto ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            ) : (
              <View style={styles.cameraIconBadge}>
                <Camera size={13} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.avatarTierBadge, { backgroundColor: tierColor }]}>
            <Sparkles size={11} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.userInfoCol}>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
            {user?.name || `${userFirstName} ${userLastName}`.trim()}
          </Text>

          <View style={[styles.tierPill, { backgroundColor: tierColor + "18", borderColor: tierColor + "35" }]}>
            <Sparkles size={11} color={tierColor} style={{ marginRight: 4 }} />
            <Text style={[styles.tierPillText, { color: tierColor }]}>{tierName} Tier Member</Text>
          </View>

          <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>{user?.email}</Text>
          {user?.phone ? <Text style={[styles.userPhone, { color: colors.textMuted }]}>{user.phone}</Text> : null}

          {user?.referralCode ? (
            <TouchableOpacity
              style={[styles.refBadge, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "#FDF2F8", borderColor: isDark ? "rgba(200, 45, 117, 0.3)" : "rgba(200, 45, 117, 0.2)" }]}
              onPress={handleCopyReferral}
              activeOpacity={0.7}
            >
              <Text style={styles.refText}>Referral: {user.referralCode}</Text>
              {copiedReferral ? (
                <Check size={12} color={colors.primary} style={{ marginLeft: 5 }} />
              ) : (
                <Copy size={12} color={colors.primary} style={{ marginLeft: 5 }} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Main Navigation Hub */}
      <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, marginTop: 12 }]}>
        {/* 1. Personal Details (Top) */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
          onPress={() => setActiveModal("IDENTITY")}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.10)" }]}>
            <UserCheck size={20} color="#3B82F6" />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Personal Details</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
              Verified legal name & mobile phone
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 2. Settings & Preferences */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
          onPress={() => setActiveModal("SETTINGS")}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "rgba(200, 45, 117, 0.10)" }]}>
            <Settings size={20} color={colors.primary} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Settings & Preferences</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
              Theme ({themeMode === "system" ? "System" : themeMode === "dark" ? "Dark" : "Light"}), auto-lock, privacy
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 3. Security (Clean 'Security' title) */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
          onPress={() => setActiveModal("SECURITY")}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.10)" }]}>
            <Shield size={20} color={colors.success} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Security</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
              Biometrics, password, 2FA ({user?.twoFactorEnabled ? "Active" : "Off"})
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 4. Customer Support */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
          onPress={() => Linking.openURL("https://wa.me/12299494839?text=Hello%20Lorabiz%20Support")}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "rgba(200, 45, 117, 0.10)" }]}>
            <Headphones size={20} color={colors.primary} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Customer Support</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
              Live WhatsApp chat & assistance
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 5. Legal & Compliance */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={() => setActiveModal("LEGAL")}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.10)" }]}>
            <Scale size={20} color={colors.purple} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Legal & Compliance</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
              Terms of service, privacy & regulatory notice
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Account Actions */}
      <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, marginTop: 14 }]}>
        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }]}>
            <LogOut size={19} color={colors.error} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>Sign Out</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>End current mobile session</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Deactivate Account */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={handleCloseAccount}
          disabled={isDeactivating}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" }]}>
            {isDeactivating ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Trash2 size={19} color={colors.error} />
            )}
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>Deactivate Account</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Close profile & sign out</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* App Version Stamp */}
      <View style={styles.versionContainer}>
        <Text style={[styles.versionText, { color: colors.textMuted }]}>Lorabiz Mobile • v1.0</Text>
      </View>

      {/* ==================================================== */}
      {/* SUB-SCREEN 1: SETTINGS & PREFERENCES MODAL          */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "SETTINGS"}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.subScreenContainer, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
          <View style={[styles.subScreenHeader, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }]}>
            <TouchableOpacity
              onPress={() => setActiveModal(null)}
              style={[styles.subScreenBackBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.subScreenTitle, { color: colors.text }]}>Settings & Preferences</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* THEME SELECTOR CARD */}
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Theme & Appearance</Text>
            <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.themeCardSub, { color: colors.textMuted }]}>
                Choose an appearance theme or follow your system preferences.
              </Text>
              <View style={styles.themeOptionsGrid}>
                {/* System Mode */}
                <TouchableOpacity
                  style={[
                    styles.themeOptionBtn,
                    {
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
                      borderColor: themeMode === "system" ? colors.primary : colors.surfaceBorder,
                    },
                    themeMode === "system" && styles.themeOptionBtnActive,
                  ]}
                  onPress={() => setThemeMode("system")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.themeIconCircle, themeMode === "system" && { backgroundColor: "rgba(200, 45, 117, 0.15)" }]}>
                    <Smartphone size={22} color={themeMode === "system" ? colors.primary : colors.textMuted} />
                  </View>
                  <Text style={[styles.themeOptionTitle, { color: colors.text }]}>System</Text>
                  <Text style={[styles.themeOptionDesc, { color: colors.textMuted }]}>Follows device</Text>
                  {themeMode === "system" && (
                    <View style={[styles.themeCheckBadge, { backgroundColor: colors.primary }]}>
                      <Check size={11} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Light Mode (Default) */}
                <TouchableOpacity
                  style={[
                    styles.themeOptionBtn,
                    {
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
                      borderColor: themeMode === "light" ? colors.primary : colors.surfaceBorder,
                    },
                    themeMode === "light" && styles.themeOptionBtnActive,
                  ]}
                  onPress={() => setThemeMode("light")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.themeIconCircle, themeMode === "light" && { backgroundColor: "rgba(200, 45, 117, 0.15)" }]}>
                    <Sun size={22} color={themeMode === "light" ? colors.primary : colors.textMuted} />
                  </View>
                  <Text style={[styles.themeOptionTitle, { color: colors.text }]}>Light</Text>
                  <Text style={[styles.themeOptionDesc, { color: colors.textMuted }]}>Clean white</Text>
                  {themeMode === "light" && (
                    <View style={[styles.themeCheckBadge, { backgroundColor: colors.primary }]}>
                      <Check size={11} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Dark Mode */}
                <TouchableOpacity
                  style={[
                    styles.themeOptionBtn,
                    {
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
                      borderColor: themeMode === "dark" ? colors.primary : colors.surfaceBorder,
                    },
                    themeMode === "dark" && styles.themeOptionBtnActive,
                  ]}
                  onPress={() => setThemeMode("dark")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.themeIconCircle, themeMode === "dark" && { backgroundColor: "rgba(200, 45, 117, 0.15)" }]}>
                    <Moon size={22} color={themeMode === "dark" ? colors.primary : colors.textMuted} />
                  </View>
                  <Text style={[styles.themeOptionTitle, { color: colors.text }]}>Dark</Text>
                  <Text style={[styles.themeOptionDesc, { color: colors.textMuted }]}>Deep slate</Text>
                  {themeMode === "dark" && (
                    <View style={[styles.themeCheckBadge, { backgroundColor: colors.primary }]}>
                      <Check size={11} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* APP AUTO-LOCK MENU ROW */}
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary, marginTop: 22 }]}>Session Security</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setActiveModal("AUTO_LOCK")}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.10)" }]}>
                  <Clock size={19} color={colors.purple} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>App Auto-Lock</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Lock session when inactive or minimized</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                      {autoLockTimeout === "immediately"
                        ? "Immediate"
                        : autoLockTimeout === "1m"
                        ? "1 Min"
                        : autoLockTimeout === "5m"
                        ? "5 Mins"
                        : autoLockTimeout === "15m"
                        ? "15 Mins"
                        : autoLockTimeout === "1h"
                        ? "1 Hour"
                        : autoLockTimeout === "2h"
                        ? "2 Hours"
                        : "Disabled"}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            {/* DISPLAY & PRIVACY */}
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary, marginTop: 22 }]}>Display & Privacy</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              {/* Hide Balance Toggle */}
              <View style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}>
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(100, 116, 139, 0.15)" : "#F1F5F9" }]}>
                  <EyeOff size={19} color={colors.textSecondary} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Hide Balances by Default</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Mask balances across dashboard tabs</Text>
                </View>
                <Switch
                  value={hideBalance}
                  onValueChange={handleToggleHideBalances}
                  trackColor={{ false: isDark ? "#334155" : "#CBD5E1", true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Email Alerts */}
              <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE" }]}>
                  <Mail size={19} color={colors.info} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Email Login Alerts</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Notify on new sign-ins</Text>
                </View>
                <Switch
                  value={emailAlerts}
                  onValueChange={handleToggleEmailAlerts}
                  trackColor={{ false: isDark ? "#334155" : "#CBD5E1", true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* SUB-SCREEN 2: SECURITY & AUTHENTICATION MODAL       */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "SECURITY"}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.subScreenContainer, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
          <View style={[styles.subScreenHeader, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }]}>
            <TouchableOpacity
              onPress={() => setActiveModal(null)}
              style={[styles.subScreenBackBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.subScreenTitle, { color: colors.text }]}>Security</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Access Control</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              {/* Biometrics Toggle */}
              {biometricAvailable ? (
                <View style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}>
                  <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "rgba(200, 45, 117, 0.10)" }]}>
                    <Fingerprint size={19} color={colors.primary} />
                  </View>
                  <View style={styles.menuTexts}>
                    <Text style={[styles.menuTitle, { color: colors.text }]}>Biometric Unlock</Text>
                    <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Face ID / Touch ID instant login</Text>
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
                style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
                onPress={() => {
                  if (!user?.twoFactorEnabled) {
                    handleInit2FASetup("AUTHENTICATOR");
                  }
                  setActiveModal("TWO_FACTOR");
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.10)" }]}>
                  <Shield size={19} color={colors.success} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Two-Factor Authentication</Text>
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
                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setPasswordStep("CURRENT");
                  setPasswordError(null);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordOtp("");
                  setActiveModal("CHANGE_PASSWORD");
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7" }]}>
                  <KeyRound size={19} color={colors.gold} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Change Password</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Update your account login password</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* SUB-SCREEN 3: IDENTITY & CONTACT MODAL             */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "IDENTITY"}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.subScreenContainer, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
          <View style={[styles.subScreenHeader, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }]}>
            <TouchableOpacity
              onPress={() => setActiveModal(null)}
              style={[styles.subScreenBackBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.subScreenTitle, { color: colors.text }]}>Personal Details</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Registered Name Card */}
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Registered Name</Text>
            <View style={[styles.legalCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <View style={styles.legalCardHeader}>
                <View style={styles.legalTitleRow}>
                  <User size={18} color={colors.primary} />
                  <Text style={[styles.legalCardTitle, { color: colors.text }]}>Registered Name</Text>
                </View>
              </View>

              <View style={styles.legalFieldsRow}>
                <View style={styles.legalFieldCol}>
                  <Text style={[styles.legalFieldLabel, { color: colors.textMuted }]}>First Name</Text>
                  <TouchableOpacity
                    style={[styles.legalFieldBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9", borderColor: colors.surfaceBorder }]}
                    onPress={handleLegalNamePress}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.legalFieldValue, { color: colors.text }]} numberOfLines={1}>
                      {userFirstName}
                    </Text>
                    <Lock size={12} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.legalFieldCol}>
                  <Text style={[styles.legalFieldLabel, { color: colors.textMuted }]}>Last Name</Text>
                  <TouchableOpacity
                    style={[styles.legalFieldBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9", borderColor: colors.surfaceBorder }]}
                    onPress={handleLegalNamePress}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.legalFieldValue, { color: colors.text }]} numberOfLines={1}>
                      {userLastName || "—"}
                    </Text>
                    <Lock size={12} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.legalEmailRow}>
                <Text style={[styles.legalFieldLabel, { color: colors.textMuted }]}>Registered Email</Text>
                <TouchableOpacity
                  style={[styles.legalEmailBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9", borderColor: colors.surfaceBorder }]}
                  onPress={handleEmailPress}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                    <Mail size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                    <Text style={[styles.legalEmailText, { color: colors.text }]} numberOfLines={1}>
                      {user?.email}
                    </Text>
                  </View>
                  <Lock size={12} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 17 }}>
                Registered names cannot be modified directly. Please reach out to customer support if you need a name update.
              </Text>
            </View>

            {/* Registered Phone Card with In-Place Phone Editing */}
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary, marginTop: 22 }]}>Registered Phone</Text>
            <View style={[styles.phoneCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <View style={styles.phoneCardTop}>
                <View style={[styles.phoneIconBox, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "rgba(200, 45, 117, 0.10)" }]}>
                  <Smartphone size={20} color={colors.primary} />
                </View>
                <View style={styles.phoneTexts}>
                  <Text style={[styles.phoneCardLabel, { color: colors.textMuted }]}>Registered Mobile Number</Text>
                  <Text style={[styles.phoneCardNumber, { color: colors.text }]}>{user?.phone || "No phone linked"}</Text>
                </View>
              </View>

              {!isEditingPhone ? (
                <>
                  {isPhoneLocked() ? (
                    <View style={styles.phoneLockNotice}>
                      <AlertTriangle size={15} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                      <Text style={styles.phoneLockNoticeText}>
                        Security Lock: You updated your number recently. Wait 30 days before changing again. (Unlocks in {getPhoneDaysRemaining()} days)
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.changePhoneBtn, { borderColor: colors.primary }]}
                      onPress={handleOpenPhoneChange}
                      activeOpacity={0.8}
                    >
                      <Phone size={15} color={colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.changePhoneBtnText}>Change Phone Number</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }}>
                  {phoneError ? (
                    <View style={[styles.errorBanner, { marginBottom: 12 }]}>
                      <AlertCircle size={16} color={colors.error} style={{ marginRight: 8 }} />
                      <Text style={styles.errorBannerText}>{phoneError}</Text>
                    </View>
                  ) : null}

                  {phoneStep === "ENTER_PHONE" ? (
                    <View>
                      <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
                        Enter your new mobile phone number. We will send a 6-digit confirmation code to your registered email ({user?.email}) to verify ownership.
                      </Text>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>New Phone Number</Text>
                      <TextInput
                        style={[
                          styles.dialogInput,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                            borderColor: colors.surfaceBorder,
                            color: colors.text,
                          },
                        ]}
                        placeholder="e.g. 08012345678"
                        placeholderTextColor={colors.textMuted}
                        value={newPhone}
                        onChangeText={setNewPhone}
                        keyboardType="phone-pad"
                        autoFocus
                      />
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 14 }}>
                        Note: You can only update your phone number once every 30 days for account security.
                      </Text>

                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity
                          style={[
                            styles.dialogCancelBtn,
                            { flex: 1, backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9" },
                          ]}
                          onPress={handleCancelPhoneEdit}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.dialogCancelText, { color: colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.dialogSaveBtn,
                            { flex: 1.4 },
                            (!newPhone || isPhoneLoading) && styles.btnDisabled,
                          ]}
                          onPress={handleSendPhoneOtp}
                          disabled={!newPhone || isPhoneLoading}
                          activeOpacity={0.85}
                        >
                          {isPhoneLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.dialogSaveText}>Send Code</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View>
                      <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
                        Enter the 6-digit verification code sent to your registered email ({user?.email}) to confirm your new phone number ({newPhone}).
                      </Text>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>6-Digit Verification Code</Text>
                      <TextInput
                        style={[
                          styles.dialogInput,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                            borderColor: colors.surfaceBorder,
                            color: colors.text,
                            letterSpacing: 4,
                            textAlign: "center",
                            fontSize: 18,
                            fontWeight: "700",
                          },
                        ]}
                        placeholder="••••••"
                        placeholderTextColor={colors.textMuted}
                        value={phoneOtp}
                        onChangeText={setPhoneOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />

                      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                        <TouchableOpacity
                          style={[
                            styles.dialogCancelBtn,
                            { flex: 1, backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9" },
                          ]}
                          onPress={handleCancelPhoneEdit}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.dialogCancelText, { color: colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.dialogSaveBtn,
                            { flex: 1.4 },
                            (!phoneOtp || isPhoneLoading) && styles.btnDisabled,
                          ]}
                          onPress={handleVerifyPhoneOtp}
                          disabled={!phoneOtp || isPhoneLoading}
                          activeOpacity={0.85}
                        >
                          {isPhoneLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.dialogSaveText}>Verify & Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={{ alignSelf: "center", marginTop: 12, paddingVertical: 6 }}
                        onPress={() => setPhoneStep("ENTER_PHONE")}
                      >
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Change Number</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* SUB-SCREEN 4: LEGAL & COMPLIANCE MODAL               */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "LEGAL"}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.subScreenContainer, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
          <View style={[styles.subScreenHeader, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }]}>
            <TouchableOpacity
              onPress={() => setActiveModal(null)}
              style={[styles.subScreenBackBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.subScreenTitle, { color: colors.text }]}>Legal & Compliance</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>Terms & Disclaimers</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              {/* Regulatory Disclaimer */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
                onPress={() =>
                  setAlertConfig({
                    visible: true,
                    type: "info",
                    title: "Regulatory Notice",
                    message:
                      "Lorabiz is an independent corporate facilitation and business management platform. We are an accredited corporate services facilitator and strictly not an agency of the Corporate Affairs Commission (CAC) or any government department.",
                    confirmText: "Understood",
                    onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
                  })
                }
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7" }]}>
                  <Info size={19} color={colors.gold} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Regulatory Disclaimer</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Corporate facilitation standing</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {/* In-App Terms of Service */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder }]}
                onPress={() => {
                  setDocumentType("TERMS");
                  setActiveModal("DOCUMENT_VIEWER");
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(6, 182, 212, 0.15)" : "#E0F2FE" }]}>
                  <FileText size={19} color={colors.cyan} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Terms & Conditions</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>User service agreements</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {/* In-App Privacy Policy */}
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setDocumentType("PRIVACY");
                  setActiveModal("DOCUMENT_VIEWER");
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconBox, { backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.10)" }]}>
                  <Lock size={19} color={colors.purple} />
                </View>
                <View style={styles.menuTexts}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>Privacy Policy</Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Data protection & privacy rights</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>


      {/* ==================================================== */}
      {/* MODAL 1: Photo Options Bottom Sheet */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "PHOTO_OPTIONS"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissOverlay} onPress={() => setActiveModal(null)} />
          <View style={[styles.bottomSheetCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "#E2E8F0" }]} />
            <Text style={[styles.sheetModalTitle, { color: colors.text }]}>Profile Photo</Text>
            <Text style={[styles.sheetModalSub, { color: colors.textSecondary }]}>Choose how you want to update your profile photo</Text>

            <TouchableOpacity
              style={[styles.sheetActionBtn, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
              onPress={() => handlePickImage("camera")}
              activeOpacity={0.7}
            >
              <Camera size={20} color={colors.primary} />
              <Text style={[styles.sheetActionText, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetActionBtn, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
              onPress={() => handlePickImage("library")}
              activeOpacity={0.7}
            >
              <Smartphone size={20} color={colors.primary} />
              <Text style={[styles.sheetActionText, { color: colors.text }]}>Choose from Library</Text>
            </TouchableOpacity>

            {user?.image ? (
              <TouchableOpacity
                style={[styles.sheetActionBtn, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.10)" : "#FEF2F2", borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "#FEE2E2" }]}
                onPress={handleRemovePhoto}
                activeOpacity={0.7}
              >
                <Trash2 size={20} color={colors.error} />
                <Text style={[styles.sheetActionText, { color: colors.error }]}>Remove Photo</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setActiveModal(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: App Auto-Lock Timeout Picker                  */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "AUTO_LOCK"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.formDialogCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder }]}>
            <View style={styles.dialogHeader}>
              <View>
                <Text style={[styles.dialogTitle, { color: colors.text }]}>App Auto-Lock</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Lock session when inactive or minimized
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 8, gap: 6 }}>
              {[
                { id: "immediately", label: "Immediately upon leaving" },
                { id: "1m", label: "1 Minute of inactivity" },
                { id: "5m", label: "5 Minutes of inactivity" },
                { id: "15m", label: "15 Minutes of inactivity" },
                { id: "1h", label: "1 Hour of inactivity" },
                { id: "2h", label: "2 Hours of inactivity" },
                { id: "never", label: "Never (Disabled)" },
              ].map((item) => {
                const isSelected = autoLockTimeout === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.inlineTimeoutRow,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? "rgba(200, 45, 117, 0.18)" : "rgba(200, 45, 117, 0.08)")
                          : (isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"),
                        borderColor: isSelected ? colors.primary : (isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder),
                        paddingVertical: 13,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      },
                    ]}
                    onPress={async () => {
                      await setAutoLockSetting(item.id);
                      setActiveModal(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: isSelected ? colors.primary : colors.text,
                        fontWeight: isSelected ? "700" : "500",
                      }}
                    >
                      {item.label}
                    </Text>
                    {isSelected ? <Check size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 3: Change Password Modal (With Keyboard Avoidance) */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "CHANGE_PASSWORD"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal("SECURITY")}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingModal}
        >
          <View style={styles.modalBackdropCenter}>
            <View style={[styles.formDialogCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder }]}>
              <View style={styles.dialogHeader}>
                <Text style={[styles.dialogTitle, { color: colors.text }]}>Change Password</Text>
                <TouchableOpacity onPress={() => setActiveModal("SECURITY")} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
                  <View>
                    <Text style={[styles.modalExplainer, { color: colors.textSecondary }]}>
                      For your security, enter your current password. We will send a 6-digit confirmation code to your email.
                    </Text>

                    <Text style={[styles.inputLabel, { color: colors.text }]}>Current Password</Text>
                    <View style={[styles.passwordInputWrapper, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC", borderColor: colors.surfaceBorder }]}>
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
                        {showCurrentPass ? <EyeOff size={19} color={colors.textMuted} /> : <Eye size={19} color={colors.textMuted} />}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.dialogSaveBtn, (!currentPassword || isPasswordLoading) && styles.btnDisabled]}
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
                  <View>
                    <Text style={[styles.modalExplainer, { color: colors.textSecondary }]}>
                      Enter the 6-digit code sent to {user?.email} and your new password.
                    </Text>

                    <Text style={[styles.inputLabel, { color: colors.text }]}>6-Digit Verification Code</Text>
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
                    />

                    <Text style={[styles.inputLabel, { color: colors.text }]}>New Password</Text>
                    <View style={[styles.passwordInputWrapper, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC", borderColor: colors.surfaceBorder }]}>
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
                        {showNewPass ? <EyeOff size={19} color={colors.textMuted} /> : <Eye size={19} color={colors.textMuted} />}
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.inputLabel, { color: colors.text }]}>Confirm New Password</Text>
                    <View style={[styles.passwordInputWrapper, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC", borderColor: colors.surfaceBorder }]}>
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
                        {showConfirmPass ? <EyeOff size={19} color={colors.textMuted} /> : <Eye size={19} color={colors.textMuted} />}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.dialogSaveBtn, (!passwordOtp || !newPassword || isPasswordLoading) && styles.btnDisabled]}
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
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 4: Two-Factor Authentication Modal (With Keyboard Avoidance) */}
      {/* ==================================================== */}
      {/* ==================================================== */}
      {/* MODAL 4: Two-Factor Authentication Modal (With Keyboard Avoidance) */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "TWO_FACTOR"}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setActiveModal("SECURITY");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingModal}
        >
          <View style={styles.modalBackdropCenter}>
            <View style={[styles.formDialogCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder }]}>
              <View style={styles.dialogHeader}>
                <Text style={[styles.dialogTitle, { color: colors.text }]}>Two-Factor Authentication</Text>
                <TouchableOpacity
                  onPress={() => {
                    setActiveModal("SECURITY");
                  }}
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
                    <View style={styles.shieldActiveOrb}>
                      <Shield size={36} color={colors.success} />
                    </View>
                    <Text style={[styles.twoFactorActiveTitle, { color: colors.text }]}>2FA is Active & Protecting Your Account</Text>
                    <Text style={[styles.twoFactorActiveSub, { color: colors.textSecondary }]}>
                      Every sign-in requires a verification code from your authenticator app or email.
                    </Text>

                    <View style={[styles.dividerSpacing, { backgroundColor: colors.surfaceBorder }]} />

                    <Text style={[styles.inputLabel, { color: colors.text }]}>Enter Account Password to Disable 2FA</Text>
                    <TextInput
                      style={[
                        styles.highContrastInput,
                        {
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
                      style={[styles.destructiveBtn, (!disablePassword || is2FALoading) && styles.btnDisabled]}
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
                  <View>
                    <Text style={[styles.modalExplainer, { color: colors.textSecondary }]}>
                      Add an extra layer of security. Choose an authenticator app (Google Authenticator, Microsoft Authenticator) or Email OTP.
                    </Text>

                    <View style={[styles.methodTabRow, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9" }]}>
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
                      <View style={{ alignItems: "center" }}>
                        {twoFactorQrCode ? (
                          <View style={[styles.qrCodeBox, { borderColor: colors.surfaceBorder, backgroundColor: "#FFFFFF" }]}>
                            <Image source={{ uri: twoFactorQrCode }} style={{ width: 150, height: 150 }} />
                          </View>
                        ) : (
                          <View style={[styles.qrCodeBox, { height: 150, width: 150, justifyContent: "center", borderColor: colors.surfaceBorder, backgroundColor: "#FFFFFF" }]}>
                            <ActivityIndicator color={colors.primary} size="small" />
                          </View>
                        )}

                        {twoFactorSecret ? (
                          <TouchableOpacity
                            style={styles.secretPill}
                            onPress={handleCopySecret}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.secretText}>Secret: {twoFactorSecret}</Text>
                            {copiedSecret ? (
                              <Check size={13} color={colors.primary} style={{ marginLeft: 6 }} />
                            ) : (
                              <Copy size={13} color={colors.primary} style={{ marginLeft: 6 }} />
                            )}
                          </TouchableOpacity>
                        ) : null}

                        <Text style={[styles.inputLabel, { color: colors.text }]}>Enter 6-Digit Authenticator Code</Text>
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
                    ) : (
                      <View>
                        <Text style={[styles.modalExplainer, { marginTop: 8, color: colors.textSecondary }]}>
                          A 6-digit verification code has been dispatched to {user?.email}.
                        </Text>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Enter 6-Digit Email Code</Text>
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
                      style={[styles.dialogSaveBtn, (!twoFactorOtp || is2FALoading) && styles.btnDisabled]}
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
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 6: In-App Terms & Privacy Document Viewer */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "DOCUMENT_VIEWER"}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setActiveModal("LEGAL");
        }}
      >
        <View style={[styles.docViewerContainer, { paddingTop: Math.max(insets.top, 20), backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.docViewerHeader, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.surfaceBorder }]}>
            <View style={styles.docViewerTitleRow}>
              <Scale size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.docViewerTitle, { color: colors.text }]}>
                {documentType === "TERMS" ? "Terms & Conditions" : "Privacy Policy"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setActiveModal("LEGAL");
              }}
              style={[styles.docViewerCloseBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9" }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Segmented Switcher */}
          <View style={[styles.docTabSwitcher, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0" }]}>
            <TouchableOpacity
              style={[styles.docTab, documentType === "TERMS" && [styles.docTabActive, { backgroundColor: colors.surfaceElevated }]]}
              onPress={() => setDocumentType("TERMS")}
            >
              <Text
                style={[
                  styles.docTabText,
                  { color: colors.textSecondary },
                  documentType === "TERMS" && styles.docTabTextActive,
                ]}
              >
                Terms of Service
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.docTab, documentType === "PRIVACY" && [styles.docTabActive, { backgroundColor: colors.surfaceElevated }]]}
              onPress={() => setDocumentType("PRIVACY")}
            >
              <Text
                style={[
                  styles.docTabText,
                  { color: colors.textSecondary },
                  documentType === "PRIVACY" && styles.docTabTextActive,
                ]}
              >
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Legal Document Body */}
          <ScrollView
            style={styles.docViewerScroll}
            contentContainerStyle={styles.docViewerScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {(() => {
              const doc = documentType === "TERMS" ? TERMS_OF_SERVICE_DOC : PRIVACY_POLICY_DOC;
              return (
                <View>
                  <View style={[styles.legalNoticeBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder }]}>
                    <Text style={styles.legalNoticeTag}>{doc.tag}</Text>
                    <Text style={[styles.legalNoticeHeading, { color: colors.text }]}>{doc.title}</Text>
                    <Text style={[styles.legalNoticeSub, { color: colors.textSecondary }]}>
                      Effective Date: {doc.effectiveDate} • {doc.regulatoryStandard}
                    </Text>
                  </View>

                  {doc.preambleCallout ? (
                    <View style={[styles.legalCalloutBox, isDark && { backgroundColor: "rgba(217, 119, 6, 0.15)", borderColor: "rgba(217, 119, 6, 0.3)" }]}>
                      <View style={styles.legalCalloutHeader}>
                        <AlertTriangle size={15} color="#D97706" style={{ marginRight: 6 }} />
                        <Text style={[styles.legalCalloutTitle, isDark && { color: "#FBBF24" }]}>{doc.preambleCallout.title}</Text>
                      </View>
                      <Text style={[styles.legalCalloutText, isDark && { color: "#FDE68A" }]}>{doc.preambleCallout.text}</Text>
                    </View>
                  ) : null}

                  {doc.intro ? (
                    <Text style={[styles.legalIntroText, { color: colors.text }]}>{doc.intro}</Text>
                  ) : null}

                  {doc.sections.map((sec) => (
                    <View key={sec.id} style={[styles.docSection, { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder }]}>
                      <Text style={[styles.docSectionTitle, { color: colors.text }]}>{sec.title}</Text>

                      {sec.callout ? (
                        <View style={[styles.sectionCallout, isDark && { backgroundColor: "rgba(255, 255, 255, 0.05)" }]}>
                          <Text style={[styles.sectionCalloutText, { color: colors.textSecondary }]}>{sec.callout}</Text>
                        </View>
                      ) : null}

                      {sec.subsections ? (
                        sec.subsections.map((sub, idx) => (
                          <View key={idx} style={{ marginBottom: 10 }}>
                            {sub.subtitle ? (
                              <Text style={[styles.docSubsectionTitle, { color: colors.text }]}>{sub.subtitle}</Text>
                            ) : null}
                            <Text style={[styles.docSectionBody, { color: colors.textSecondary }]}>{sub.text}</Text>
                          </View>
                        ))
                      ) : null}

                      {sec.body ? (
                        <Text style={[styles.docSectionBody, { marginBottom: sec.bullets ? 8 : 0, color: colors.textSecondary }]}>
                          {sec.body}
                        </Text>
                      ) : null}

                      {sec.bullets ? (
                        <View style={{ marginTop: 4, marginBottom: 4 }}>
                          {sec.bullets.map((b, bIdx) => (
                            <View key={bIdx} style={styles.legalBulletRow}>
                              <Text style={styles.legalBulletDot}>•</Text>
                              <Text style={[styles.legalBulletText, { color: colors.textSecondary }]}>{b}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}

                  {/* Document Footer */}
                  <View style={[styles.docFooterBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder }]}>
                    <Text style={[styles.docFooterCompany, { color: colors.text }]}>{doc.footer.company}</Text>
                    {doc.footer.items.map((item, idx) => (
                      <Text key={idx} style={[styles.docFooterItem, { color: colors.textSecondary }]}>
                        {item.label}: <Text style={{ color: colors.primary, fontWeight: "600" }}>{item.value}</Text>
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity
              style={styles.docViewerDoneBtn}
              onPress={() => {
                setActiveModal("LEGAL");
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.docViewerDoneText}>Close Document</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Branded Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        isDestructive={alertConfig.isDestructive}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </ScrollView>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerSettingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarTouchTarget: {
    position: "relative",
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(200, 45, 117, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.primary,
  },
  avatarLoadingOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 34,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarTierBadge: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userInfoCol: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  userPhone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  refBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
  },
  refText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },

  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Legal Identity Section Card
  legalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  legalCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  legalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  legalCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginLeft: 6,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    marginLeft: 4,
  },
  legalFieldsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  legalFieldCol: {
    flex: 1,
  },
  legalFieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  legalFieldBox: {
    height: 44,
    borderRadius: 12,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legalFieldValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    marginRight: 6,
  },
  legalEmailRow: {
    marginTop: 2,
  },
  legalEmailBox: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legalEmailText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  // Phone Verification Card
  phoneCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  phoneCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  phoneIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneTexts: {
    flex: 1,
    marginLeft: 12,
  },
  phoneCardLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  phoneCardNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  phoneLockNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  phoneLockNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
    lineHeight: 17,
  },
  changePhoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.2)",
  },
  changePhoneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  // Menu Items & Cards
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTexts: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
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
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  settingValueChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  settingValueText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },

  // Modals Styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalDismissOverlay: {
    flex: 1,
  },
  keyboardAvoidingModal: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  modalBackdropCenter: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  sheetModalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  sheetActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  sheetActionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginLeft: 12,
  },
  sheetCancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  // Form Dialog Cards
  formDialogCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
  },
  modalExplainer: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
    marginTop: 10,
  },
  highContrastInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  otpInput: {
    textAlign: "center",
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: "800",
  },
  helperNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 16,
  },
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
    flex: 1,
  },
  dialogSaveBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  dialogSaveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  backStepBtn: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  backStepText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  destructiveBtn: {
    width: "100%",
    backgroundColor: colors.error,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  destructiveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // 2FA Specific Styles
  shieldActiveOrb: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#10B98115",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  twoFactorActiveTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  twoFactorActiveSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  dividerSpacing: {
    height: 1,
    backgroundColor: "#E2E8F0",
    width: "100%",
    marginVertical: 16,
  },
  methodTabRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  methodTabActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  methodTabTextActive: {
    fontWeight: "800",
    color: colors.primary,
  },
  qrCodeBox: {
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  secretPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 14,
  },
  secretText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  // Timeout Selector
  timeoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  timeoutRowSelected: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
  },
  timeoutLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  timeoutLabelSelected: {
    fontWeight: "800",
    color: colors.primary,
  },

  // In-App Document Viewer Styles
  docViewerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  docViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: colors.surface,
  },
  docViewerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  docViewerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  docViewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  docTabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 3,
  },
  docTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  docTabActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  docTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  docTabTextActive: {
    fontWeight: "800",
    color: colors.primary,
  },
  docViewerScroll: {
    flex: 1,
  },
  docViewerScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  legalNoticeBanner: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  legalNoticeTag: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  legalNoticeHeading: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  legalNoticeSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  docSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  docSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  docSectionBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  docSubsectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  legalCalloutBox: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  legalCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  legalCalloutTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
    flex: 1,
  },
  legalCalloutText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#78350F",
  },
  legalIntroText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
    marginBottom: 16,
    fontWeight: "500",
  },
  sectionCallout: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  sectionCalloutText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 18,
  },
  legalBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    paddingRight: 8,
  },
  legalBulletDot: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.primary,
    marginRight: 6,
    fontWeight: "800",
  },
  legalBulletText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  docFooterBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginTop: 8,
    marginBottom: 8,
  },
  docFooterCompany: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  docFooterItem: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  docViewerDoneBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  docViewerDoneText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Sub-screen Modal Styles
  subScreenContainer: {
    flex: 1,
  },
  subScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  subScreenBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  subScreenTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Theme Selector Styles
  themeCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  themeCardSub: {
    fontSize: 12.5,
    marginBottom: 14,
    lineHeight: 17,
  },
  themeOptionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  themeOptionBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    position: "relative",
  },
  themeOptionBtnActive: {
    shadowColor: defaultColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  themeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  themeOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  themeOptionDesc: {
    fontSize: 10.5,
    textAlign: "center",
  },
  themeCheckBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
