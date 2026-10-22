import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  User,
  Lock,
  Mail,
  Smartphone,
  Phone,
  AlertTriangle,
  AlertCircle,
  X,
  Info,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user, refreshProfile } = useAuth();

  // Phone Change State (30-day cooldown & 2-step OTP)
  const [isPhoneModalVisible, setIsPhoneModalVisible] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"ENTER_PHONE" | "VERIFY_OTP">("ENTER_PHONE");
  const [newPhone, setNewPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

  const userFirstName = user?.firstName || user?.name?.split(" ")[0] || "User";
  const userLastName = user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "";

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

  function handleLegalNamePress() {
    setAlertConfig({
      visible: true,
      type: "info",
      title: "Name Uneditable",
      message:
        "Verified legal names cannot be modified directly. Please reach out to customer support if you need to request a name update.",
      confirmText: "Understood",
      onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
    });
  }

  function handleEmailPress() {
    setAlertConfig({
      visible: true,
      type: "info",
      title: "Registered Email",
      message:
        "Your email address is verified and securely tied to your Lorabiz account. For identity protection, registered email changes require administrative verification.",
      confirmText: "Understood",
      onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
    });
  }

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
    setPhoneStep("ENTER_PHONE");
    setNewPhone("");
    setPhoneOtp("");
    setPhoneError(null);
    setIsPhoneModalVisible(true);
  }

  function handleClosePhoneChange() {
    setIsPhoneModalVisible(false);
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
        setIsPhoneModalVisible(false);
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
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Personal Details</Text>
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
        {/* Verified Legal Identity Notice Box */}
        <View
          style={[
            styles.infoCalloutBox,
            {
              backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "#EFF6FF",
              borderColor: isDark ? "rgba(59, 130, 246, 0.28)" : "#BFDBFE",
            },
          ]}
        >
          <View style={styles.infoCalloutHeader}>
            <Info size={16} color="#3B82F6" style={{ marginRight: 6 }} />
            <Text style={[styles.infoCalloutTitle, { color: isDark ? "#93C5FD" : "#1D4ED8" }]}>
              Verified Account Details
            </Text>
          </View>
          <Text style={[styles.infoCalloutText, { color: isDark ? "#BFDBFE" : "#1E40AF" }]}>
            Your registered legal name and primary email address are tied to your verification records and cannot be edited directly. Tap on any field below for more information.
          </Text>
        </View>

        {/* Section 1: Registered Legal Name */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>Registered Legal Name</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardHeaderIconBox, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "rgba(200, 45, 117, 0.10)" }]}>
              <User size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Legal Identity</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                Matches your verified regulatory documentation
              </Text>
            </View>
          </View>

          <View style={styles.nameFieldsRow}>
            {/* First Name Field */}
            <View style={styles.fieldCol}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>First Name</Text>
              <TouchableOpacity
                style={[
                  styles.fieldBox,
                  {
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9",
                    borderColor: colors.surfaceBorder,
                  },
                ]}
                onPress={handleLegalNamePress}
                activeOpacity={0.7}
              >
                <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
                  {userFirstName}
                </Text>
                <Lock size={13} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Last Name Field */}
            <View style={styles.fieldCol}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Last Name</Text>
              <TouchableOpacity
                style={[
                  styles.fieldBox,
                  {
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9",
                    borderColor: colors.surfaceBorder,
                  },
                ]}
                onPress={handleLegalNamePress}
                activeOpacity={0.7}
              >
                <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
                  {userLastName || "—"}
                </Text>
                <Lock size={13} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Email Field */}
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Registered Email Address</Text>
            <TouchableOpacity
              style={[
                styles.emailBox,
                {
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9",
                  borderColor: colors.surfaceBorder,
                },
              ]}
              onPress={handleEmailPress}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                <Mail size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                <Text style={[styles.emailValue, { color: colors.text }]} numberOfLines={1}>
                  {user?.email || "No email linked"}
                </Text>
              </View>
              <Lock size={13} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Registered Phone Number */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>
          Registered Mobile Phone
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <View style={styles.phoneTopRow}>
            <View
              style={[
                styles.phoneIconBox,
                { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "rgba(200, 45, 117, 0.10)" },
              ]}
            >
              <Smartphone size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.phoneLabel, { color: colors.textMuted }]}>
                Mobile Phone Number
              </Text>
              <Text style={[styles.phoneNumberText, { color: colors.text }]}>
                {user?.phone || "No mobile number linked"}
              </Text>
            </View>
          </View>

          {isPhoneLocked() ? (
            <View
              style={[
                styles.phoneLockNotice,
                {
                  backgroundColor: isDark ? "rgba(217, 119, 6, 0.12)" : "#FFFBEB",
                  borderColor: isDark ? "rgba(217, 119, 6, 0.3)" : "#FDE68A",
                },
              ]}
            >
              <AlertTriangle size={16} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={[styles.phoneLockText, { color: isDark ? "#FDE68A" : "#92400E" }]}>
                Security Cooldown: You updated your phone number recently. For account safety, you can change it again in {getPhoneDaysRemaining()} day(s).
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.changePhoneActionBtn, { borderColor: colors.primary }]}
              onPress={handleOpenPhoneChange}
              activeOpacity={0.8}
            >
              <Phone size={15} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.changePhoneActionText, { color: colors.primary }]}>
                Change Phone Number
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Change Phone Number Bottom Sheet / Modal Dialog */}
      {isPhoneModalVisible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingModal}
          >
            <Pressable style={styles.modalDismissOverlay} onPress={handleClosePhoneChange} />
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dialogTitle, { color: colors.text }]}>
                      Change Phone Number
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      Update your registered mobile phone
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClosePhoneChange}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {phoneError ? (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={15} color={colors.error} style={{ marginRight: 6 }} />
                    <Text style={styles.errorBannerText}>{phoneError}</Text>
                  </View>
                ) : null}

                {phoneStep === "ENTER_PHONE" ? (
                  <View style={{ marginTop: 14 }}>
                    <Text style={[styles.dialogExplainer, { color: colors.textSecondary }]}>
                      Enter your new mobile phone number. We will send a 6-digit confirmation code to your registered email ({user?.email}) to verify ownership.
                    </Text>

                    <Text style={[styles.inputLabel, { color: colors.text }]}>New Phone Number</Text>
                    <TextInput
                      style={[
                        styles.highContrastInput,
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
                      selectionColor={colors.primary}
                      autoFocus
                    />

                    <Text style={[styles.helperNote, { color: colors.textMuted }]}>
                      Note: For account security, you can only update your phone number once every 30 days.
                    </Text>

                    <View style={styles.dialogActionRow}>
                      <TouchableOpacity
                        style={[
                          styles.dialogCancelBtn,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
                          },
                        ]}
                        onPress={handleClosePhoneChange}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dialogCancelText, { color: colors.text }]}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.dialogSaveBtn,
                          { backgroundColor: colors.primary },
                          (!newPhone || isPhoneLoading) && styles.btnDisabled,
                        ]}
                        onPress={handleSendPhoneOtp}
                        disabled={!newPhone || isPhoneLoading}
                        activeOpacity={0.88}
                      >
                        {isPhoneLoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.dialogSaveText}>Send Code</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 14 }}>
                    <Text style={[styles.dialogExplainer, { color: colors.textSecondary }]}>
                      Enter the 6-digit verification code dispatched to your registered email ({user?.email}).
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
                      placeholder="123456"
                      placeholderTextColor={colors.textMuted}
                      value={phoneOtp}
                      onChangeText={setPhoneOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      selectionColor={colors.primary}
                      autoFocus
                    />

                    <View style={styles.dialogActionRow}>
                      <TouchableOpacity
                        style={[
                          styles.dialogCancelBtn,
                          {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
                          },
                        ]}
                        onPress={() => setPhoneStep("ENTER_PHONE")}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dialogCancelText, { color: colors.text }]}>Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.dialogSaveBtn,
                          { backgroundColor: colors.primary },
                          (!phoneOtp || isPhoneLoading) && styles.btnDisabled,
                        ]}
                        onPress={handleVerifyPhoneOtp}
                        disabled={!phoneOtp || isPhoneLoading}
                        activeOpacity={0.88}
                      >
                        {isPhoneLoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.dialogSaveText}>Verify & Save</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
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
  infoCalloutBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  infoCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  infoCalloutTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoCalloutText: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardHeaderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  nameFieldsRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  emailBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  emailValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  phoneTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  phoneIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  phoneLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  phoneNumberText: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  phoneLockNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  phoneLockText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontWeight: "500",
  },
  changePhoneActionBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  changePhoneActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  keyboardAvoidingModal: {
    flex: 1,
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
  dialogHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  dialogExplainer: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
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
  helperNote: {
    fontSize: 11,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 15,
  },
  dialogActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  dialogCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCancelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dialogSaveBtn: {
    flex: 1.5,
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
});
