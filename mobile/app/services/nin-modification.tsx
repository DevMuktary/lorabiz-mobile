import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Phone,
  MapPin,
  Check,
  ChevronDown,
  ShieldCheck,
  FileText,
  RotateCw,
  WifiOff,
  Wallet,
  X,
  Info,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import SearchablePickerModal from "../../components/SearchablePickerModal";
import { NIGERIAN_STATES, getLgasForState } from "../../constants/nigeria-data";

export type ModificationType =
  | "CHANGE_OF_NAME"
  | "CHANGE_OF_PHONE"
  | "CHANGE_OF_ADDRESS";

interface PricingConfig {
  price: number;
  originalPrice?: number;
  hasDiscount?: boolean;
  discountBadge?: string;
  savedAmount?: number;
  isActive: boolean;
  maintenanceMsg?: string | null;
  label: string;
}

const MODIFICATION_TYPES: {
  id: ModificationType;
  title: string;
  subtitle: string;
  icon: any;
}[] = [
  {
    id: "CHANGE_OF_NAME",
    title: "Change of Name",
    subtitle: "Update first name, middle name, or surname on your NIN profile",
    icon: User,
  },
  {
    id: "CHANGE_OF_PHONE",
    title: "Change of Phone Number",
    subtitle: "Link and rebind a new mobile number to your NIN",
    icon: Phone,
  },
  {
    id: "CHANGE_OF_ADDRESS",
    title: "Change of Address",
    subtitle: "Update residential address, state, and LGA on your identity record",
    icon: MapPin,
  },
];

