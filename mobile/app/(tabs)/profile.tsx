import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Clipboard,
  Pressable,
  Linking,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  Shield,
  LogOut,
  Trash2,
  ChevronRight,
  Sparkles,
  Camera,
  Copy,
  Check,
  Headphones,
  Scale,
  Settings,
  UserCheck,
  Smartphone,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { uploadFileToServer } from "../../lib/upload";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { user, logout, refreshProfile } = useAuth();

  // State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  // Custom Alert Modal State
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

  const userFirstName = user?.firstName || user?.name?.split(" ")[0] || "User";
  const userLastName = user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "";

  // Handle Photo Selection
  async function handlePickImage(source: "camera" | "library") {
    setShowPhotoOptions(false);
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
    setShowPhotoOptions(false);
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
          onPress={() => router.push("/profile/settings")}
          activeOpacity={0.7}
        >
          <Settings size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* User Info Hero Card */}
      <View
        style={[
          styles.userCard,
          { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
        ]}
      >
        <View style={styles.avatarWrapper}>
          <TouchableOpacity
            style={styles.avatarTouchTarget}
            onPress={() => setShowPhotoOptions(true)}
            activeOpacity={0.85}
          >
            {user?.image ? (
              <Image source={{ uri: user.image }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{(userFirstName[0] || "U").toUpperCase()}</Text>
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

          <View
            style={[
              styles.tierPill,
              { backgroundColor: tierColor + "18", borderColor: tierColor + "35" },
            ]}
          >
            <Sparkles size={11} color={tierColor} style={{ marginRight: 4 }} />
            <Text style={[styles.tierPillText, { color: tierColor }]}>{tierName} Tier Member</Text>
          </View>

          <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
            {user?.email}
          </Text>
          {user?.phone ? (
            <Text style={[styles.userPhone, { color: colors.textMuted }]}>{user.phone}</Text>
          ) : null}

          {user?.referralCode ? (
            <TouchableOpacity
              style={[
                styles.refBadge,
                {
                  backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "#FDF2F8",
                  borderColor: isDark ? "rgba(200, 45, 117, 0.3)" : "rgba(200, 45, 117, 0.2)",
                },
              ]}
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
      <View
        style={[
          styles.menuCard,
          { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, marginTop: 14 },
        ]}
      >
        {/* 1. Personal Details */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            {
              borderBottomColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : colors.surfaceBorder,
            },
          ]}
          onPress={() => router.push("/profile/personal-details")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.menuIconBox,
              {
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.15)"
                  : "rgba(59, 130, 246, 0.10)",
              },
            ]}
          >
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
          style={[
            styles.menuItem,
            {
              borderBottomColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : colors.surfaceBorder,
            },
          ]}
          onPress={() => router.push("/profile/settings")}
          activeOpacity={0.7}
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

        {/* 3. Security */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            {
              borderBottomColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : colors.surfaceBorder,
            },
          ]}
          onPress={() => router.push("/profile/security")}
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
          style={[
            styles.menuItem,
            {
              borderBottomColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : colors.surfaceBorder,
            },
          ]}
          onPress={() => Linking.openURL("https://wa.me/12299494839?text=Hello%20Lorabiz%20Support")}
          activeOpacity={0.7}
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
          onPress={() => router.push("/profile/legal")}
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
      <View
        style={[
          styles.menuCard,
          { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, marginTop: 14 },
        ]}
      >
        {/* Sign Out */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            {
              borderBottomColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : colors.surfaceBorder,
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.menuIconBox,
              { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" },
            ]}
          >
            <LogOut size={19} color={colors.error} />
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>Sign Out</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
              End current mobile session
            </Text>
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
          <View
            style={[
              styles.menuIconBox,
              { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" },
            ]}
          >
            {isDeactivating ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Trash2 size={19} color={colors.error} />
            )}
          </View>
          <View style={styles.menuTexts}>
            <Text style={[styles.menuTitle, { color: colors.error }]}>Deactivate Account</Text>
            <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
              Close profile & sign out
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* App Version Stamp */}
      <View style={styles.versionContainer}>
        <Text style={[styles.versionText, { color: colors.textMuted }]}>
          Lorabiz Mobile • v1.0
        </Text>
      </View>

      {/* Profile Photo Options Dialog */}
      <Modal
        visible={showPhotoOptions}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowPhotoOptions(false)}
          />
          <View
            style={[
              styles.bottomSheetCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.surfaceBorder,
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View
              style={[
                styles.sheetHandle,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.2)"
                    : "#CBD5E1",
                },
              ]}
            />
            <Text style={[styles.sheetModalTitle, { color: colors.text }]}>Profile Photo</Text>
            <Text style={[styles.sheetModalSub, { color: colors.textSecondary }]}>
              Choose how you want to update your profile photo
            </Text>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
              ]}
              onPress={() => handlePickImage("camera")}
              activeOpacity={0.7}
            >
              <Camera size={20} color={colors.primary} />
              <Text style={[styles.sheetActionText, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sheetActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
              ]}
              onPress={() => handlePickImage("library")}
              activeOpacity={0.7}
            >
              <Smartphone size={20} color={colors.primary} />
              <Text style={[styles.sheetActionText, { color: colors.text }]}>
                Choose from Library
              </Text>
            </TouchableOpacity>

            {user?.image ? (
              <TouchableOpacity
                style={[
                  styles.sheetActionBtn,
                  {
                    backgroundColor: isDark ? "rgba(239, 68, 68, 0.10)" : "#FEF2F2",
                    borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "#FEE2E2",
                  },
                ]}
                onPress={handleRemovePhoto}
                activeOpacity={0.7}
              >
                <Trash2 size={20} color={colors.error} />
                <Text style={[styles.sheetActionText, { color: colors.error }]}>
                  Remove Photo
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setShowPhotoOptions(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
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
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
    },
    avatarWrapper: {
      position: "relative",
      marginRight: 16,
    },
    avatarTouchTarget: {
      width: 68,
      height: 68,
      borderRadius: 34,
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
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 24,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    avatarLoadingOverlay: {
      ...StyleSheet.absoluteFill,
      borderRadius: 34,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    cameraIconBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarTierBadge: {
      position: "absolute",
      top: -2,
      left: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    userInfoCol: {
      flex: 1,
    },
    userName: {
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.2,
      marginBottom: 3,
    },
    tierPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2.5,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 5,
    },
    tierPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    userEmail: {
      fontSize: 12.5,
      fontWeight: "500",
    },
    userPhone: {
      fontSize: 12,
      marginTop: 1,
    },
    refBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      marginTop: 6,
    },
    refText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primary,
    },
    menuCard: {
      borderRadius: 20,
      borderWidth: 1,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
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
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    menuTexts: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 14.5,
      fontWeight: "700",
    },
    menuSub: {
      fontSize: 12,
      marginTop: 2,
    },
    versionContainer: {
      alignItems: "center",
      marginTop: 24,
      marginBottom: 12,
    },
    versionText: {
      fontSize: 12,
      fontWeight: "500",
    },
    modalDismissOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
    },
    bottomSheetCard: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      padding: 20,
      paddingBottom: 32,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: 14,
    },
    sheetModalTitle: {
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 4,
    },
    sheetModalSub: {
      fontSize: 13,
      marginBottom: 18,
    },
    sheetActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 10,
      gap: 12,
    },
    sheetActionText: {
      fontSize: 14.5,
      fontWeight: "600",
    },
    sheetCancelBtn: {
      alignItems: "center",
      paddingVertical: 12,
      marginTop: 4,
    },
    sheetCancelText: {
      fontSize: 14,
      fontWeight: "600",
    },
  });
