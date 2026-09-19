import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Key,
  Gift,
  X,
  Wallet,
  ArrowRight,
  WifiOff,
  Info,
  RotateCw,
  Copy,
  Check,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

interface InitialPersonalizationData {
  success: boolean;
  price?: number;
  servicePrice?: number;
  originalPrice?: number;
  hasDiscount?: boolean;
  discountBadge?: string;
  savedAmount?: number;
  isActive?: boolean;
  isServiceActive?: boolean;
  maintenanceMsg?: string | null;
  walletBalance?: number;
  freePassCount?: number;
  recentRequests?: any[];
}

export default function NinPersonalizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const trackingInputRef = useRef<TextInput>(null);

  // Live Server Pricing & Balance
  const [servicePrice, setServicePrice] = useState<number>(1500);
  const [originalPrice, setOriginalPrice] = useState<number | undefined>(undefined);
  const [hasDiscount, setHasDiscount] = useState<boolean>(false);
  const [discountBadge, setDiscountBadge] = useState<string | undefined>(undefined);
  const [savedAmount, setSavedAmount] = useState<number | undefined>(undefined);
  const [freePassCount, setFreePassCount] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isServiceActive, setIsServiceActive] = useState<boolean>(true);
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);

  // Loading & Error States
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<boolean>(false);

  // Form Fields
  const [trackingId, setTrackingId] = useState("");
  const [attestationsAccepted, setAttestationsAccepted] = useState(false);
  const [useRewardCredit, setUseRewardCredit] = useState(false);

  // Modals & UI States
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Post-submission success state
  const [submittedResult, setSubmittedResult] = useState<{
    reference: string;
    trackingId: string;
  } | null>(null);

  // Custom Alert Modal
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  // Load live data from API
  const loadInitialData = useCallback(async () => {
    setIsLoadingInitial(true);
    setInitialError(false);
    try {
      const data = await api.get<InitialPersonalizationData>("/api/nin/personalization");
      if (data && data.success) {
        setServicePrice(data.servicePrice ?? data.price ?? 1500);
        setOriginalPrice(data.originalPrice);
        setHasDiscount(Boolean(data.hasDiscount));
        setDiscountBadge(data.discountBadge);
        setSavedAmount(data.savedAmount);
        setFreePassCount(data.freePassCount || 0);
        if (data.freePassCount && data.freePassCount > 0) {
          setUseRewardCredit(true);
        }
        setIsServiceActive(data.isServiceActive ?? data.isActive ?? true);
        setMaintenanceMsg(data.maintenanceMsg || null);
        setWalletBalance(data.walletBalance || 0);
      } else {
        setInitialError(true);
      }
    } catch (err: any) {
      setInitialError(true);
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [loadInitialData])
  );

  const sanitizedTrackingId = trackingId.trim().toUpperCase();
  const isValidTrackingId = sanitizedTrackingId.length >= 8 && sanitizedTrackingId.length <= 30;
  const isPassApplied = Boolean(useRewardCredit && freePassCount > 0);
  const effectiveFee = isPassApplied ? 0 : servicePrice;
  const canSubmit = isValidTrackingId && attestationsAccepted && isServiceActive && !isSubmitting;

  const handleOpenConfirm = () => {
    if (!isValidTrackingId) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Tracking ID Required",
        message: "Please enter a valid NIMC Enrollment Tracking ID (8 to 30 characters, e.g. 0SQT6M4S4RJISV1).",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (!attestationsAccepted) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Statutory Authorization Required",
        message: "Please confirm the authorization box declaring lawful consent before submitting.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (!isPassApplied && walletBalance < effectiveFee) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Insufficient Wallet Balance",
        message: `Your balance is ₦${walletBalance.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}, but this service requires ₦${effectiveFee.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}. Please fund your wallet to proceed.`,
        confirmText: "Fund Wallet",
        cancelText: "Cancel",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.push("/wallet/fund" as any);
        },
        onCancel: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await api.post("/api/nin/personalization", {
        trackingId: sanitizedTrackingId,
        attestationsAccepted: true,
        useRewardCredit: isPassApplied,
      });

      setIsConfirmModalOpen(false);

      if (response && response.success) {
        setSubmittedResult({
          reference: response.reference,
          trackingId: sanitizedTrackingId,
        });
        // Refresh wallet balance
        setWalletBalance((prev) => Math.max(0, prev - effectiveFee));
      } else {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Submission Error",
          message: response?.message || "Unable to submit personalization request.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setIsConfirmModalOpen(false);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Submission Failed",
        message: err?.message || "A network error occurred while submitting. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedResult(null);
    setTrackingId("");
    setAttestationsAccepted(false);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>NIN Personalization</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/nin-personalization-history" as any)}
          style={styles.historyBtn}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Clock size={13} color="#059669" style={{ marginRight: 4 }} />
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Central Loading State */}
      {isLoadingInitial ? (
        <View style={styles.centerContainer}>
          <BrandLoader inline visible message="Loading personalization service..." />
        </View>
      ) : initialError ? (
        <View style={styles.centerContainer}>
          <View style={styles.offlineIconBox}>
            <WifiOff size={38} color="#94A3B8" />
          </View>
          <Text style={styles.offlineTitle}>Unable to Connect</Text>
          <Text style={styles.offlineSubtitle}>
            Could not reach LoraBiz servers. Please check your mobile internet or Wi-Fi connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={loadInitialData}
            activeOpacity={0.88}
          >
            <RotateCw size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : !isServiceActive ? (
        <View style={styles.centerContainer}>
          <View style={styles.offlineIconBox}>
            <AlertCircle size={38} color={colors.error} />
          </View>
          <Text style={styles.offlineTitle}>Service Under Maintenance</Text>
          <Text style={styles.offlineSubtitle}>
            {maintenanceMsg || "NIN Personalization service is temporarily undergoing scheduled maintenance. Please check back shortly."}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => router.back()}
            activeOpacity={0.88}
          >
            <ArrowLeft size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryBtnText}>Back to Services</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.container}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: Math.max(insets.bottom, 16) + 48 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Post-Submission Success State */}
            {submittedResult ? (
              <View style={styles.successCard}>
                <View style={styles.successIconWrap}>
                  <CheckCircle2 size={42} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>Request Submitted</Text>
                <Text style={styles.successSubtitle}>
                  Your enrollment tracking ID{" "}
                  <Text style={[styles.fontMono, styles.fontBold, { color: colors.text }]}>
                    {submittedResult.trackingId}
                  </Text>{" "}
                  has been submitted for personalization processing.
                </Text>

                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reference:</Text>
                    <Text style={[styles.summaryValue, styles.fontMono]}>
                      {submittedResult.reference}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Status:</Text>
                    <View style={styles.statusBadgePending}>
                      <Clock size={11} color="#D97706" style={{ marginRight: 4 }} />
                      <Text style={styles.statusBadgeTextPending}>PROCESSING</Text>
                    </View>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Turnaround:</Text>
                    <Text style={[styles.summaryValue, { color: "#059669", fontWeight: "700" }]}>
                      30 Mins – 3 Working Hours
                    </Text>
                  </View>
                </View>

                <Text style={styles.successNote}>
                  You will receive an automated notification as soon as personalization completes.
                </Text>

                <View style={styles.successActions}>
                  <TouchableOpacity
                    style={styles.primaryHistoryBtn}
                    onPress={() => router.push("/services/nin-personalization-history" as any)}
                    activeOpacity={0.88}
                  >
                    <Clock size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryHistoryBtnText}>Go to History & Records</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondarySubmitBtn}
                    onPress={handleResetForm}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondarySubmitBtnText}>Submit Another Request</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Agency Banner */}
                <View style={styles.agencyBanner}>
                  <Image
                    source={require("../../assets/nimc.png")}
                    style={styles.agencyLogo}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.agencyBadge}>NIMC ACCREDITED VERIFICATION</Text>
                    <Text style={styles.agencyTitle}>NIN Personalization</Text>
                    <Text style={styles.agencyDesc}>
                      Submit your enrollment tracking ID to generate and release your NIN slip.
                    </Text>
                  </View>
                </View>

                {/* Timeline & Policy Advisory Pill */}
                <TouchableOpacity
                  style={styles.policyPill}
                  onPress={() => setIsPolicyModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.policyPillLeft}>
                    <Clock size={15} color="#059669" />
                    <Text style={styles.policyPillText}>
                      Turnaround: <Text style={styles.fontBold}>30 Mins – 3 Working Hours</Text>
                    </Text>
                  </View>
                  <View style={styles.policyPillRight}>
                    <Text style={styles.policyPillAction}>Policy ⓘ</Text>
                  </View>
                </TouchableOpacity>

                {/* PalmPay / OPay Style Free Pass Voucher Card */}
                {freePassCount > 0 && (
                  <View style={styles.freePassCard}>
                    <View style={styles.freePassLeft}>
                      <View style={styles.giftIconWrap}>
                        <Gift size={16} color="#059669" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.freePassTitle}>Free Personalization Pass</Text>
                          <View style={styles.freePassBadge}>
                            <Text style={styles.freePassBadgeText}>{freePassCount} READY</Text>
                          </View>
                        </View>
                        <Text style={styles.freePassSub}>
                          {useRewardCredit
                            ? "Pass applied · Fee slashed to ₦0.00"
                            : "Pass available · Toggle switch to apply"}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.switchTrack, useRewardCredit && styles.switchTrackActive]}
                      onPress={() => setUseRewardCredit(!useRewardCredit)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[styles.switchThumb, useRewardCredit && styles.switchThumbActive]}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 1: NIMC Enrollment Tracking ID */}
                <View style={styles.inputCard}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>1. NIMC Enrollment Tracking ID</Text>
                    <Text style={styles.inputCounter}>{sanitizedTrackingId.length} chars</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.inputWrap}
                    activeOpacity={1}
                    onPress={() => trackingInputRef.current?.focus()}
                  >
                    <Key size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      ref={trackingInputRef}
                      style={styles.textInput}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={30}
                      value={trackingId}
                      onChangeText={(text) => setTrackingId(text.toUpperCase())}
                      placeholder="e.g. 0SQT6M4S4RJISV1"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    {isValidTrackingId ? (
                      <CheckCircle2 size={20} color={colors.success} style={{ marginLeft: 8 }} />
                    ) : null}
                  </TouchableOpacity>
                  <Text style={styles.inputHint}>
                    Enter the tracking ID printed on your NIMC enrollment registration slip.
                  </Text>
                </View>

                {/* Step 2: Pricing & Wallet Overview */}
                <View style={styles.pricingCard}>
                  <View style={styles.pricingHeaderRow}>
                    <Text style={styles.sectionLabel}>2. Service Fee</Text>
                    <TouchableOpacity
                      style={styles.walletBalanceChip}
                      onPress={() => router.push("/wallet/fund" as any)}
                      activeOpacity={0.7}
                    >
                      <Wallet size={12} color="#059669" style={{ marginRight: 5 }} />
                      <Text style={styles.walletBalanceChipText}>
                        ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.feeBreakdownBox}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={styles.feeBreakdownLabel}>Processing Fee</Text>
                      {isPassApplied ? (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.priceStrikethrough}>₦{servicePrice.toLocaleString()}</Text>
                          <Text style={styles.priceFreeText}>₦0.00 Free with Pass</Text>
                        </View>
                      ) : hasDiscount && originalPrice && originalPrice > servicePrice ? (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.priceStrikethrough}>₦{originalPrice.toLocaleString()}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Text style={styles.feeBreakdownValue}>₦{servicePrice.toLocaleString()}</Text>
                            <View style={styles.discountPill}>
                              <Text style={styles.discountPillText}>{discountBadge || "DISCOUNT"}</Text>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.feeBreakdownValue}>₦{servicePrice.toLocaleString()}</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Step 3: Statutory NDPA Attestation */}
                <View style={styles.stepSection}>
                  <TouchableOpacity
                    style={[
                      styles.attestationRow,
                      attestationsAccepted && styles.attestationRowAccepted,
                    ]}
                    onPress={() => setAttestationsAccepted(!attestationsAccepted)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        attestationsAccepted && styles.checkboxAccepted,
                      ]}
                    >
                      {attestationsAccepted && <CheckCircle2 size={15} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.attestationText}>
                      I verify that this Tracking ID belongs to the applicant and authorize LoraBiz to submit this enrollment record for personalization processing.
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                  onPress={handleOpenConfirm}
                  disabled={!canSubmit}
                  activeOpacity={0.85}
                >
                  <ShieldCheck size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>
                    {isPassApplied
                      ? "Submit Request (₦0.00 Free)"
                      : `Proceed · ₦${effectiveFee.toLocaleString()}`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Policy & Timeline Modal */}
      <Modal
        visible={isPolicyModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPolicyModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Clock size={20} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Processing Timeline & Policy</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsPolicyModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.policySectionCard}>
              <Text style={styles.policySectionTitle}>⚡ Fast Processing Turnaround</Text>
              <Text style={styles.policySectionBody}>
                NIN Personalization typically completes within{" "}
                <Text style={styles.fontBold}>30 minutes to 3 working hours</Text>. During peak periods, requests are prioritized sequentially.
              </Text>
            </View>

            <View style={[styles.policySectionCard, { borderColor: "rgba(239, 68, 68, 0.25)", backgroundColor: "rgba(239, 68, 68, 0.04)" }]}>
              <Text style={[styles.policySectionTitle, { color: colors.error }]}>⚠️ Strictly Non-Refundable Policy</Text>
              <Text style={styles.policySectionBody}>
                Fulfillment fees are billed 100% upfront to the NIMC verification gateway upon transmission. Therefore, personalization requests cannot be reversed or refunded once submitted.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.policyModalCloseBtn}
              onPress={() => setIsPolicyModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.policyModalCloseBtnText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Order Review & Confirmation Modal */}
      <Modal
        visible={isConfirmModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmitting && setIsConfirmModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ShieldCheck size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Confirm Personalization</Text>
              </View>
              {!isSubmitting && (
                <TouchableOpacity
                  onPress={() => setIsConfirmModalOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service:</Text>
                <Text style={styles.summaryValue}>NIN Personalization</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tracking ID:</Text>
                <Text style={[styles.summaryValue, styles.fontMono, styles.fontBold]}>
                  {sanitizedTrackingId}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Turnaround:</Text>
                <Text style={[styles.summaryValue, { color: "#059669", fontWeight: "700" }]}>
                  30 Mins – 3 Working Hours
                </Text>
              </View>

              {isPassApplied && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Voucher Applied:</Text>
                    <Text style={[styles.summaryValue, { color: "#059669", fontWeight: "800" }]}>
                      1x Free Pass (-₦{servicePrice.toLocaleString()})
                    </Text>
                  </View>
                </>
              )}

              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount:</Text>
                <Text style={[styles.summaryValue, styles.fontBold, { color: colors.primary, fontSize: 16 }]}>
                  {isPassApplied ? "₦0.00 Free" : `₦${effectiveFee.toLocaleString()}`}
                </Text>
              </View>
            </View>

            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, isSubmitting && styles.modalConfirmBtnDisabled]}
                onPress={handleConfirmSubmit}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirm &amp; Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  agencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  agencyLogo: {
    width: 48,
    height: 48,
  },
  agencyBadge: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  agencyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  agencyDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  policyPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(5, 150, 105, 0.06)",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.15)",
    marginBottom: 14,
  },
  policyPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  policyPillText: {
    fontSize: 12,
    color: colors.text,
  },
  policyPillRight: {
    marginLeft: 8,
  },
  policyPillAction: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#059669",
  },
  freePassCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(5, 150, 105, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  freePassLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  giftIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(5, 150, 105, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  freePassTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.text,
  },
  freePassBadge: {
    backgroundColor: "#059669",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  freePassBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  freePassSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#CBD5E1",
    padding: 2,
    justifyContent: "center",
  },
  switchTrackActive: {
    backgroundColor: "#059669",
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputCounter: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  textInput: {
    flex: 1,
    height: "100%",
    paddingVertical: 0,
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 0.8,
  },
  inputHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  pricingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  pricingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  walletBalanceChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  walletBalanceChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  feeBreakdownBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  feeBreakdownLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  feeBreakdownValue: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.text,
  },
  priceStrikethrough: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  priceFreeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },
  discountPill: {
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountPillText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#059669",
  },
  stepSection: {
    marginBottom: 16,
  },
  attestationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  attestationRowAccepted: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.02)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },
  checkboxAccepted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  attestationText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  submitBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  offlineIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  offlineTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  offlineSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  policySectionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  policySectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  policySectionBody: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 18,
    marginTop: 4,
  },
  policyModalCloseBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  policyModalCloseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    marginVertical: 9,
  },
  statusBadgePending: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(217, 119, 6, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusBadgeTextPending: {
    fontSize: 11,
    fontWeight: "800",
    color: "#D97706",
  },
  confirmModalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmBtnDisabled: {
    opacity: 0.6,
  },
  modalConfirmBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    marginTop: 10,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  successNote: {
    fontSize: 11.5,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 16,
  },
  successActions: {
    width: "100%",
    gap: 10,
  },
  primaryHistoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryHistoryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondarySubmitBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingVertical: 13,
  },
  secondarySubmitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  fontBold: {
    fontWeight: "700",
  },
  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
