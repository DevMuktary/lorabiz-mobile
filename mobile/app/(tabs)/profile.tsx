import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Platform,
  Clipboard,
  Pressable,
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
  ExternalLink,
  Info,
  Sparkles,
  Camera,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  EyeClosed,
  Headphones,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  X,
  KeyRound,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { api, BASE_URL } from "../../lib/api";
import { colors } from "../../constants/theme";
import { useQuery } from "@tanstack/react-query";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { uploadFileToServer } from "../../lib/upload";
import {
  getHideBalancePref,
  setHideBalancePref,
} from "../../lib/storage";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user,
    token,
    logout,
    biometricAvailable,
    biometricEnabled,
    toggleBiometrics,
    autoLockTimeout,
    setAutoLockSetting,
    refreshProfile,
  } = useAuth();

  // State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(user?.twoFactorEnabled ?? true);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<
    "PHOTO_OPTIONS" | "EDIT_PROFILE" | "CHANGE_PASSWORD" | "TWO_FACTOR" | "AUTO_LOCK" | null
  >(null);

  // Edit Profile Form State
  const [firstName, setFirstName] = useState(user?.firstName || user?.name?.split(" ")[0] || "");
  const [lastName, setLastName] = useState(user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password Form State
  const [passwordStep, setPasswordStep] = useState<"CURRENT" | "NEW">("CURRENT");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA Management State
  const [twoFactorMethod, setTwoFactorMethod] = useState<"AUTHENTICATOR" | "EMAIL">("AUTHENTICATOR");
  const [twoFactorQrCode, setTwoFactorQrCode] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [twoFactorOtp, setTwoFactorOtp] = useState("");
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
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

  // Load preferences
  useEffect(() => {
    getHideBalancePref().then(setHideBalance);
  }, []);

  // Sync form inputs when user profile updates
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || user.name?.split(" ")[0] || "");
      setLastName(user.lastName || user.name?.split(" ").slice(1).join(" ") || "");
      setPhone(user.phone || "");
    }
  }, [user]);

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

  // Handle Photo Upload
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

  // Handle Save Profile Details
  async function handleSaveProfileDetails() {
    if (!firstName.trim() || !lastName.trim()) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Incomplete Details",
        message: "First name and last name are required.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await api.put("/api/user/profile", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
      });

      if (res?.success) {
        await refreshProfile();
        setActiveModal(null);
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Profile Updated",
          message: "Your profile information has been securely updated.",
          confirmText: "Done",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      } else {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Update Failed",
          message: res?.message || "Could not update profile.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Update Failed",
        message: err?.message || "An unexpected error occurred.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSavingProfile(false);
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
    setHideBalance(val);
    await setHideBalancePref(val);
  }

  // Handle Toggle Email Login Alerts
  async function handleToggleEmailAlerts(val: boolean) {
    setEmailAlerts(val);
    try {
      await api.put("/api/user/profile", { emailLoginAlerts: val });
    } catch {
      setEmailAlerts(!val);
    }
  }

  // Handle Send Password Change OTP
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

  // Handle Verify OTP and Set New Password
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

  // Handle 2FA Setup Request
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

  // Handle 2FA Confirm Verification
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
        setTwoFactorBackupCodes(res.backupCodes || []);
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

  // Handle Disable 2FA
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

  // Copy Referral Code
  function handleCopyReferral() {
    if (user?.referralCode) {
      Clipboard.setString(user.referralCode);
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    }
  }

  // Copy 2FA Secret
  function handleCopySecret() {
    if (twoFactorSecret) {
      Clipboard.setString(twoFactorSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  }

  // Handle Logout
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

  // Handle Deactivate Account (Apple App Store Guideline 5.1.1(v) Compliant)
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
                setAlertConfig((prev) => ({ ...prev, visible: false })),
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Screen Title */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account & Settings</Text>
      </View>

      {/* User Info Hero Card */}
      <View style={styles.userCard}>
        {/* Avatar with Camera Overlay */}
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
                  {(user?.firstName?.[0] || user?.name?.[0] || "U").toUpperCase()}
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

        {/* User Identity Details */}
        <View style={styles.userInfoCol}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Lorabiz Customer"}
          </Text>

          {/* Tier Pill */}
          <View style={[styles.tierPill, { backgroundColor: tierColor + "18", borderColor: tierColor + "35" }]}>
            <Sparkles size={11} color={tierColor} style={{ marginRight: 4 }} />
            <Text style={[styles.tierPillText, { color: tierColor }]}>{tierName} Tier Member</Text>
          </View>

          <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
          {user?.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}

          {/* Referral Code Quick Copy */}
          {user?.referralCode ? (
            <TouchableOpacity
              style={styles.refBadge}
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

      {/* ---------------------------------------------------- */}
      {/* SECTION 1: Personal Details */}
      {/* ---------------------------------------------------- */}
      <Text style={styles.sectionHeading}>Personal Information</Text>
      <View style={styles.menuCard}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setActiveModal("EDIT_PROFILE")}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <User size={19} color={colors.primary} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Edit Profile Details</Text>
            <Text style={styles.menuSub}>Update name and phone number</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={() => setActiveModal("PHOTO_OPTIONS")}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <Camera size={19} color={colors.cyan} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Change Profile Photo</Text>
            <Text style={styles.menuSub}>Upload from camera or photo library</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ---------------------------------------------------- */}
      {/* SECTION 2: Security & Login */}
      {/* ---------------------------------------------------- */}
      <Text style={styles.sectionHeading}>Security & Access</Text>
      <View style={styles.menuCard}>
        {/* Biometrics Toggle */}
        {biometricAvailable ? (
          <View style={styles.menuItem}>
            <View style={styles.menuIconBox}>
              <Fingerprint size={19} color={colors.primary} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuTitle}>Biometric Unlock</Text>
              <Text style={styles.menuSub}>Face ID / Touch ID instant login</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: "#CBD5E1", true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        ) : null}

        {/* Two-Factor Authentication */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            if (!user?.twoFactorEnabled) {
              handleInit2FASetup("AUTHENTICATOR");
            }
            setActiveModal("TWO_FACTOR");
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <Shield size={19} color={colors.success} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Two-Factor Authentication</Text>
            <Text style={styles.menuSub}>
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
          style={styles.menuItem}
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
          <View style={styles.menuIconBox}>
            <KeyRound size={19} color={colors.gold} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Change Password</Text>
            <Text style={styles.menuSub}>Update your account login password</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* App Auto-Lock Inactivity Timeout */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={() => setActiveModal("AUTO_LOCK")}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <Clock size={19} color={colors.purple} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>App Auto-Lock</Text>
            <Text style={styles.menuSub}>Lock session when inactive</Text>
          </View>
          <View style={styles.settingValueChip}>
            <Text style={styles.settingValueText}>{getAutoLockLabel(autoLockTimeout)}</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* ---------------------------------------------------- */}
      {/* SECTION 3: Preferences */}
      {/* ---------------------------------------------------- */}
      <Text style={styles.sectionHeading}>Preferences</Text>
      <View style={styles.menuCard}>
        {/* Hide Balance Toggle */}
        <View style={styles.menuItem}>
          <View style={styles.menuIconBox}>
            <EyeClosed size={19} color={colors.textSecondary} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Hide Balances by Default</Text>
            <Text style={styles.menuSub}>Mask balances across dashboard tabs</Text>
          </View>
          <Switch
            value={hideBalance}
            onValueChange={handleToggleHideBalances}
            trackColor={{ false: "#CBD5E1", true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Email Login Security Alerts */}
        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <View style={styles.menuIconBox}>
            <Mail size={19} color={colors.info} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Email Login Alerts</Text>
            <Text style={styles.menuSub}>Notify me on new browser or mobile sign-ins</Text>
          </View>
          <Switch
            value={emailAlerts}
            onValueChange={handleToggleEmailAlerts}
            trackColor={{ false: "#CBD5E1", true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* ---------------------------------------------------- */}
      {/* SECTION 4: Support & Legal */}
      {/* ---------------------------------------------------- */}
      <Text style={styles.sectionHeading}>Support & Legal</Text>
      <View style={styles.menuCard}>
        {/* Live Support */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Linking.openURL("https://wa.me/2349000000000?text=Hello%20Lorabiz%20Support")}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <Headphones size={19} color={colors.primary} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Customer Support</Text>
            <Text style={styles.menuSub}>Live chat on WhatsApp & email help</Text>
          </View>
          <ExternalLink size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Regulatory Disclaimer */}
        <TouchableOpacity
          style={styles.menuItem}
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
          <View style={styles.menuIconBox}>
            <Info size={19} color={colors.gold} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Regulatory Disclaimer</Text>
            <Text style={styles.menuSub}>Corporate facilitation standing</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Terms */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Linking.openURL("https://lorabiz.com/terms")}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <FileText size={19} color={colors.cyan} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Terms & Conditions</Text>
            <Text style={styles.menuSub}>User service agreements</Text>
          </View>
          <ExternalLink size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={() => Linking.openURL("https://lorabiz.com/privacy")}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <Lock size={19} color={colors.purple} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={styles.menuTitle}>Privacy Policy</Text>
            <Text style={styles.menuSub}>Data protection & privacy rights</Text>
          </View>
          <ExternalLink size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ---------------------------------------------------- */}
      {/* SECTION 5: Account Actions */}
      {/* ---------------------------------------------------- */}
      <Text style={styles.sectionHeading}>Account Actions</Text>
      <View style={styles.menuCard}>
        {/* Sign Out */}
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
          <View style={[styles.menuIconBox, { backgroundColor: "#FEE2E2" }]}>
            <LogOut size={19} color={colors.error} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>Sign Out</Text>
            <Text style={styles.menuSub}>End current mobile session</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Deactivate / Delete Account (Apple App Store Guideline 5.1.1(v) Compliant) */}
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={handleCloseAccount}
          disabled={isDeactivating}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: "#FEE2E2" }]}>
            {isDeactivating ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Trash2 size={19} color={colors.error} />
            )}
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>Deactivate Account</Text>
            <Text style={styles.menuSub}>Close profile & sign out</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* App Version Stamp */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Lorabiz Mobile • v1.2.0 (Build 42)</Text>
      </View>

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
          <View style={styles.bottomSheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetModalTitle}>Profile Photo</Text>
            <Text style={styles.sheetModalSub}>Choose how you want to update your profile photo</Text>

            <TouchableOpacity
              style={styles.sheetActionBtn}
              onPress={() => handlePickImage("camera")}
              activeOpacity={0.7}
            >
              <Camera size={20} color={colors.primary} />
              <Text style={styles.sheetActionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetActionBtn}
              onPress={() => handlePickImage("library")}
              activeOpacity={0.7}
            >
              <Smartphone size={20} color={colors.primary} />
              <Text style={styles.sheetActionText}>Choose from Library</Text>
            </TouchableOpacity>

            {user?.image ? (
              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderColor: "#FEE2E2" }]}
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
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 2: Edit Profile Information Modal */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "EDIT_PROFILE"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.formDialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>First Name</Text>
              <TextInput
                style={styles.formInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First Name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Last Name</Text>
              <TextInput
                style={styles.formInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last Name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.formInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="08012345678"
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={[styles.formInput, styles.inputDisabled]}>
                <Text style={styles.disabledInputText}>{user?.email}</Text>
                <CheckCircle2 size={16} color={colors.success} />
              </View>
              <Text style={styles.helperNote}>Email address is verified and tied to your account identity.</Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.dialogSaveBtn, isSavingProfile && styles.btnDisabled]}
              onPress={handleSaveProfileDetails}
              disabled={isSavingProfile}
              activeOpacity={0.88}
            >
              {isSavingProfile ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.dialogSaveText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 3: Change Password Modal */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "CHANGE_PASSWORD"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.formDialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {passwordError ? (
              <View style={styles.errorBanner}>
                <AlertTriangle size={15} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{passwordError}</Text>
              </View>
            ) : null}

            {passwordStep === "CURRENT" ? (
              <View>
                <Text style={styles.modalExplainer}>
                  For your security, enter your current password. We will send a 6-digit confirmation code to your email.
                </Text>

                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showCurrentPass}
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                    {showCurrentPass ? <EyeOff size={19} color="#64748B" /> : <Eye size={19} color="#64748B" />}
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
                <Text style={styles.modalExplainer}>
                  Enter the 6-digit code sent to {user?.email} and your new password.
                </Text>

                <Text style={styles.inputLabel}>6-Digit Verification Code</Text>
                <TextInput
                  style={styles.formInput}
                  value={passwordOtp}
                  onChangeText={setPasswordOtp}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="At least 8 characters"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showNewPass}
                  />
                  <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
                    {showNewPass ? <EyeOff size={19} color="#64748B" /> : <Eye size={19} color="#64748B" />}
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.formInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                />

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
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 4: Two-Factor Authentication Modal */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "TWO_FACTOR"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.formDialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Two-Factor Authentication</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {twoFactorError ? (
              <View style={styles.errorBanner}>
                <AlertTriangle size={15} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{twoFactorError}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {user?.twoFactorEnabled ? (
                /* 2FA Enabled State: Option to Disable */
                <View style={{ alignItems: "center", paddingVertical: 12 }}>
                  <View style={styles.shieldActiveOrb}>
                    <Shield size={36} color={colors.success} />
                  </View>
                  <Text style={styles.twoFactorActiveTitle}>2FA is Active & Protecting Your Account</Text>
                  <Text style={styles.twoFactorActiveSub}>
                    Every sign-in requires a verification code from your authenticator app or email.
                  </Text>

                  <View style={styles.dividerSpacing} />

                  <Text style={styles.inputLabel}>Enter Account Password to Disable 2FA</Text>
                  <TextInput
                    style={styles.formInput}
                    value={disablePassword}
                    onChangeText={setDisablePassword}
                    placeholder="Enter account password"
                    secureTextEntry
                    placeholderTextColor="#94A3B8"
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
                /* 2FA Setup Flow */
                <View>
                  <Text style={styles.modalExplainer}>
                    Add an extra layer of security. Choose an authenticator app (Google Authenticator, Microsoft Authenticator) or Email OTP.
                  </Text>

                  {/* Method Selector Tabs */}
                  <View style={styles.methodTabRow}>
                    <TouchableOpacity
                      style={[styles.methodTab, twoFactorMethod === "AUTHENTICATOR" && styles.methodTabActive]}
                      onPress={() => handleInit2FASetup("AUTHENTICATOR")}
                    >
                      <Text style={[styles.methodTabText, twoFactorMethod === "AUTHENTICATOR" && styles.methodTabTextActive]}>
                        Authenticator App
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.methodTab, twoFactorMethod === "EMAIL" && styles.methodTabActive]}
                      onPress={() => handleInit2FASetup("EMAIL")}
                    >
                      <Text style={[styles.methodTabText, twoFactorMethod === "EMAIL" && styles.methodTabTextActive]}>
                        Email Passkey
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {twoFactorMethod === "AUTHENTICATOR" ? (
                    <View style={{ alignItems: "center" }}>
                      {twoFactorQrCode ? (
                        <View style={styles.qrCodeBox}>
                          <Image source={{ uri: twoFactorQrCode }} style={{ width: 160, height: 160 }} />
                        </View>
                      ) : (
                        <View style={[styles.qrCodeBox, { height: 160, justifyContent: "center" }]}>
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

                      <Text style={styles.inputLabel}>Enter 6-Digit Authenticator Code</Text>
                      <TextInput
                        style={[styles.formInput, { textAlign: "center", letterSpacing: 4, fontSize: 18, fontWeight: "700" }]}
                        value={twoFactorOtp}
                        onChangeText={setTwoFactorOtp}
                        placeholder="123456"
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  ) : (
                    <View>
                      <Text style={[styles.modalExplainer, { marginTop: 12 }]}>
                        A 6-digit verification code has been dispatched to {user?.email}.
                      </Text>
                      <Text style={styles.inputLabel}>Enter 6-Digit Email Code</Text>
                      <TextInput
                        style={[styles.formInput, { textAlign: "center", letterSpacing: 4, fontSize: 18, fontWeight: "700" }]}
                        value={twoFactorOtp}
                        onChangeText={setTwoFactorOtp}
                        placeholder="123456"
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor="#94A3B8"
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
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 5: Auto-Lock Inactivity Timeout Selector */}
      {/* ==================================================== */}
      <Modal
        visible={activeModal === "AUTO_LOCK"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissOverlay} onPress={() => setActiveModal(null)} />
          <View style={styles.bottomSheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetModalTitle}>App Auto-Lock Timeout</Text>
            <Text style={styles.sheetModalSub}>
              Automatically require Face ID or password when the app has been inactive in the background.
            </Text>

            {[
              { id: "immediately", label: "Immediately" },
              { id: "1m", label: "1 Minute" },
              { id: "5m", label: "5 Minutes" },
              { id: "15m", label: "15 Minutes" },
              { id: "1h", label: "1 Hour" },
              { id: "2h", label: "2 Hours" },
              { id: "never", label: "Never (Disabled)" },
            ].map((item) => {
              const isSelected = autoLockTimeout === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.timeoutRow, isSelected && styles.timeoutRowSelected]}
                  onPress={async () => {
                    await setAutoLockSetting(item.id);
                    setActiveModal(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.timeoutLabel, isSelected && styles.timeoutLabelSelected]}>
                    {item.label}
                  </Text>
                  {isSelected ? <Check size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setActiveModal(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    color: "#0F172A",
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
    color: "#64748B",
    fontWeight: "500",
  },
  userPhone: {
    fontSize: 12,
    color: "#64748B",
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
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 22,
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
    backgroundColor: "#F8FAFC",
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
    color: "#0F172A",
  },
  menuSub: {
    fontSize: 12,
    color: "#64748B",
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
    color: "#475569",
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
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
  bottomSheetCard: {
    backgroundColor: "#FFFFFF",
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
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 4,
  },
  sheetModalSub: {
    fontSize: 13,
    color: "#64748B",
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
    borderColor: "#E2E8F0",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  sheetActionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
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
    color: "#64748B",
  },

  formDialogCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
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
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalExplainer: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#0F172A",
  },
  inputDisabled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  disabledInputText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  helperNote: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
    marginBottom: 8,
  },
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
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
    marginTop: 20,
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
    opacity: 0.6,
  },

  // 2FA Specific Styles
  shieldActiveOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#10B98115",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  twoFactorActiveTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  twoFactorActiveSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  dividerSpacing: {
    height: 1,
    backgroundColor: "#E2E8F0",
    width: "100%",
    marginVertical: 18,
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
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  methodTabTextActive: {
    fontWeight: "800",
    color: colors.primary,
  },
  qrCodeBox: {
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
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
});
