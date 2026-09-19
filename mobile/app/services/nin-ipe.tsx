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

interface InitialIpeData {
  success: boolean;
  servicePrice?: number;
  originalPrice?: number;
  hasDiscount?: boolean;
  discountBadge?: string;
  savedAmount?: number;
  isServiceActive?: boolean;
  maintenanceMsg?: string | null;
  walletBalance?: number;
  requests?: any[];
  stats?: {
    total: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export default function NinIpeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const trackingInputRef = useRef<TextInput>(null);

  // Live Server Pricing & Balance
  const [servicePrice, setServicePrice] = useState<number>(2500);
  const [originalPrice, setOriginalPrice] = useState<number | undefined>(undefined);
  const [hasDiscount, setHasDiscount] = useState<boolean>(false);
  const [discountBadge, setDiscountBadge] = useState<string | undefined>(undefined);
  const [savedAmount, setSavedAmount] = useState<number | undefined>(undefined);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isServiceActive, setIsServiceActive] = useState<boolean>(true);
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState<number>(0);

  // Form State
  const [trackingId, setTrackingId] = useState<string>("");
  const [attestationsAccepted, setAttestationsAccepted] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Submission & Modal State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  // Post-submission success record
  const [submittedResult, setSubmittedResult] = useState<{
    reference: string;
    trackingId: string;
    status: string;
    amountCharged: number;
  } | null>(null);

  // Custom Alert Modal
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

