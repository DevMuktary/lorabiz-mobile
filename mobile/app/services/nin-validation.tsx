import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  QrCode,
  RotateCw,
  Camera,
  Gift,
  X,
  Wallet,
  ArrowRight,
  WifiOff,
  Info,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

interface CategoryPricing {
  price: number;
  originalPrice?: number;
  hasDiscount?: boolean;
  discountBadge?: string;
  savedAmount?: number;
  isActive: boolean;
  maintenanceMsg?: string | null;
}

const CATEGORIES = [
  {
    id: "NO_RECORD_FOUND",
    label: "No Record Found",
    desc: "Resolves NIN records not appearing on NIMC verification portals",
    icon: Search,
  },
  {
    id: "VNIN_VALIDATION",
    label: "SIM/Bank & VNIN Validation",
    desc: "Synchronizes NIN with telecom operators and commercial bank KYC",
    icon: QrCode,
  },
  {
    id: "UPDATE_RECORD_MOD",
    label: "Modification Validation",
    desc: "Reflects recent name, date of birth, or biometric modifications",
    icon: RotateCw,
  },
  {
    id: "PHOTO_ERROR",
    label: "Photographic Error",
    desc: "Resolves missing photo or image transmission mismatch errors",
    icon: Camera,
  },
];

export default function NinValidationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const ninInputRef = useRef<TextInput>(null);

  // Pricing & live database state (STRICTLY loaded from DB - zero hardcoding / zero static fallbacks)
  const [pricing, setPricing] = useState<Record<string, CategoryPricing> | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [availablePasses, setAvailablePasses] = useState<number>(0);
  const [useRewardCredit, setUseRewardCredit] = useState<boolean>(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  // Form input state - NO auto-selection on initial load (starts empty)
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isCategoryExpanded, setIsCategoryExpanded] = useState<boolean>(false);
  const [nin, setNin] = useState<string>("");
  const [attestationsAccepted, setAttestationsAccepted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Policy Details Modal State (Option A)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);

  // Success result state
  const [submittedResult, setSubmittedResult] = useState<{
    reference: string;
    category: string;
    nin: string;
    amount: number;
  } | null>(null);

  // Alert Modal
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

  const sanitizedNin = nin.replace(/\D/g, "").slice(0, 11);
  const isValidNin = sanitizedNin.length === 11;

  // Load live pricing and user data directly from DB
  const loadInitialData = async () => {
    setIsLoadingInitial(true);
    setInitialError(null);
    try {
      const data = await api.get("/api/nin/validation");
      if (data && data.success) {
        setWalletBalance(data.walletBalance || 0);
        if (data.pricing) {
          setPricing(data.pricing);
        }
        const passes = Number(data.freePassCount || 0);
        setAvailablePasses(passes);
        if (passes > 0) setUseRewardCredit(true);
      } else {
        setInitialError(data?.message || "Failed to load validation pricing from server.");
      }
    } catch (err: any) {
      setInitialError(err?.message || "Unable to connect to server. Please check your network.");
    } finally {
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const currentCategoryConfig = CATEGORIES.find((c) => c.id === selectedCategory) || null;
  const currentPricing = selectedCategory && pricing ? pricing[selectedCategory] : null;
  const isCategoryActive = currentPricing?.isActive ?? false;
  const categoryPrice = currentPricing?.price;

  const isPassApplied = Boolean(useRewardCredit && availablePasses > 0);
  const effectivePrice = isPassApplied ? 0 : (categoryPrice ?? 0);
  const canSubmit =
    Boolean(selectedCategory) &&
    isValidNin &&
    attestationsAccepted &&
    isCategoryActive &&
    categoryPrice !== undefined &&
    !isLoadingInitial;

  const handleOpenConfirm = () => {
    if (!selectedCategory) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Select Category",
        message: "Please choose a validation category to proceed.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (!isValidNin) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Invalid NIN",
        message: "Please enter a valid 11-digit National Identification Number.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (!attestationsAccepted) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Consent Required",
        message: "Please accept the NDPA 2023 authorization checkbox to proceed.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (!isPassApplied && walletBalance < (categoryPrice ?? 0)) {
      setAlertConfig({
        visible: true,
        type: "insufficient_balance",
        title: "Insufficient Balance",
        message: `Your balance is ₦${walletBalance.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}, but this validation requires ₦${(categoryPrice ?? 0).toLocaleString()}. Please fund your wallet.`,
        confirmText: "Fund Wallet",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.push("/wallet/fund" as any);
        },
      });
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data = await api.post("/api/nin/validation", {
        category: selectedCategory,
        nin: sanitizedNin,
        attestationsAccepted,
        useRewardCredit: isPassApplied,
      });

      if (data && data.success) {
        setIsConfirmModalOpen(false);
        setSubmittedResult({
          reference: data.reference,
          category: currentCategoryConfig?.label || selectedCategory,
          nin: sanitizedNin,
          amount: effectivePrice,
        });
        // Refresh balance in background
        loadInitialData();
      } else {
        setIsConfirmModalOpen(false);
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Submission Failed",
          message: data?.message || "Failed to submit NIN validation request.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setIsConfirmModalOpen(false);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Submission Error",
        message: err?.message || "A network error occurred while submitting. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Stagnant Fixed Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>NIN Validation</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/nin-validation-history" as any)}
          style={styles.historyBtn}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Clock size={13} color="#0284C7" style={{ marginRight: 4 }} />
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Central Loading State with 100% Transparent BrandLoader */}
      {isLoadingInitial ? (
        <View style={styles.centerContainer}>
          <BrandLoader inline visible message="Loading validation..." />
        </View>
      ) : initialError ? (
        /* Dedicated Full-Screen No Internet / Offline View */
        <View style={styles.centerContainer}>
          <View style={styles.offlineIconBox}>
            <WifiOff size={38} color="#94A3B8" />
          </View>
          <Text style={styles.offlineTitle}>No Internet Connection</Text>
          <Text style={styles.offlineSubtitle}>
            Unable to connect to LoraBiz servers. Please check your mobile data or Wi-Fi connection and try again.
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
            { paddingBottom: Math.max(insets.bottom, 16) + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
              {/* Post-Submission Success State */}
              {submittedResult ? (
                <View style={styles.successCard}>
                  <View style={styles.successIconWrap}>
                    <CheckCircle2 size={40} color="#10B981" />
                  </View>
                  <Text style={styles.successTitle}>Validation Request Submitted</Text>
                  <Text style={styles.successSubtitle}>
                    Your validation request has been received and queued with the National Identity Management Commission.
                  </Text>

                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Category:</Text>
                      <Text style={styles.summaryValue}>{submittedResult.category}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Submitted NIN:</Text>
                      <Text style={[styles.summaryValue, styles.fontMono]}>
                        {submittedResult.nin}
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Reference:</Text>
                      <Text style={[styles.summaryValue, styles.fontMono]}>
                        {submittedResult.reference}
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Status:</Text>
                      <View style={styles.statusBadgeProcessing}>
                        <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
                        <Text style={styles.statusBadgeTextProcessing}>In Processing</Text>
                      </View>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Processing Time:</Text>
                      <Text style={styles.summaryValue}>24–48 Business Hours</Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.successActions}>
                    <TouchableOpacity
                      style={styles.primaryHistoryBtn}
                      onPress={() => {
                        setSubmittedResult(null);
                        router.push("/services/nin-validation-history" as any);
                      }}
                      activeOpacity={0.88}
                    >
                      <Clock size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryHistoryBtnText}>Track in History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondarySubmitBtn}
                      onPress={() => {
                        setSubmittedResult(null);
                        setNin("");
                        setSelectedCategory("");
                        setIsCategoryExpanded(false);
                        setAttestationsAccepted(false);
                        loadInitialData();
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondarySubmitBtnText}>Submit Another Validation</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {/* National Identity Banner */}
                  <View style={styles.agencyBanner}>
                    <Image
                      source={require("../../assets/nimc.png")}
                      style={styles.agencyLogo}
                      resizeMode="contain"
                    />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.agencyBadge}>NIMC RECORD SYNCHRONIZATION</Text>
                      <Text style={styles.agencyTitle}>National Identity Validation</Text>
                      <Text style={styles.agencyDesc}>
                        Validate no-record errors, VNIN synchronization, and modification updates.
                      </Text>
                    </View>
                  </View>

                  {/* Option A: Sleek Compact Policy Pill (Replaces Bulky Card) */}
                  <TouchableOpacity
                    style={styles.policyPillBanner}
                    onPress={() => setIsPolicyModalOpen(true)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.policyPillLeft}>
                      <Clock size={14} color="#0284C7" style={{ marginRight: 7 }} />
                      <Text style={styles.policyPillText}>
                        24–48 Business Hours · <Text style={styles.policyPillHighlight}>Non-Refundable</Text>
                      </Text>
                    </View>
                    <View style={styles.policyPillRight}>
                      <Text style={styles.policyPillAction}>Policy Details ›</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Free Pass Reward Banner */}
                  {availablePasses > 0 && (
                    <View style={styles.voucherCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <View style={styles.voucherIconBox}>
                          <Gift size={18} color="#059669" />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={styles.voucherTitle}>
                            {availablePasses} Free Pass{availablePasses > 1 ? "es" : ""} Available
                          </Text>
                          <Text style={styles.voucherDesc}>
                            {useRewardCredit ? "Pass applied · Fee slashed to ₦0.00" : "Toggle switch to apply pass"}
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

                  {/* Step 1: 11-Digit National Identification Number (NIN) */}
                  <View style={styles.inputCard}>
                    <View style={styles.inputLabelRow}>
                      <Text style={styles.inputLabel}>1. 11-Digit NIN Number</Text>
                      <Text style={styles.inputCounter}>{sanitizedNin.length}/11</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.inputWrap}
                      activeOpacity={1}
                      onPress={() => ninInputRef.current?.focus()}
                    >
                      <TextInput
                        ref={ninInputRef}
                        style={styles.textInput}
                        keyboardType="number-pad"
                        maxLength={11}
                        value={sanitizedNin}
                        onChangeText={(text) => setNin(text.replace(/\D/g, "").slice(0, 11))}
                        placeholder="Enter 11-digit NIN"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      {isValidNin ? (
                        <CheckCircle2 size={20} color={colors.success} style={{ marginLeft: 8 }} />
                      ) : null}
                    </TouchableOpacity>
                  </View>

                  {/* Step 2: Select Validation Category */}
                  <View style={styles.formatSection}>
                    <View style={styles.formatHeaderRow}>
                      <Text style={styles.sectionLabel}>2. Select Validation Category</Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {selectedCategory && isCategoryExpanded && (
                          <TouchableOpacity
                            onPress={() => setIsCategoryExpanded(false)}
                            style={styles.collapsePill}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={styles.collapsePillText}>Collapse ▴</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.walletBalanceChip}
                          onPress={() => router.push("/wallet/fund" as any)}
                          activeOpacity={0.7}
                        >
                          <Wallet size={12} color={colors.primaryLight} style={{ marginRight: 5 }} />
                          <Text style={styles.walletBalanceChipText}>
                            ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {selectedCategory && !isCategoryExpanded ? (
                      /* Compact Collapsed Card When Selected */
                      currentCategoryConfig && (
                        <TouchableOpacity
                          style={styles.selectedCategoryBox}
                          onPress={() => setIsCategoryExpanded(true)}
                          activeOpacity={0.8}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <View style={styles.selectedCatIconWrap}>
                              <currentCategoryConfig.icon
                                size={18}
                                color={colors.primary}
                              />
                            </View>
                            <View style={{ marginLeft: 12, flex: 1 }}>
                              <Text style={styles.selectedCatTitle}>
                                {currentCategoryConfig.label}
                              </Text>
                              <Text style={styles.selectedCatDesc} numberOfLines={1}>
                                {currentCategoryConfig.desc}
                              </Text>
                            </View>
                          </View>

                          <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                            {categoryPrice !== undefined && (
                              <Text style={styles.selectedCatPrice}>
                                {isPassApplied ? "₦0.00 Free" : `₦${categoryPrice.toLocaleString()}`}
                              </Text>
                            )}
                            <View style={styles.selectedCatPill}>
                              <Text style={styles.selectedCatPillText}>Change ▾</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      )
                    ) : (
                      <View style={styles.formatsList}>
                        {CATEGORIES.map((cat) => {
                          const isSelected = selectedCategory === cat.id;
                          const catPricing = pricing ? pricing[cat.id] : null;
                          const catPrice = catPricing?.price;
                          const isAvailable = catPricing?.isActive ?? false;
                          const IconComponent = cat.icon;

                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.formatCard,
                                isSelected && styles.formatCardSelected,
                                !isAvailable && styles.formatCardDisabled,
                              ]}
                              onPress={() => {
                                if (isAvailable) {
                                  setSelectedCategory(cat.id);
                                  setIsCategoryExpanded(false);
                                }
                              }}
                              disabled={!isAvailable}
                              activeOpacity={0.75}
                            >
                              <View style={styles.formatCardLeft}>
                                <View
                                  style={[
                                    styles.radioCircle,
                                    isSelected && styles.radioCircleSelected,
                                    !isAvailable && styles.radioCircleDisabled,
                                  ]}
                                >
                                  {isSelected ? <View style={styles.radioDot} /> : null}
                                </View>

                                <View style={styles.formatInfo}>
                                  <View style={styles.formatTitleRow}>
                                    <IconComponent
                                      size={16}
                                      color={isSelected ? colors.primary : colors.textSecondary}
                                      style={{ marginRight: 6 }}
                                    />
                                    <Text
                                      style={[
                                        styles.formatTitle,
                                        isSelected && styles.formatTitleSelected,
                                        !isAvailable && { color: colors.textMuted },
                                      ]}
                                    >
                                      {cat.label}
                                    </Text>
                                  </View>
                                  <Text style={styles.formatDesc}>{cat.desc}</Text>
                                  {!isAvailable && (
                                    <Text style={styles.unavailableText}>
                                      {catPricing?.maintenanceMsg || "Temporarily Unavailable"}
                                    </Text>
                                  )}
                                </View>
                              </View>

                              <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                                {isAvailable && catPrice !== undefined ? (
                                  isPassApplied ? (
                                    <View style={{ alignItems: "flex-end" }}>
                                      <Text style={styles.priceStrikethrough}>
                                        ₦{catPrice.toLocaleString()}
                                      </Text>
                                      <Text style={styles.priceFreeText}>₦0.00 Free</Text>
                                    </View>
                                  ) : (
                                    <Text
                                      style={[
                                        styles.formatPrice,
                                        isSelected && styles.formatPriceSelected,
                                      ]}
                                    >
                                      ₦{catPrice.toLocaleString()}
                                    </Text>
                                  )
                                ) : (
                                  <View style={styles.disabledBadge}>
                                    <Text style={styles.disabledBadgeText}>Off</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
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
                        I confirm that I am the applicant or hold lawful authorization from the data subject to process this validation in accordance with the <Text style={styles.fontBold}>Nigeria Data Protection Act (NDPA) 2023</Text> and LoraBiz Terms.
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Submit CTA Button */}
                  <TouchableOpacity
                    style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                    onPress={handleOpenConfirm}
                    disabled={!canSubmit}
                    activeOpacity={0.85}
                  >
                    <ShieldCheck size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>
                      {!selectedCategory
                        ? "Select Category to Continue"
                        : isPassApplied
                        ? "Submit Validation (₦0.00 Free)"
                        : categoryPrice !== undefined
                        ? `Submit Validation (₦${categoryPrice.toLocaleString()})`
                        : "Submit Validation"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
      )}

      {/* Option A: Dedicated Policy & Timeline Bottom Sheet Modal */}
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
                <Clock size={20} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Processing Time & Policy</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsPolicyModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Timeline Section */}
              <View style={styles.policySectionCard}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Clock size={16} color="#0284C7" style={{ marginRight: 6 }} />
                  <Text style={styles.policySectionTitle}>Estimated Processing Time</Text>
                </View>
                <Text style={styles.policySectionBody}>
                  Standard verification takes <Text style={styles.fontBold}>24 to 48 Business Hours (1 to 2 Working Days)</Text>. Depending on telecom networks and commercial bank systems, reflection across external portals may take up to 72 business hours.
                </Text>
              </View>

              {/* Non-Refundable Policy Section (Without the word "strict") */}
              <View style={[styles.policySectionCard, { borderColor: "#FECACA", backgroundColor: "#FEF2F2" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <AlertCircle size={16} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={[styles.policySectionTitle, { color: "#DC2626" }]}>Non-Refundable Policy</Text>
                </View>
                <Text style={[styles.policySectionBody, { color: "#991B1B" }]}>
                  Please ensure that the NIN submitted genuinely requires synchronization. Once submitted and transmitted to the national identity gateway, validation services are <Text style={styles.fontBold}>non-refundable</Text>.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.policyModalCloseBtn}
              onPress={() => setIsPolicyModalOpen(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.policyModalCloseBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmation Bottom Modal */}
      <Modal
        visible={isConfirmModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmitting) setIsConfirmModalOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ShieldCheck size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Confirm NIN Validation</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Category:</Text>
                <Text style={styles.modalValue}>{currentCategoryConfig?.label || selectedCategory}</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>NIN:</Text>
                <Text style={[styles.modalValue, styles.fontMono]}>{sanitizedNin}</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Processing Time:</Text>
                <Text style={styles.modalValue}>24–48 Business Hours</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Total Cost:</Text>
                <Text style={[styles.modalValue, styles.modalPriceText]}>
                  {isPassApplied
                    ? "₦0.00 Free (Pass Applied)"
                    : `₦${(categoryPrice ?? 0).toLocaleString()}`}
                </Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Wallet Balance:</Text>
                <Text style={styles.modalValue}>
                  ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Non-Refundable Reminder (Without the word "strict") */}
              <View style={styles.modalPolicyBox}>
                <AlertCircle size={15} color="#B91C1C" style={{ marginRight: 7 }} />
                <Text style={styles.modalPolicyText}>
                  Non-refundable service: Please verify the NIN has genuine synchronization issues before confirming.
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
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
                  <>
                    <Text style={styles.modalConfirmBtnText}>Confirm & Pay</Text>
                    <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Alert / Prompt Modal */}
      <CustomAlertModal {...alertConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  /* Fixed Stagnant Top Bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 17.5,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2, 132, 199, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.2)",
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },

  /* Scrollable Container */
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },

  /* Agency Banner */
  agencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
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
    marginTop: 2,
    lineHeight: 16,
  },

  /* Option A: Compact Policy Pill Banner */
  policyPillBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  policyPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  policyPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369A1",
  },
  policyPillHighlight: {
    fontWeight: "700",
    color: "#0284C7",
  },
  policyPillRight: {
    marginLeft: 8,
  },
  policyPillAction: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0284C7",
  },

  /* Policy Modal Details */
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
  },
  policyModalCloseBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  policyModalCloseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Voucher Card */
  voucherCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  voucherIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(5, 150, 105, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  voucherTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#065F46",
  },
  voucherDesc: {
    fontSize: 11.5,
    color: "#047857",
    marginTop: 1,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#D1D5DB",
    padding: 2,
    justifyContent: "center",
  },
  switchTrackActive: {
    backgroundColor: "#059669",
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },

  /* Step 1: Input Card */
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
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
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  /* Step 2: Formats / Categories Section */
  formatSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formatHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  collapsePill: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  collapsePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  walletBalanceChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.2)",
  },
  walletBalanceChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryLight,
  },
  selectedCategoryBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  selectedCatIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCatTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  selectedCatDesc: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedCatPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 3,
  },
  selectedCatPill: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  selectedCatPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  formatsList: {
    gap: 10,
  },
  formatCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  formatCardSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.02)",
  },
  formatCardDisabled: {
    opacity: 0.5,
  },
  formatCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioCircleDisabled: {
    borderColor: "#E2E8F0",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  formatInfo: {
    flex: 1,
  },
  formatTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  formatTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  formatTitleSelected: {
    color: colors.primary,
  },
  formatDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  unavailableText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.error,
    marginTop: 3,
  },
  formatPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  formatPriceSelected: {
    color: colors.primary,
  },
  priceStrikethrough: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  priceFreeText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#059669",
  },
  disabledBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  disabledBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },

  /* Step 3: Statutory NDPA Attestation */
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

  /* Submit Button */
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

  /* Centered States */
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
    lineHeight: 18,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Post-Submission Success State */
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  successIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 17.5,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  summaryBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 15,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
  },
  statusBadgeProcessing: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeTextProcessing: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#D97706",
  },
  successActions: {
    width: "100%",
    marginTop: 18,
    gap: 9,
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
    fontWeight: "800",
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

  /* Confirmation Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: colors.text,
  },
  modalBody: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginVertical: 4,
  },
  modalLabel: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  modalValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  modalPriceText: {
    color: colors.primary,
    fontWeight: "800",
  },
  modalPolicyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 11,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  modalPolicyText: {
    flex: 1,
    fontSize: 11.5,
    color: "#B91C1C",
    lineHeight: 15,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingVertical: 14,
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  modalConfirmBtnDisabled: {
    opacity: 0.6,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  fontBold: {
    fontWeight: "800",
  },
  fontMono: {
    fontFamily: "monospace",
  },
});