export default function NinModificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, wallet, refreshWallet, refreshProfile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const ninInputRef = useRef<TextInput>(null);

  // Refresh wallet balance on screen focus
  useFocusEffect(
    useCallback(() => {
      refreshWallet().catch(() => {});
    }, [refreshWallet])
  );

  // Selected Category
  const [selectedType, setSelectedType] = useState<ModificationType | null>(null);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState<boolean>(false);

  // Form Fields
  const [nin, setNin] = useState("");
  const [currentPhone, setCurrentPhone] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newMiddleName, setNewMiddleName] = useState("");
  const [currentFullName, setCurrentFullName] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedLga, setSelectedLga] = useState("");

  // Modals for State and LGA Pickers
  const [isStatePickerOpen, setIsStatePickerOpen] = useState(false);
  const [isLgaPickerOpen, setIsLgaPickerOpen] = useState(false);

  // Statutory Terms Modal & Consent
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [legalFullName, setLegalFullName] = useState("");
  const [isConsentSubmitting, setIsConsentSubmitting] = useState(false);

  // Review & Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [statutoryConsent, setStatutoryConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Policy Modal
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  // Error Banner
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Post-submission success state
  const [submittedOrder, setSubmittedOrder] = useState<{
    trackingId: string;
    reference: string;
    typeLabel: string;
    nin: string;
    amountPaid: number;
  } | null>(null);

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
  }>({
    visible: false,
    title: "",
    message: "",
  });

  // 1. Fetch live pricing and consent status from server
  const {
    data: initialData,
    isLoading: isStatusLoading,
    isError: isStatusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["ninModificationInitialData"],
    queryFn: async () => {
      const res = await api.get("/api/nin/modification");
      if (!res || !res.success) {
        throw new Error(res?.message || "Failed to load modification service");
      }
      return res;
    },
    staleTime: 60000,
    retry: 1,
  });

  const pricingMap: Record<string, PricingConfig> = initialData?.pricing || {};
  const hasConsented = Boolean(initialData?.hasConsented);
  const userFullName = initialData?.userFullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  // Dynamic pricing for the selected modification type
  const activePricing = selectedType ? pricingMap[selectedType] : null;
  const currentPrice = activePricing?.price;
  const isTypeActive = activePricing?.isActive === true;

  const walletBalance = wallet?.balance ?? user?.wallet?.balance ?? 0;

  // Sanitized field inputs
  const cleanNin = nin.replace(/\D/g, "").slice(0, 11);
  const isValidNin = cleanNin.length === 11;

  const cleanCurrentPhone = currentPhone.replace(/\D/g, "").slice(0, 11);
  const isValidCurrentPhone = cleanCurrentPhone.length === 11;

  const cleanNewPhone = newPhoneNumber.replace(/\D/g, "").slice(0, 11);
  const isValidNewPhone = cleanNewPhone.length === 11;

  // Compute LGA options for selected state
  const availableLgas = useMemo(() => {
    return getLgasForState(selectedState);
  }, [selectedState]);

  // Form validity by category
  const isFormValid = useMemo(() => {
    if (!selectedType || !isValidNin || !isTypeActive || typeof currentPrice !== "number" || currentPrice <= 0) {
      return false;
    }

    if (selectedType === "CHANGE_OF_NAME") {
      return (
        isValidCurrentPhone &&
        newFirstName.trim().length >= 2 &&
        newLastName.trim().length >= 2
      );
    }

    if (selectedType === "CHANGE_OF_PHONE") {
      return (
        currentFullName.trim().length >= 3 &&
        isValidNewPhone
      );
    }

    if (selectedType === "CHANGE_OF_ADDRESS") {
      return (
        currentFullName.trim().length >= 3 &&
        isValidCurrentPhone &&
        newAddress.trim().length >= 5 &&
        selectedState.trim().length > 0 &&
        selectedLga.trim().length > 0
      );
    }

    return false;
  }, [
    selectedType,
    isValidNin,
    isTypeActive,
    currentPrice,
    isValidCurrentPhone,
    newFirstName,
    newLastName,
    currentFullName,
    isValidNewPhone,
    newAddress,
    selectedState,
    selectedLga,
  ]);

  const canProceed = isFormValid && !isSubmitting && !isStatusLoading;

  // Handle Terms Consent Submission
  const handleAgreeTerms = async () => {
    const trimmed = legalFullName.trim();
    if (!trimmed) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Name Required",
        message: "Please enter your full legal name to sign the statutory terms.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsConsentSubmitting(true);
    try {
      const res = await api.post("/api/nin/modification/consent", {
        fullName: trimmed,
        signature: `TYPED:${trimmed}`,
      });

      setIsConsentSubmitting(false);

      if (res?.success) {
        setIsTermsModalOpen(false);
        refetchStatus();
      } else {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Submission Error",
          message: res?.message || "Failed to record consent. Please try again.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setIsConsentSubmitting(false);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Network Error",
        message: err?.message || "Unable to connect to server. Please check your connection.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  // Open confirmation modal or prompt consent / fund wallet
  const handleOpenReview = () => {
    Keyboard.dismiss();
    setErrorMessage(null);

    if (!hasConsented) {
      setLegalFullName(userFullName);
      setIsTermsModalOpen(true);
      return;
    }

    if (!selectedType) {
      setErrorMessage("Please select a modification category to proceed.");
      return;
    }

    if (!isFormValid) {
      setErrorMessage("Please complete all required fields correctly.");
      return;
    }

    if (typeof currentPrice === "number" && walletBalance < currentPrice) {
      setAlertConfig({
        visible: true,
        type: "insufficient_balance",
        title: "Insufficient Balance",
        message: `Your balance is ₦${walletBalance.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}, but this modification requires ₦${currentPrice.toLocaleString()}. Please fund your wallet.`,
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

    setStatutoryConsent(false);
    setIsConfirmModalOpen(true);
  };

  // Confirm and Submit Order
  const handleConfirmSubmit = async () => {
    if (!statutoryConsent) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Consent Required",
        message: "Please tick the statutory authorization checkbox to proceed.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        type: selectedType,
        nin: cleanNin,
      };

      if (selectedType === "CHANGE_OF_NAME") {
        payload.currentPhone = cleanCurrentPhone;
        payload.newFirstName = newFirstName.trim();
        payload.newLastName = newLastName.trim();
        payload.newMiddleName = newMiddleName.trim() || undefined;
      } else if (selectedType === "CHANGE_OF_PHONE") {
        payload.currentFullName = currentFullName.trim();
        payload.newPhoneNumber = cleanNewPhone;
      } else if (selectedType === "CHANGE_OF_ADDRESS") {
        payload.currentFullName = currentFullName.trim();
        payload.currentPhone = cleanCurrentPhone;
        payload.newAddress = newAddress.trim();
        payload.newState = selectedState.trim();
        payload.newLga = selectedLga.trim();
      }

      const res = await api.post("/api/nin/modification", payload);
      setIsSubmitting(false);

      if (res?.success) {
        setIsConfirmModalOpen(false);
        setSubmittedOrder({
          trackingId: res.trackingId,
          reference: res.reference,
          typeLabel: activePricing?.label || selectedType || "NIN Modification",
          nin: cleanNin,
          amountPaid: typeof currentPrice === "number" ? currentPrice : 0,
        });
        refreshWallet().catch(() => {});
        refreshProfile();
      } else {
        setIsConfirmModalOpen(false);
        setErrorMessage(
          res?.message || "Failed to submit modification request. Please try again."
        );
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setIsConfirmModalOpen(false);
      setErrorMessage(
        err?.message || "Unable to complete request. Please check your network connection."
      );
    }
  };

  // Reset form to submit another request
  const handleReset = () => {
    setSubmittedOrder(null);
    setNin("");
    setCurrentPhone("");
    setNewFirstName("");
    setNewLastName("");
    setNewMiddleName("");
    setCurrentFullName("");
    setNewPhoneNumber("");
    setNewAddress("");
    setSelectedState("");
    setSelectedLga("");
    setSelectedType(null);
    setIsCategoryExpanded(false);
    setErrorMessage(null);
  };

  return (
    <View style={styles.screen}>
        {/* Top Header */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NIN Modification</Text>
          <TouchableOpacity
            onPress={() => router.push("/services/nin-modification-history" as any)}
            style={styles.historyNavPill}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Clock size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.historyNavPillText}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Loading State with Transparent BrandLoader */}
        {isStatusLoading ? (
          <View style={styles.centerContainer}>
            <BrandLoader inline visible message="Loading modification services..." />
          </View>
        ) : isStatusError || !initialData ? (
          /* Full-Screen Offline / Error Retry State */
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
              onPress={() => refetchStatus()}
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
                { paddingBottom: Math.max(insets.bottom, 16) + 48 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Post-Submission Success View */}
              {submittedOrder ? (
                <View style={styles.successCard}>
                  <View style={styles.successIconWrap}>
                    <CheckCircle2 size={42} color="#10B981" />
                  </View>
                  <Text style={styles.successTitle}>Modification Request Submitted</Text>
                  <Text style={styles.successSubtitle}>
                    Your modification order has been received and queued for NIMC identity processing.
                  </Text>

                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Tracking ID:</Text>
                      <Text style={[styles.summaryValue, styles.fontMono, { color: colors.primary }]}>
                        {submittedOrder.trackingId}
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Category:</Text>
                      <Text style={styles.summaryValue}>{submittedOrder.typeLabel}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>NIN:</Text>
                      <Text style={[styles.summaryValue, styles.fontMono]}>
                        {submittedOrder.nin}
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Amount Paid:</Text>
                      <Text style={[styles.summaryValue, { color: colors.primary }]}>
                        ₦{submittedOrder.amountPaid.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Status:</Text>
                      <View style={styles.statusBadgePending}>
                        <Clock size={11} color="#D97706" style={{ marginRight: 4 }} />
                        <Text style={styles.statusBadgeTextPending}>PENDING</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.successActions}>
                    <TouchableOpacity
                      style={styles.primaryHistoryBtn}
                      onPress={() => router.push("/services/nin-modification-history" as any)}
                      activeOpacity={0.88}
                    >
                      <Clock size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryHistoryBtnText}>View in Orders & History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondarySubmitBtn}
                      onPress={handleReset}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.secondarySubmitBtnText}>Submit Another Modification</Text>
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
                      <Text style={styles.agencyBadge}>NIMC MODIFICATION SERVICE</Text>
                      <Text style={styles.agencyTitle}>NIN Modification</Text>
                      <Text style={styles.agencyDesc}>
                        Update your name, phone number, or address on the national identity database.
                      </Text>
                    </View>
                  </View>

                  {/* Policy & Timeline Pill */}
                  <TouchableOpacity
                    style={styles.policyPill}
                    onPress={() => setIsPolicyModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.policyPillLeft}>
                      <Clock size={15} color="#059669" />
                      <Text style={styles.policyPillText}>
                        Turnaround: <Text style={styles.fontBold}>1 – 48 Working Hours</Text>
                      </Text>
                    </View>
                    <View style={styles.policyPillRight}>
                      <Text style={styles.policyPillAction}>Policy ⓘ</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Error Banner */}
                  {errorMessage ? (
                    <View style={styles.errorBox}>
                      <AlertCircle size={18} color={colors.error} style={{ marginRight: 8 }} />
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* Step 1: 11-Digit Target NIN Number */}
                  <View style={styles.inputCard}>
                    <View style={styles.inputLabelRow}>
                      <Text style={styles.inputLabel}>1. 11-Digit NIN Number</Text>
                      <Text style={styles.inputCounter}>{cleanNin.length}/11</Text>
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
                        value={nin}
                        onChangeText={(val) => {
                          setNin(val.replace(/\D/g, "").slice(0, 11));
                          if (errorMessage) setErrorMessage(null);
                        }}
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

                  {/* Step 2: Select Modification Service */}
                  <View style={styles.formatSection}>
                    <View style={styles.formatHeaderRow}>
                      <Text style={styles.sectionLabel}>2. Select Modification Service</Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {selectedType && isCategoryExpanded && (
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

                    {selectedType && !isCategoryExpanded ? (
                      /* Compact Collapsed Card When Selected */
                      <TouchableOpacity
                        style={styles.selectedCategoryBox}
                        onPress={() => setIsCategoryExpanded(true)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                          <View style={styles.selectedCatIconWrap}>
                            {(() => {
                              const SelectedIcon = MODIFICATION_TYPES.find((c) => c.id === selectedType)?.icon || User;
                              return <SelectedIcon size={18} color={colors.primary} />;
                            })()}
                          </View>
                          <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.selectedCatTitle}>
                              {activePricing?.label || MODIFICATION_TYPES.find((c) => c.id === selectedType)?.title}
                            </Text>
                            <Text style={styles.selectedCatDesc} numberOfLines={1}>
                              {MODIFICATION_TYPES.find((c) => c.id === selectedType)?.subtitle}
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                          {typeof currentPrice === "number" && (
                            <Text style={styles.selectedCatPrice}>
                              ₦{currentPrice.toLocaleString()}
                            </Text>
                          )}
                          <View style={styles.selectedCatPill}>
                            <Text style={styles.selectedCatPillText}>Change ▾</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.formatsList}>
                        {MODIFICATION_TYPES.map((cat) => {
                          const isSelected = selectedType === cat.id;
                          const pInfo = pricingMap[cat.id];
                          const price = pInfo?.price;
                          const isActive = pInfo?.isActive === true;
                          const IconComp = cat.icon;

                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.formatCard,
                                isSelected && styles.formatCardSelected,
                                !isActive && styles.formatCardDisabled,
                              ]}
                              onPress={() => {
                                if (isActive) {
                                  setSelectedType(cat.id);
                                  setIsCategoryExpanded(false);
                                  if (errorMessage) setErrorMessage(null);
                                }
                              }}
                              disabled={!isActive}
                              activeOpacity={0.75}
                            >
                              <View style={styles.formatCardLeft}>
                                <View
                                  style={[
                                    styles.radioCircle,
                                    isSelected && styles.radioCircleSelected,
                                    !isActive && styles.radioCircleDisabled,
                                  ]}
                                >
                                  {isSelected ? <View style={styles.radioDot} /> : null}
                                </View>

                                <View style={styles.formatInfo}>
                                  <View style={styles.formatTitleRow}>
                                    <IconComp
                                      size={16}
                                      color={isSelected ? colors.primary : colors.textSecondary}
                                      style={{ marginRight: 6 }}
                                    />
                                    <Text
                                      style={[
                                        styles.formatTitle,
                                        isSelected && styles.formatTitleSelected,
                                        !isActive && { color: colors.textMuted },
                                      ]}
                                    >
                                      {cat.title}
                                    </Text>
                                  </View>
                                  <Text style={styles.formatDesc}>{cat.subtitle}</Text>
                                  {!isActive && (
                                    <Text style={styles.unavailableText}>
                                      {pInfo?.maintenanceMsg || "Temporarily Unavailable"}
                                    </Text>
                                  )}
                                </View>
                              </View>

                              <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                                {isActive && typeof price === "number" ? (
                                  <Text
                                    style={[
                                      styles.formatPrice,
                                      isSelected && styles.formatPriceSelected,
                                    ]}
                                  >
                                    ₦{price.toLocaleString()}
                                  </Text>
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

                  {/* Step 3: Record Details & Changes */}
                  {selectedType ? (
                    <View style={styles.sectionWrap}>
                      <Text style={styles.sectionTitle}>3. Record Details & Changes</Text>

                      {/* Fields for CHANGE_OF_NAME */}
                      {selectedType === "CHANGE_OF_NAME" ? (
                        <>
                          <View style={styles.fieldGroup}>
                            <View style={styles.fieldLabelRow}>
                              <Text style={styles.fieldLabel}>Currently Linked Mobile Number</Text>
                              <Text style={styles.fieldCounter}>{cleanCurrentPhone.length}/11</Text>
                            </View>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                keyboardType="phone-pad"
                                maxLength={11}
                                value={currentPhone}
                                onChangeText={(val) => setCurrentPhone(val.replace(/\D/g, "").slice(0, 11))}
                                placeholder="e.g. 08012345678"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                              {isValidCurrentPhone ? (
                                <CheckCircle2 size={18} color={colors.success} style={{ marginLeft: 6 }} />
                              ) : null}
                            </View>
                            <Text style={styles.helperText}>The phone number registered on this NIN.</Text>
                          </View>

                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>New First Name</Text>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                autoCapitalize="words"
                                value={newFirstName}
                                onChangeText={setNewFirstName}
                                placeholder="Enter updated first name"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                            </View>
                          </View>

                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>New Surname (Last Name)</Text>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                autoCapitalize="words"
                                value={newLastName}
                                onChangeText={setNewLastName}
                                placeholder="Enter updated surname"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                            </View>
                          </View>

                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>New Middle Name (Optional)</Text>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                autoCapitalize="words"
                                value={newMiddleName}
                                onChangeText={setNewMiddleName}
                                placeholder="Enter middle name (if applicable)"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                            </View>
                          </View>
                        </>
                      ) : null}

                      {/* Fields for CHANGE_OF_PHONE */}
                      {selectedType === "CHANGE_OF_PHONE" ? (
                        <>
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Current Full Name on NIN</Text>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                autoCapitalize="words"
                                value={currentFullName}
                                onChangeText={setCurrentFullName}
                                placeholder="e.g. John Ibrahim Okafor"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                            </View>
                            <Text style={styles.helperText}>Enter full name exactly as registered on NIMC record.</Text>
                          </View>

                          <View style={styles.fieldGroup}>
                            <View style={styles.fieldLabelRow}>
                              <Text style={styles.fieldLabel}>New 11-Digit Mobile Number to Link</Text>
                              <Text style={styles.fieldCounter}>{cleanNewPhone.length}/11</Text>
                            </View>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                keyboardType="phone-pad"
                                maxLength={11}
                                value={newPhoneNumber}
                                onChangeText={(val) => setNewPhoneNumber(val.replace(/\D/g, "").slice(0, 11))}
                                placeholder="e.g. 08098765432"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                              {isValidNewPhone ? (
                                <CheckCircle2 size={18} color={colors.success} style={{ marginLeft: 6 }} />
                              ) : null}
                            </View>
                          </View>
                        </>
                      ) : null}

                      {/* Fields for CHANGE_OF_ADDRESS */}
                      {selectedType === "CHANGE_OF_ADDRESS" ? (
                        <>
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Current Full Name on NIN</Text>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                autoCapitalize="words"
                                value={currentFullName}
                                onChangeText={setCurrentFullName}
                                placeholder="Enter full registered name"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                            </View>
                          </View>

                          <View style={styles.fieldGroup}>
                            <View style={styles.fieldLabelRow}>
                              <Text style={styles.fieldLabel}>Currently Linked Mobile Number</Text>
                              <Text style={styles.fieldCounter}>{cleanCurrentPhone.length}/11</Text>
                            </View>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.inputField}
                                keyboardType="phone-pad"
                                maxLength={11}
                                value={currentPhone}
                                onChangeText={(val) => setCurrentPhone(val.replace(/\D/g, "").slice(0, 11))}
                                placeholder="e.g. 08012345678"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                              {isValidCurrentPhone ? (
                                <CheckCircle2 size={18} color={colors.success} style={{ marginLeft: 6 }} />
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>New Street / Residential Address</Text>
                            <View style={[styles.inputBox, { height: 74, alignItems: "flex-start", paddingTop: 8 }]}>
                              <TextInput
                                style={[styles.inputField, { height: "100%", textAlignVertical: "top" }]}
                                multiline
                                numberOfLines={3}
                                value={newAddress}
                                onChangeText={setNewAddress}
                                placeholder="Enter full street address and house number"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                              />
                            </View>
                          </View>

                          {/* State Picker */}
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>State of Residence</Text>
                            <TouchableOpacity
                              style={styles.pickerBox}
                              onPress={() => setIsStatePickerOpen(true)}
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.pickerValue,
                                  !selectedState && { color: colors.textMuted },
                                ]}
                              >
                                {selectedState || "Select Nigerian State"}
                              </Text>
                              <ChevronDown size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>

                          {/* LGA Picker */}
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Local Government Area (LGA)</Text>
                            <TouchableOpacity
                              style={[
                                styles.pickerBox,
                                !selectedState && { opacity: 0.6 },
                              ]}
                              onPress={() => {
                                if (selectedState) {
                                  setIsLgaPickerOpen(true);
                                } else {
                                  setErrorMessage("Please select a State first.");
                                }
                              }}
                              disabled={!selectedState}
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.pickerValue,
                                  !selectedLga && { color: colors.textMuted },
                                ]}
                              >
                                {selectedLga || (selectedState ? "Select LGA" : "Choose State first")}
                              </Text>
                              <ChevronDown size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Proceed / Review Button */}
                  <TouchableOpacity
                    style={[styles.submitBtn, !canProceed && styles.submitBtnDisabled]}
                    onPress={handleOpenReview}
                    disabled={!canProceed}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.submitBtnText}>
                      {typeof currentPrice === "number" && currentPrice > 0
                        ? `Review & Submit Request (₦${currentPrice.toLocaleString()})`
                        : "Review & Submit Request"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}


        {/* State Selection Modal */}
        <SearchablePickerModal
          visible={isStatePickerOpen}
          title="Select State"
          items={NIGERIAN_STATES}
          selectedValue={selectedState}
          onSelect={(state) => {
            setSelectedState(state);
            setSelectedLga("");
            setIsStatePickerOpen(false);
          }}
          onClose={() => setIsStatePickerOpen(false)}
        />

        {/* LGA Selection Modal */}
        <SearchablePickerModal
          visible={isLgaPickerOpen}
          title={`Select LGA (${selectedState})`}
          items={availableLgas}
          selectedValue={selectedLga}
          onSelect={(lga) => {
            setSelectedLga(lga);
            setIsLgaPickerOpen(false);
          }}
          onClose={() => setIsLgaPickerOpen(false)}
        />

        {/* Statutory Terms & Agreement Modal */}
        <Modal
          visible={isTermsModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsTermsModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ShieldCheck size={20} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.modalTitle}>Statutory Agreement & Terms</Text>
                </View>
                <TouchableOpacity onPress={() => setIsTermsModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.termsScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.termsParagraph}>
                  In accordance with the National Identity Management Commission (NIMC) Act No. 23 of 2007 and the Nigeria Data Protection Act (NDPA) 2023, you must confirm your legal authorization before submitting a modification request.
                </Text>

                <View style={styles.termsClauseBox}>
                  <Text style={styles.termsClauseTitle}>Legal Attestation</Text>
                  <Text style={styles.termsClauseText}>
                    1. I attest that all particulars provided for this identity modification are authentic, lawful, and belong to the legitimate record holder.
                  </Text>
                  <Text style={styles.termsClauseText}>
                    2. I understand that fraudulent modifications or impersonation attract statutory criminal prosecution under federal law.
                  </Text>
                  <Text style={styles.termsClauseText}>
                    3. I authorize LoraBiz and licensed identity partners to route this modification update through the National Identity Database.
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Legal Name (Digital Signature)</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.inputField}
                      autoCapitalize="words"
                      value={legalFullName}
                      onChangeText={setLegalFullName}
                      placeholder="Type your full legal name"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <Text style={styles.helperText}>Typing your legal name constitutes a legally binding signature.</Text>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsTermsModalOpen(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalConfirmBtn, isConsentSubmitting && { opacity: 0.6 }]}
                  onPress={handleAgreeTerms}
                  disabled={isConsentSubmitting}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalConfirmBtnText}>
                    {isConsentSubmitting ? "Signing..." : "Agree & Accept"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Order Review & Confirmation Modal */}
        <Modal
          visible={isConfirmModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsConfirmModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Modification Order</Text>
                <TouchableOpacity onPress={() => setIsConfirmModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Service Category:</Text>
                  <Text style={styles.modalValue}>{activePricing?.label || selectedType}</Text>
                </View>
                <View style={styles.modalDivider} />
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Target NIN:</Text>
                  <Text style={[styles.modalValue, styles.fontMono]}>{cleanNin}</Text>
                </View>
                <View style={styles.modalDivider} />
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Modification Fee:</Text>
                  <Text style={[styles.modalValue, styles.modalPriceText]}>
                    ₦{Number(currentPrice || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.modalDivider} />
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Available Balance:</Text>
                  <Text style={styles.modalValue}>
                    ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.modalDivider} />
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Balance After Deduction:</Text>
                  <Text style={[styles.modalValue, { color: colors.success }]}>
                    ₦{Math.max(0, walletBalance - (currentPrice || 0)).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Consent Checkbox */}
                <TouchableOpacity
                  style={styles.reviewConsentRow}
                  onPress={() => setStatutoryConsent(!statutoryConsent)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkboxBox, statutoryConsent && styles.checkboxBoxChecked]}>
                    {statutoryConsent ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <Text style={styles.reviewConsentText}>
                    I confirm that the modification details submitted are accurate, and I authorize deduction from my wallet.
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsConfirmModalOpen(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    (!statutoryConsent || isSubmitting) && styles.modalConfirmBtnDisabled,
                  ]}
                  onPress={handleConfirmSubmit}
                  disabled={!statutoryConsent || isSubmitting}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalConfirmBtnText}>
                    {isSubmitting ? "Processing..." : "Confirm & Pay"}
                  </Text>
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
                    <Text style={styles.modalTitle}>NIMC Modification Policy</Text>
                    <Text style={styles.modalSub}>Turnaround and processing guidelines</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setIsPolicyModalOpen(false)}>
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 12, marginTop: 6 }}>
                <View style={styles.policyItem}>
                  <Text style={styles.policyTitle}>1. Expected Turnaround (1 – 48 Working Hours)</Text>
                  <Text style={styles.policyDesc}>
                    NIN modification requests are processed within 1 to 48 working hours (excluding weekends and public holidays). You can track your status in Modification History.
                  </Text>
                </View>

                <View style={styles.policyItem}>
                  <Text style={styles.policyTitle}>2. Service Fees & Refund Policy</Text>
                  <Text style={styles.policyDesc}>
                    All service fees are non-refundable once work commences. If a request fails due to a verified administrative error, funds are credited back to your wallet.
                  </Text>
                </View>

                <View style={styles.policyItem}>
                  <Text style={styles.policyTitle}>3. Third-Party Propagation</Text>
                  <Text style={styles.policyDesc}>
                    Downstream data synchronization across banks and telecom networks follows their respective system refresh intervals once updated on the identity database.
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

        {/* Custom Branded Alert Modal */}
        <CustomAlertModal {...alertConfig} />
      </View>
  );
}

const styles = StyleSheet.create({
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
  fontBold: {
    fontWeight: "700",
  },
  modalHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
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
  primaryActionBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
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
    padding: 6,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: colors.text,
  },
  historyNavPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  historyNavPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },

  /* Error Banner */
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.error,
    lineHeight: 18,
  },

  /* Section Styling */
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },
  walletBalanceChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(200, 45, 117, 0.07)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  walletBalanceChipText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.primary,
  },
  collapsePill: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  collapsePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },

  /* Compact Collapsed Selected Category Box */
  selectedCategoryBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 13,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
  /* Input Card */
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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

  /* Formats List */
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
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
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

  /* Field Form Styling */
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  fieldCounter: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    paddingHorizontal: 12,
    height: 48,
  },
  inputField: {
    flex: 1,
    height: "100%",
    fontSize: 13.5,
    color: colors.text,
    paddingVertical: 0,
  },
  helperText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  pickerBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    paddingHorizontal: 14,
    height: 48,
  },
  pickerValue: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.text,
  },

  /* Submit Button */
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 14.5,
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
  statusBadgePending: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeTextPending: {
    fontSize: 11,
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

  /* Modals */
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
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: Dimensions.get("window").height * 0.88,
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
  reviewConsentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  reviewConsentText: {
    flex: 1,
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
    marginLeft: 8,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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

  /* Terms Scroll */
  termsScroll: {
    maxHeight: 340,
    marginBottom: 16,
  },
  termsParagraph: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  termsClauseBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    marginBottom: 14,
  },
  termsClauseTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  termsClauseText: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },

  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