  // Fetch Pricing, Wallet Balance, and Service Health
  const fetchServiceData = useCallback(async () => {
    try {
      const res = await api.get<InitialIpeData>("/api/nin/ipe/history");

      if (res && res.success) {
        if (typeof res.servicePrice === "number") setServicePrice(res.servicePrice);
        if (typeof res.originalPrice === "number") setOriginalPrice(res.originalPrice);
        setHasDiscount(Boolean(res.hasDiscount));
        setDiscountBadge(res.discountBadge || undefined);
        setSavedAmount(res.savedAmount || undefined);
        if (typeof res.walletBalance === "number") setWalletBalance(res.walletBalance);
        setIsServiceActive(res.isServiceActive ?? true);
        setMaintenanceMsg(res.maintenanceMsg || null);
        if (res.stats && typeof res.stats.total === "number") {
          setHistoryCount(res.stats.total);
        } else if (Array.isArray(res.requests)) {
          setHistoryCount(res.requests.length);
        }
      }
    } catch (err: any) {
      console.error("Failed to load IPE Clearance service data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchServiceData();
    }, [fetchServiceData])
  );

  useEffect(() => {
    // 1-tap focus tracking input on mount
    const timer = setTimeout(() => {
      trackingInputRef.current?.focus();
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const sanitizedTrackingId = trackingId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isValidTrackingId = sanitizedTrackingId.length >= 8 && sanitizedTrackingId.length <= 30;
  const isBalanceSufficient = walletBalance >= servicePrice;
  const canProceed = isValidTrackingId && attestationsAccepted && isServiceActive && !isLoading;

  const handleTrackingChange = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setTrackingId(cleaned);
    if (inputError) setInputError(null);
  };

  const handleValidateAndReview = () => {
    Keyboard.dismiss();
    setInputError(null);

    if (!sanitizedTrackingId) {
      setInputError("Please enter your NIMC Enrollment Tracking ID.");
      trackingInputRef.current?.focus();
      return;
    }

    if (!isValidTrackingId) {
      setInputError("Tracking ID must be between 8 and 30 alphanumeric characters.");
      trackingInputRef.current?.focus();
      return;
    }

    if (!attestationsAccepted) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Declaration Required",
        message: "Please accept the legal authorization declaration under NDPA 2023 to proceed.",
        confirmText: "I Agree",
        onConfirm: () => {
          setAttestationsAccepted(true);
          setAlertConfig((prev) => ({ ...prev, visible: false }));
        },
      });
      return;
    }

    if (!isBalanceSufficient) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Insufficient Balance",
        message: `This service costs ₦${servicePrice.toLocaleString()}, but your current wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
        confirmText: "Fund Wallet",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.push("/wallet" as any);
        },
      });
      return;
    }

    setIsReviewModalOpen(true);
  };

  const handleConfirmSubmission = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        reference: string;
        trackingId: string;
        status?: string;
      }>("/api/nin/ipe", {
        trackingId: sanitizedTrackingId,
        attestationsAccepted: true,
      });

      if (res && res.success) {
        setIsReviewModalOpen(false);
        setSubmittedResult({
          reference: res.reference,
          trackingId: sanitizedTrackingId,
          status: res.status || "PROCESSING",
          amountCharged: servicePrice,
        });

        // Update local wallet balance immediately
        setWalletBalance((prev) => Math.max(0, prev - servicePrice));
        setHistoryCount((prev) => prev + 1);
        setTrackingId("");
        setAttestationsAccepted(false);
      } else {
        setIsReviewModalOpen(false);
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Submission Failed",
          message: res?.message || "Failed to submit IPE clearance. Please try again.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setIsReviewModalOpen(false);
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Network connection error. Please try again.";
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Submission Error",
        message: errMsg,
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyReference = (ref: string) => {
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <BrandLoader message="Loading IPE Clearance pricing..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>NIMC IPE Clearance</Text>
          <Text style={styles.headerSubtitle}>Clear In-Processing Errors</Text>
        </View>

        {/* History Action Pill */}
        <TouchableOpacity
          onPress={() => router.push("/services/nin-ipe-history" as any)}
          style={styles.historyBtn}
          activeOpacity={0.8}
        >
          <Clock size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.historyBtnText}>History</Text>
          {historyCount > 0 && (
            <View style={styles.historyBadge}>
              <Text style={styles.historyBadgeText}>{historyCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Post-Submission Inline Success Screen */}
          {submittedResult ? (
            <View style={styles.successBox}>
              <View style={styles.successIconCircle}>
                <CheckCircle2 size={44} color="#059669" />
              </View>

              <Text style={styles.successTitle}>Clearance Request Submitted</Text>
              <Text style={styles.successSubtitle}>
                Your IPE clearance application for Tracking ID{" "}
                <Text style={{ fontWeight: "700", color: colors.text }}>
                  {submittedResult.trackingId}
                </Text>{" "}
                has been transmitted to the NIMC clearance gateway.
              </Text>

              {/* Order Card */}
              <View style={styles.successCard}>
                <View style={styles.successCardRow}>
                  <Text style={styles.successCardLabel}>Reference</Text>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                    onPress={() => handleCopyReference(submittedResult.reference)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.successCardRef}>{submittedResult.reference}</Text>
                    {copiedRef ? (
                      <Check size={14} color="#059669" />
                    ) : (
                      <Copy size={14} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.successCardRow}>
                  <Text style={styles.successCardLabel}>Status</Text>
                  <View style={styles.statusPillProcessing}>
                    <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
                    <Text style={styles.statusPillTextProcessing}>PROCESSING</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.successCardRow}>
                  <Text style={styles.successCardLabel}>Estimated Turnaround</Text>
                  <Text style={styles.successCardValBold}>24 – 72 Working Hours</Text>
                </View>
              </View>

              {/* Post-Submission Actions */}
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => router.push("/services/nin-ipe-history" as any)}
                activeOpacity={0.88}
              >
                <Clock size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionText}>Track in Clearance History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => setSubmittedResult(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryActionText}>Submit Another Tracking ID</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Service Outage Notice (if inactive) */}
              {!isServiceActive && (
                <View style={styles.maintenanceCard}>
                  <WifiOff size={20} color="#DC2626" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.maintenanceTitle}>Service Down for Maintenance</Text>
                    <Text style={styles.maintenanceText}>
                      {maintenanceMsg ||
                        "NIMC IPE Clearance is temporarily paused for gateway maintenance. Please check back shortly."}
                    </Text>
                  </View>
                </View>
              )}

              {/* Agency Banner Card: Matches Personalization/Validation Flow */}
              <View style={styles.agencyBanner}>
                <Image
                  source={require("../../assets/nimc.png")}
                  style={styles.agencyLogo}
                  resizeMode="contain"
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.agencyBadge}>NIMC CLEARANCE SERVICE</Text>
                  <Text style={styles.agencyTitle}>IPE Error Clearance</Text>
                  <Text style={styles.agencyDesc}>
                    Clear stuck in-processing enrollment tracking IDs and release your 11-digit NIN.
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
                    Turnaround: <Text style={{ fontWeight: "700" }}>24 – 72 Working Hours</Text>
                  </Text>
                </View>
                <View style={styles.policyPillRight}>
                  <Text style={styles.policyPillAction}>Policy ⓘ</Text>
                </View>
              </TouchableOpacity>

              {/* Pricing & Wallet Balance Header Bar */}
              <View style={styles.pricingCard}>
                <View style={styles.pricingLeft}>
                  <Text style={styles.pricingLabel}>PROCESSING FEE</Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                    {hasDiscount && originalPrice && originalPrice > servicePrice ? (
                      <Text style={styles.originalPriceText}>
                        ₦{originalPrice.toLocaleString()}
                      </Text>
                    ) : null}
                    <Text style={styles.currentPriceText}>
                      ₦{servicePrice.toLocaleString()}
                    </Text>
                  </View>
                  {discountBadge ? (
                    <View style={styles.discountBadgeWrap}>
                      <Text style={styles.discountBadgeText}>{discountBadge} APPLIED</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.balanceRight}>
                  <Text style={styles.balanceLabel}>WALLET BALANCE</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                    <Wallet size={13} color={colors.textMuted} />
                    <Text
                      style={[
                        styles.balanceValue,
                        !isBalanceSufficient && { color: colors.error },
                      ]}
                    >
                      ₦{walletBalance.toLocaleString()}
                    </Text>
                  </View>
                  {!isBalanceSufficient ? (
                    <TouchableOpacity
                      onPress={() => router.push("/wallet" as any)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.fundWalletLink}>+ Top Up Wallet</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Form Card */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Key size={18} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.formCardTitle}>NIMC Enrollment Tracking ID</Text>
                </View>

                <Text style={styles.formCardSub}>
                  Enter the Tracking ID printed on the top of your NIMC enrollment or modification slip.
                </Text>

                {/* Tracking ID Input Box */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => trackingInputRef.current?.focus()}
                  style={[
                    styles.inputWrap,
                    Boolean(inputError) && styles.inputWrapError,
                    isValidTrackingId && styles.inputWrapSuccess,
                  ]}
                >
                  <TextInput
                    ref={trackingInputRef}
                    style={styles.trackingInput}
                    value={trackingId}
                    onChangeText={handleTrackingChange}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollTo({ y: 120, animated: true });
                      }, 200);
                    }}
                    placeholder="e.g. 0SQT6M4S4RJISV1"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={30}
                    returnKeyType="done"
                    onSubmitEditing={handleValidateAndReview}
                  />

                  {isValidTrackingId ? (
                    <View style={styles.inputEndIcon}>
                      <CheckCircle2 size={18} color="#059669" />
                    </View>
                  ) : trackingId.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setTrackingId("")}
                      style={styles.inputEndIcon}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>

                {/* Input Character Counter & Error Message */}
                <View style={styles.inputMetaRow}>
                  {inputError ? (
                    <Text style={styles.inputErrorText}>{inputError}</Text>
                  ) : (
                    <Text style={styles.inputHintText}>Usually 15 alphanumeric characters</Text>
                  )}
                  <Text
                    style={[
                      styles.charCountText,
                      isValidTrackingId && { color: "#059669", fontWeight: "700" },
                    ]}
                  >
                    {sanitizedTrackingId.length} / 30
                  </Text>
                </View>

                {/* Statutory NDPA Declaration Checkbox */}
                <TouchableOpacity
                  style={styles.attestationRow}
                  activeOpacity={0.8}
                  onPress={() => setAttestationsAccepted(!attestationsAccepted)}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      attestationsAccepted && styles.checkboxBoxActive,
                    ]}
                  >
                    {attestationsAccepted && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.attestationText}>
                    I confirm that I am the applicant or hold lawful authorization to request IPE clearance for this Tracking ID under the{" "}
                    <Text style={{ fontWeight: "700", color: colors.text }}>
                      Nigeria Data Protection Act (NDPA) 2023
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>

                {/* Submit Proceed Button */}
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!canProceed || isSubmitting) && styles.submitBtnDisabled,
                  ]}
                  onPress={handleValidateAndReview}
                  disabled={!canProceed || isSubmitting}
                  activeOpacity={0.88}
                >
                  <ShieldCheck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>
                    Submit Clearance (₦{servicePrice.toLocaleString()})
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation & Order Review Modal */}
      <Modal
        visible={isReviewModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmitting && setIsReviewModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.modalHeaderIconWrap}>
                  <ShieldCheck size={20} color={colors.primary} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.modalTitle}>Confirm IPE Clearance</Text>
                  <Text style={styles.modalSub}>Review transaction breakdown</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsReviewModalOpen(false)}
                disabled={isSubmitting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Breakdown Box */}
            <View style={styles.breakdownBox}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Service</Text>
                <Text style={styles.breakdownValue}>NIMC IPE Clearance</Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tracking ID</Text>
                <Text style={styles.breakdownMonoVal}>{sanitizedTrackingId}</Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Turnaround</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
                  <Text style={[styles.breakdownValue, { color: "#D97706", fontWeight: "700" }]}>
                    24 – 72 Working Hours
                  </Text>
                </View>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Service Fee</Text>
                <Text style={styles.breakdownPrice}>₦{servicePrice.toLocaleString()}</Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Balance After Debit</Text>
                <Text style={styles.breakdownBalanceAfter}>
                  ₦{(walletBalance - servicePrice).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsReviewModalOpen(false)}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmSubmission}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.modalConfirmBtnText}>Confirm & Debit</Text>
                    <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Policy Bottom Sheet Modal */}
      <Modal
        visible={isPolicyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPolicyModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.modalHeaderIconWrap}>
                  <Info size={20} color={colors.primary} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.modalTitle}>NIMC Clearance Policy</Text>
                  <Text style={styles.modalSub}>Turnaround and processing guidelines</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsPolicyModalOpen(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginTop: 6 }}>
              <View style={styles.policyItem}>
                <Text style={styles.policyTitle}>1. Expected Turnaround (24 – 72 Working Hours)</Text>
                <Text style={styles.policyDesc}>
                  NIMC In-Processing Error clearances require database reconciliation at the national identity gateway. Applications typically resolve within 24 to 72 working hours (excluding weekends and statutory holidays).
                </Text>
              </View>

              <View style={styles.policyItem}>
                <Text style={styles.policyTitle}>2. Automatic Refund on Failure</Text>
                <Text style={styles.policyDesc}>
                  If the NIMC clearance portal rejects the tracking ID (due to biometric unreadability, unverified center enrollment, or duplicate identity), the full fee is immediately refunded back to your LoraBiz wallet.
                </Text>
              </View>

              <View style={styles.policyItem}>
                <Text style={styles.policyTitle}>3. What You Receive</Text>
                <Text style={styles.policyDesc}>
                  Upon completion, your 11-digit NIN and new Tracking ID will be available on your Clearance History page.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 18 }]}
              onPress={() => setIsPolicyModalOpen(false)}
            >
              <Text style={styles.primaryActionText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Global Alert Modal */}
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
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 1,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  historyBadge: {
    marginLeft: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scrollContent: {
    padding: 16,
  },
  maintenanceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  maintenanceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  maintenanceText: {
    fontSize: 12,
    color: "#991B1B",
    marginTop: 2,
    lineHeight: 18,
  },
  agencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  agencyLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  agencyBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  agencyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 1,
  },
  agencyDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  policyPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  policyPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  policyPillText: {
    fontSize: 12,
    color: "#065F46",
  },
  policyPillRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  policyPillAction: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },
  pricingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  pricingLeft: {
    flex: 1,
  },
  pricingLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  originalPriceText: {
    fontSize: 13,
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  currentPriceText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#059669",
  },
  discountBadgeWrap: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  discountBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#15803D",
  },
  balanceRight: {
    alignItems: "flex-end",
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  fundWalletLink: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  formCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  formCardSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  inputWrapSuccess: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  trackingInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
    letterSpacing: 1.5,
  },
  inputEndIcon: {
    padding: 4,
  },
  inputMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  inputErrorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#EF4444",
    flex: 1,
  },
  inputHintText: {
    fontSize: 11,
    color: "#94A3B8",
    flex: 1,
  },
  charCountText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#64748B",
    marginLeft: 8,
  },
  attestationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 16,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  checkboxBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  attestationText: {
    fontSize: 11,
    color: "#475569",
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  // Success Screen Styles
  successBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  successCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginVertical: 18,
  },
  successCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  successCardLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  successCardRef: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
  },
  successCardValBold: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  statusPillProcessing: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusPillTextProcessing: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
  },
  primaryActionBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryActionBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  // Review Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  breakdownBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
  },
  breakdownMonoVal: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
  },
  breakdownPrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#059669",
  },
  breakdownBalanceAfter: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  modalConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  policyItem: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  policyDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
});
