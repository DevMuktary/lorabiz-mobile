import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Phone,
  Calendar,
  Building,
  ChevronDown,
  ChevronRight,
  X,
  Wallet,
  ArrowRight,
  Info,
  Check,
  RotateCw,
  Search,
  Lock,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export const ENROLLING_BANKS = [
  { id: "AGENCY_BVN", name: "Agency BVN", description: "POS Agent & Field Enrollment" },
  { id: "ENTERPRISE", name: "Enterprise Bank", description: "Enterprise Commercial Banking" },
  { id: "AGRICULTURAL_BANK", name: "Agricultural Bank", description: "Bank of Agriculture / Agribank" },
  { id: "NIBSS_IMPORT", name: "NIBSS IMPORT", description: "Direct NIBSS Database Migration" },
  { id: "HERITAGE_BANK", name: "Heritage Bank", description: "Heritage Commercial Banking" },
  { id: "MICROFINANCE_BANK", name: "Microfinance Bank", description: "Microfinance Banking Institutions" },
];

export const MODIFICATION_OPTIONS = [
  {
    id: "CHANGE_OF_NAME",
    label: "Change of Name Only",
    hasName: true,
    hasDob: false,
    hasPhone: false,
    priceKey: "BVN_MOD_NAME",
    defaultPrice: 3000,
  },
  {
    id: "CHANGE_OF_DOB",
    label: "Change of Date of Birth (DOB) Only",
    hasName: false,
    hasDob: true,
    hasPhone: false,
    priceKey: "BVN_MOD_DOB",
    defaultPrice: 15000,
  },
  {
    id: "CHANGE_OF_PHONE",
    label: "Change of Phone Number Only",
    hasName: false,
    hasDob: false,
    hasPhone: true,
    priceKey: "BVN_MOD_PHONE",
    defaultPrice: 2500,
  },
  {
    id: "CHANGE_OF_NAME_PHONE",
    label: "Change of Name & Phone Number",
    hasName: true,
    hasDob: false,
    hasPhone: true,
    priceKey: "BVN_MOD_NAME_PHONE",
    defaultPrice: 5000,
  },
  {
    id: "CHANGE_OF_DOB_PHONE",
    label: "Change of Date of Birth & Phone",
    hasName: false,
    hasDob: true,
    hasPhone: true,
    priceKey: "BVN_MOD_DOB_PHONE",
    defaultPrice: 17000,
  },
  {
    id: "CHANGE_OF_NAME_DOB",
    label: "Change of Name & Date of Birth",
    hasName: true,
    hasDob: true,
    hasPhone: false,
    priceKey: "BVN_MOD_NAME_DOB",
    defaultPrice: 17500,
  },
  {
    id: "CHANGE_OF_ALL",
    label: "Change of Name, DOB & Phone (All 3)",
    hasName: true,
    hasDob: true,
    hasPhone: true,
    priceKey: "BVN_MOD_ALL",
    defaultPrice: 19500,
  },
];

export default function BvnModificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, wallet, refreshWallet } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  // Form State
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedModType, setSelectedModType] = useState<string | null>(null);

  // Primary Identifiers
  const [nin, setNin] = useState("");
  const [bvn, setBvn] = useState("");
  const [oldFirstName, setOldFirstName] = useState("");
  const [oldLastName, setOldLastName] = useState("");
  const [oldMiddleName, setOldMiddleName] = useState("");

  // Dynamic Fields
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newMiddleName, setNewMiddleName] = useState("");
  const [oldDob, setOldDob] = useState("");
  const [newDob, setNewDob] = useState("");
  const [oldPhone, setOldPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Live Server Pricing & Balance
  const [pricing, setPricing] = useState<Record<string, number>>({
    BVN_MOD_NAME: 3000,
    BVN_MOD_PHONE: 2500,
    BVN_MOD_DOB: 15000,
    BVN_MOD_NAME_PHONE: 5000,
    BVN_MOD_DOB_PHONE: 17000,
    BVN_MOD_NAME_DOB: 17500,
    BVN_MOD_ALL: 19500,
  });
  const [originalPricing, setOriginalPricing] = useState<Record<string, number>>({});
  const [hasDiscount, setHasDiscount] = useState<boolean>(false);
  const [discountBadge, setDiscountBadge] = useState<string | undefined>(undefined);
  const [walletBalance, setWalletBalance] = useState<number>(
    wallet?.balance ?? user?.wallet?.balance ?? 0
  );
  const [dobOver5YearsAllowed, setDobOver5YearsAllowed] = useState<boolean>(false); // strictly false as instructed
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Review Terms Checkboxes
  const [hasAgreed1, setHasAgreed1] = useState(false);
  const [hasAgreed2, setHasAgreed2] = useState(false);
  const [hasAgreed3, setHasAgreed3] = useState(false);

  // Success Result
  const [submittedResult, setSubmittedResult] = useState<{
    trackingId: string;
    amountPaid: number;
    bankName: string;
    categoryLabel: string;
  } | null>(null);

  // Custom Alert
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

  // Sync wallet balance
  useEffect(() => {
    if (wallet && typeof wallet.balance === "number") {
      setWalletBalance(wallet.balance);
    } else if (user?.wallet && typeof user.wallet.balance === "number") {
      setWalletBalance(user.wallet.balance);
    }
  }, [wallet?.balance, user?.wallet?.balance]);

  // Load Pricing & Configuration
  const loadData = useCallback(async () => {
    try {
      const [res, refreshedBal] = await Promise.all([
        api.get<any>("/api/bvn/modification"),
        refreshWallet().catch(() => null),
      ]);

      if (res && res.success) {
        if (res.pricing) setPricing(res.pricing);
        if (res.originalPricing) setOriginalPricing(res.originalPricing);
        if (typeof res.hasDiscount === "boolean") setHasDiscount(res.hasDiscount);
        if (res.discountBadge) setDiscountBadge(res.discountBadge);
        if (typeof res.dobOver5YearsAllowed === "boolean") {
          // Keep policy rule: we do not accept >5 years difference as instructed
          setDobOver5YearsAllowed(false);
        }
      }

      if (typeof refreshedBal === "number") {
        setWalletBalance(refreshedBal);
      } else if (res && typeof res.walletBalance === "number") {
        setWalletBalance(res.walletBalance);
      }
    } catch (err) {
      console.error("Failed to load BVN modification data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshWallet]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshWallet().catch(() => {});
    }, [loadData, refreshWallet])
  );

  // Active configurations
  const activeBank = useMemo(() => {
    return ENROLLING_BANKS.find((b) => b.id === selectedBank) || null;
  }, [selectedBank]);

  const activeModConfig = useMemo(() => {
    return MODIFICATION_OPTIONS.find((m) => m.id === selectedModType) || null;
  }, [selectedModType]);

  // Real-time Date Difference Calculation
  const dobCalculation = useMemo(() => {
    if (!activeModConfig?.hasDob || !oldDob || !newDob) {
      return { diffYears: 0, isOverFiveYears: false };
    }
    const current = new Date(oldDob);
    const updated = new Date(newDob);

    if (isNaN(current.getTime()) || isNaN(updated.getTime())) {
      return { diffYears: 0, isOverFiveYears: false };
    }

    const diffTime = Math.abs(updated.getTime() - current.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const diffYears = Number((diffDays / 365.2425).toFixed(2));
    const isOverFiveYears = diffDays > 1826.25;

    return { diffYears, isOverFiveYears };
  }, [activeModConfig?.hasDob, oldDob, newDob]);

  // Price Calculation (no hardcoded surcharge; >5 years is completely blocked)
  const currentPrice = useMemo(() => {
    if (!activeModConfig) return 0;
    return pricing[activeModConfig.priceKey] || activeModConfig.defaultPrice;
  }, [activeModConfig, pricing]);

  const isBalanceSufficient = walletBalance >= currentPrice;

  // Sanitized field inputs
  const cleanNin = nin.replace(/\D/g, "").slice(0, 11);
  const isValidNin = cleanNin.length === 11;

  const cleanBvn = bvn.replace(/\D/g, "").slice(0, 11);
  const isValidBvn = cleanBvn.length === 11;

  const cleanOldPhone = oldPhone.replace(/\D/g, "").slice(0, 11);
  const cleanNewPhone = newPhone.replace(/\D/g, "").slice(0, 11);
  const isValidNewPhone = cleanNewPhone.length === 11 && cleanNewPhone.startsWith("0");

  // Form Validity
  const isFormValid = useMemo(() => {
    if (!selectedBank || !selectedModType || !activeModConfig) return false;
    if (!isValidNin || !isValidBvn) return false;
    if (!oldFirstName.trim() || !oldLastName.trim()) return false;

    if (activeModConfig.hasName) {
      if (!newFirstName.trim() || !newLastName.trim()) return false;
    }

    if (activeModConfig.hasDob) {
      if (!oldDob.trim() || !newDob.trim()) return false;
      // Strictly reject >5 years difference as instructed
      if (dobCalculation.isOverFiveYears) return false;
    }

    if (activeModConfig.hasPhone) {
      if (!cleanOldPhone || !isValidNewPhone) return false;
    }

    return true;
  }, [
    selectedBank,
    selectedModType,
    activeModConfig,
    isValidNin,
    isValidBvn,
    oldFirstName,
    oldLastName,
    newFirstName,
    newLastName,
    oldDob,
    newDob,
    dobCalculation,
    cleanOldPhone,
    isValidNewPhone,
  ]);

  const handleProceedToReview = () => {
    Keyboard.dismiss();
    setFormError(null);

    if (!selectedBank) {
      setFormError("Please select your enrolling bank.");
      return;
    }

    if (!selectedModType || !activeModConfig) {
      setFormError("Please select a modification service category.");
      return;
    }

    if (!isValidNin) {
      setFormError("NIN must be exactly 11 digits.");
      return;
    }

    if (!isValidBvn) {
      setFormError("BVN must be exactly 11 digits.");
      return;
    }

    if (!oldFirstName.trim() || !oldLastName.trim()) {
      setFormError("Old First Name and Surname on BVN are required.");
      return;
    }

    if (activeModConfig.hasName) {
      if (!newFirstName.trim() || !newLastName.trim()) {
        setFormError("New First Name and New Surname are required.");
        return;
      }
    }

    if (activeModConfig.hasDob) {
      if (!oldDob.trim() || !newDob.trim()) {
        setFormError("Both Old and New Date of Birth (YYYY-MM-DD) are required.");
        return;
      }
      if (dobCalculation.isOverFiveYears) {
        setFormError("Date of birth differences greater than 5 years are currently not accepted by policy.");
        return;
      }
    }

    if (activeModConfig.hasPhone) {
      if (!cleanOldPhone) {
        setFormError("Old Phone Number on BVN is required.");
        return;
      }
      if (!isValidNewPhone) {
        setFormError("New Phone Number must be 11 digits starting with 0.");
        return;
      }
    }

    if (!isBalanceSufficient) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Insufficient Balance",
        message: `This modification requires ₦${currentPrice.toLocaleString()}, but your current wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
        confirmText: "Fund Wallet",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.push("/wallet/fund" as any);
        },
      });
      return;
    }

    setHasAgreed1(false);
    setHasAgreed2(false);
    setHasAgreed3(false);
    setIsReviewModalOpen(true);
  };

  const handleExecuteSubmission = async () => {
    if (!hasAgreed1 || !hasAgreed2 || !hasAgreed3) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        enrollingBank: selectedBank,
        modificationType: selectedModType,
        nin: cleanNin,
        bvn: cleanBvn,
        oldFirstName: oldFirstName.trim(),
        oldLastName: oldLastName.trim(),
        oldMiddleName: oldMiddleName.trim() || null,
        newFirstName: activeModConfig?.hasName ? newFirstName.trim() : null,
        newLastName: activeModConfig?.hasName ? newLastName.trim() : null,
        newMiddleName: activeModConfig?.hasName && newMiddleName.trim() ? newMiddleName.trim() : null,
        oldDob: activeModConfig?.hasDob ? oldDob.trim() : null,
        newDob: activeModConfig?.hasDob ? newDob.trim() : null,
        oldPhone: activeModConfig?.hasPhone ? cleanOldPhone : null,
        newPhone: activeModConfig?.hasPhone ? cleanNewPhone : null,
      };

      const res = await api.post<any>("/api/bvn/modification", payload);

      if (res && res.success) {
        setIsReviewModalOpen(false);
        setSubmittedResult({
          trackingId: res.trackingId || "N/A",
          amountPaid: currentPrice,
          bankName: activeBank?.name || "Enrolling Bank",
          categoryLabel: activeModConfig?.label || "BVN Modification",
        });

        // Update local wallet balance immediately
        setWalletBalance((prev) => Math.max(0, prev - currentPrice));
        refreshWallet().catch(() => {});
      } else {
        setIsReviewModalOpen(false);
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Submission Error",
          message: res?.message || "Failed to submit BVN modification request.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setIsReviewModalOpen(false);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Network Error",
        message: err?.message || "Unable to submit request. Please check your connection.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedResult(null);
    setSelectedBank(null);
    setSelectedModType(null);
    setNin("");
    setBvn("");
    setOldFirstName("");
    setOldLastName("");
    setOldMiddleName("");
    setNewFirstName("");
    setNewLastName("");
    setNewMiddleName("");
    setOldDob("");
    setNewDob("");
    setOldPhone("");
    setNewPhone("");
    setFormError(null);
  };

  const filteredBanks = useMemo(() => {
    if (!bankSearchQuery.trim()) return ENROLLING_BANKS;
    const q = bankSearchQuery.toLowerCase();
    return ENROLLING_BANKS.filter(
      (b) => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
    );
  }, [bankSearchQuery]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>BVN Record Modification</Text>
            <Text style={styles.headerSubtitle}>Loading service...</Text>
          </View>
        </View>
        <BrandLoader message="Loading BVN Modification service..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>BVN Modification</Text>
          <Text style={styles.headerSubtitle}>Data & Biometric Updates</Text>
        </View>

        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => router.push("/services/bvn-modification-history" as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {submittedResult ? (
            /* Post Submission Success Screen */
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <CheckCircle2 size={44} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Modification Request Submitted!</Text>
              <Text style={styles.successSubtitle}>
                Your BVN modification order is received and queued for NIBSS record processing.
              </Text>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tracking ID:</Text>
                  <Text style={[styles.summaryValue, styles.fontMono, { color: colors.primary }]}>
                    {submittedResult.trackingId}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Enrolling Bank:</Text>
                  <Text style={styles.summaryValue}>{submittedResult.bankName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service:</Text>
                  <Text style={styles.summaryValue}>{submittedResult.categoryLabel}</Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>Amount Paid:</Text>
                  <Text style={[styles.summaryValue, styles.fontBold, { color: "#059669" }]}>
                    ₦{submittedResult.amountPaid.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.timelineNoteBox}>
                <Clock size={15} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.timelineNoteText}>
                  Processing turnaround is <Text style={styles.fontBold}>72 Hours – 7 Working Days</Text>. Track status in Modification History.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 20 }}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => router.push("/services/bvn-modification-history" as any)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryActionText}>Track in Modification History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={handleResetForm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryActionText}>Submit Another Modification</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Agency Banner */}
              <View style={styles.agencyBanner}>
                <Image
                  source={require("../../assets/nibss.png")}
                  style={styles.agencyLogo}
                  resizeMode="contain"
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.agencyBadge}>NIBSS BVN SERVICE</Text>
                  <Text style={styles.agencyTitle}>BVN Record Modification</Text>
                  <Text style={styles.agencyDesc}>
                    Change of Name, Phone Number, and Date of Birth on your Bank Verification Number.
                  </Text>
                </View>
              </View>

              {/* Policy & Timeline Pill */}
              <TouchableOpacity
                style={styles.policyPill}
                onPress={() => setIsGuidelinesModalOpen(true)}
                activeOpacity={0.8}
              >
                <View style={styles.policyPillLeft}>
                  <Clock size={15} color="#059669" />
                  <Text style={styles.policyPillText}>
                    Turnaround: <Text style={styles.fontBold}>72 Hours – 7 Working Days</Text>
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
                    <Text style={styles.currentPriceText}>
                      {currentPrice > 0 ? `₦${currentPrice.toLocaleString()}` : "Select Category"}
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
                        !isBalanceSufficient && currentPrice > 0 && { color: colors.error },
                      ]}
                    >
                      ₦{walletBalance.toLocaleString()}
                    </Text>
                  </View>
                  {!isBalanceSufficient && currentPrice > 0 ? (
                    <TouchableOpacity
                      onPress={() => router.push("/wallet/fund" as any)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.fundWalletLink}>+ Top Up Wallet</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Form Error Banner */}
              {formError ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={16} color="#EF4444" style={{ marginRight: 8, flexShrink: 0 }} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              {/* STEP 1: ENROLLING BANK */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>1. SELECT ENROLLING BANK</Text>
                <TouchableOpacity
                  style={styles.pickerTrigger}
                  onPress={() => setIsBankPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Building size={18} color={selectedBank ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.pickerValue, !selectedBank && { color: colors.textMuted }]}>
                      {activeBank ? activeBank.name : "Choose Enrolling Bank..."}
                    </Text>
                    {activeBank ? (
                      <Text style={styles.pickerSub}>{activeBank.description}</Text>
                    ) : null}
                  </View>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* STEP 2: MODIFICATION CATEGORY */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>2. MODIFICATION CATEGORY</Text>
                <TouchableOpacity
                  style={styles.pickerTrigger}
                  onPress={() => setIsCategoryPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <User size={18} color={selectedModType ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.pickerValue, !selectedModType && { color: colors.textMuted }]}>
                      {activeModConfig ? activeModConfig.label : "Choose Service Category..."}
                    </Text>
                    {activeModConfig ? (
                      <Text style={styles.pickerSub}>
                        Fee: ₦{(pricing[activeModConfig.priceKey] || activeModConfig.defaultPrice).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* STEP 3: PRIMARY IDENTIFIERS */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>3. PRIMARY IDENTIFIERS</Text>

                {/* 11-Digit NIN */}
                <Text style={styles.inputLabel}>11-DIGIT NIN NUMBER</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textInput}
                    value={nin}
                    onChangeText={(val) => {
                      setNin(val.replace(/\D/g, "").slice(0, 11));
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter 11-digit NIN"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={11}
                  />
                  {isValidNin && <CheckCircle2 size={18} color="#059669" />}
                </View>

                {/* 11-Digit BVN */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>11-DIGIT BVN NUMBER</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textInput}
                    value={bvn}
                    onChangeText={(val) => {
                      setBvn(val.replace(/\D/g, "").slice(0, 11));
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter 11-digit BVN"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={11}
                  />
                  {isValidBvn && <CheckCircle2 size={18} color="#059669" />}
                </View>

                {/* Old Names on BVN */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>FIRST NAME (CURRENTLY ON BVN)</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textInput}
                    value={oldFirstName}
                    onChangeText={setOldFirstName}
                    placeholder="e.g. John"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>SURNAME (CURRENTLY ON BVN)</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textInput}
                    value={oldLastName}
                    onChangeText={setOldLastName}
                    placeholder="e.g. Doe"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>MIDDLE NAME (ON BVN - OPTIONAL)</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.textInput}
                    value={oldMiddleName}
                    onChangeText={setOldMiddleName}
                    placeholder="e.g. Chukwuemeka"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* STEP 4: DYNAMIC FIELD SECTIONS */}
              {activeModConfig?.hasName && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionLabel}>NEW NAME DETAILS</Text>

                  <Text style={styles.inputLabel}>NEW FIRST NAME</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={newFirstName}
                      onChangeText={setNewFirstName}
                      placeholder="Enter new first name"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                    />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW SURNAME</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={newLastName}
                      onChangeText={setNewLastName}
                      placeholder="Enter new surname"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                    />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW MIDDLE NAME (OPTIONAL)</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={newMiddleName}
                      onChangeText={setNewMiddleName}
                      placeholder="Enter new middle name"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              {activeModConfig?.hasDob && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionLabel}>DATE OF BIRTH DETAILS</Text>

                  <Text style={styles.inputLabel}>CURRENT DOB ON BVN (YYYY-MM-DD)</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={oldDob}
                      onChangeText={setOldDob}
                      placeholder="e.g. 1995-06-15"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Calendar size={18} color={colors.textMuted} />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW DOB TO REFLECT (YYYY-MM-DD)</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={newDob}
                      onChangeText={setNewDob}
                      placeholder="e.g. 1998-06-15"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Calendar size={18} color={colors.textMuted} />
                  </View>

                  {/* Real-time Year Difference & Policy Alert */}
                  {oldDob && newDob && (
                    <View style={{ marginTop: 10 }}>
                      {dobCalculation.isOverFiveYears ? (
                        <View style={styles.dobPolicyWarning}>
                          <AlertCircle size={15} color="#DC2626" style={{ marginRight: 6 }} />
                          <Text style={styles.dobPolicyWarningText}>
                            Difference is {dobCalculation.diffYears} years. Date of birth changes greater than 5 years are currently not accepted by policy.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.dobPolicySuccess}>
                          <CheckCircle2 size={15} color="#059669" style={{ marginRight: 6 }} />
                          <Text style={styles.dobPolicySuccessText}>
                            Difference is {dobCalculation.diffYears} years (within acceptable policy range).
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {activeModConfig?.hasPhone && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionLabel}>PHONE NUMBER DETAILS</Text>

                  <Text style={styles.inputLabel}>OLD PHONE NUMBER ON BVN</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={oldPhone}
                      onChangeText={(val) => setOldPhone(val.replace(/\D/g, "").slice(0, 11))}
                      placeholder="e.g. 08012345678"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      maxLength={11}
                    />
                    <Phone size={18} color={colors.textMuted} />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>NEW PHONE NUMBER TO LINK</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={newPhone}
                      onChangeText={(val) => setNewPhone(val.replace(/\D/g, "").slice(0, 11))}
                      placeholder="e.g. 08187654321"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      maxLength={11}
                    />
                    {isValidNewPhone && <CheckCircle2 size={18} color="#059669" />}
                  </View>
                </View>
              )}

              {/* Proceed Button */}
              <TouchableOpacity
                style={[styles.submitBtn, !isFormValid && styles.submitBtnDisabled]}
                onPress={handleProceedToReview}
                disabled={!isFormValid}
                activeOpacity={0.88}
              >
                <Text style={styles.submitBtnText}>
                  {currentPrice > 0
                    ? `Review & Submit (₦${currentPrice.toLocaleString()})`
                    : "Review & Submit"}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL 1: ENROLLING BANK SELECTION */}
      <Modal
        visible={isBankPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsBankPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Building size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Select Enrolling Bank</Text>
              </View>
              <TouchableOpacity onPress={() => setIsBankPickerOpen(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Bank Search Input */}
            <View style={styles.modalSearchBox}>
              <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                value={bankSearchQuery}
                onChangeText={setBankSearchQuery}
                placeholder="Search supported banks..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <ScrollView style={{ marginTop: 8 }}>
              {filteredBanks.map((b) => {
                const isSelected = selectedBank === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.bankOptionRow, isSelected && styles.bankOptionRowSelected]}
                    onPress={() => {
                      setSelectedBank(b.id);
                      setIsBankPickerOpen(false);
                      setBankSearchQuery("");
                      if (formError) setFormError(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bankOptionName, isSelected && { color: colors.primary }]}>
                        {b.name}
                      </Text>
                      <Text style={styles.bankOptionDesc}>{b.description}</Text>
                    </View>
                    {isSelected && <CheckCircle2 size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: CATEGORY SELECTION */}
      <Modal
        visible={isCategoryPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCategoryPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <User size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Select Modification Service</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCategoryPickerOpen(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 8 }}>
              {MODIFICATION_OPTIONS.map((m) => {
                const isSelected = selectedModType === m.id;
                const price = pricing[m.priceKey] || m.defaultPrice;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.categoryOptionRow, isSelected && styles.categoryOptionRowSelected]}
                    onPress={() => {
                      setSelectedModType(m.id);
                      setIsCategoryPickerOpen(false);
                      if (formError) setFormError(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.categoryOptionLabel, isSelected && { color: colors.primary }]}>
                        {m.label}
                      </Text>
                      <Text style={styles.categoryOptionPrice}>₦{price.toLocaleString()}</Text>
                    </View>
                    {isSelected && <CheckCircle2 size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: GUIDELINES & POLICY MODAL */}
      <Modal
        visible={isGuidelinesModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGuidelinesModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.modalHeaderIconWrap}>
                  <Lock size={18} color="#059669" />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.modalTitle}>BVN Modification Guidelines</Text>
                  <Text style={styles.modalSub}>Policy & requirements</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsGuidelinesModalOpen(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              <View style={styles.policyItem}>
                <Text style={styles.policyTitle}>1. Supported Enrolling Banks</Text>
                <Text style={styles.policyDesc}>
                  Must be Agency BVN or 1 of our 6 listed supported banks. Unlisted commercial banks are rejected.
                </Text>
              </View>

              <View style={styles.policyItem}>
                <Text style={styles.policyTitle}>2. Turnaround Time (72 Hours – 7 Working Days)</Text>
                <Text style={styles.policyDesc}>
                  Standard fulfillment is between 72 hours to 7 working days to reflect on the NIBSS central banking database.
                </Text>
              </View>

              <View style={styles.policyItem}>
                <Text style={styles.policyTitle}>3. VNIN Slip Reflection Condition</Text>
                <Text style={styles.policyDesc}>
                  If you modified your NIN first, ensure the update is active and fully reflecting on your VNIN slip.
                </Text>
              </View>

              <View style={styles.policyItem}>
                <Text style={styles.policyTitle}>4. Ownership & Strict Refund Policy</Text>
                <Text style={styles.policyDesc}>
                  You must be the legitimate owner or authorized representative. Strictly no refunds for unlisted banks, unreflected details, or duplicate submissions.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 16 }]}
              onPress={() => setIsGuidelinesModalOpen(false)}
            >
              <Text style={styles.primaryActionText}>I Understand & Proceed</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: REVIEW & STATUTORY AUTHORIZATION (BVN TERMS MODAL) */}
      <Modal
        visible={isReviewModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmitting && setIsReviewModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "90%", paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ShieldCheck size={20} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Confirm Modification</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsReviewModalOpen(false)}
                disabled={isSubmitting}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {/* Request Summary Grid */}
              <View style={styles.reviewSummaryGrid}>
                <View style={styles.reviewSummaryItem}>
                  <Text style={styles.reviewSummaryLabel}>ENROLLING BANK</Text>
                  <Text style={styles.reviewSummaryValue}>{activeBank?.name}</Text>
                </View>

                <View style={styles.reviewSummaryItem}>
                  <Text style={styles.reviewSummaryLabel}>MODIFICATION</Text>
                  <Text style={styles.reviewSummaryValue}>{activeModConfig?.label}</Text>
                </View>

                <View style={styles.reviewSummaryItem}>
                  <Text style={styles.reviewSummaryLabel}>NIN / BVN</Text>
                  <Text style={[styles.reviewSummaryValue, styles.fontMono]}>
                    {cleanNin} / {cleanBvn}
                  </Text>
                </View>

                <View style={styles.reviewSummaryItem}>
                  <Text style={styles.reviewSummaryLabel}>TOTAL FEE</Text>
                  <Text style={[styles.reviewSummaryValue, styles.fontBold, { color: "#059669" }]}>
                    ₦{currentPrice.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Statutory Affirmation Checkboxes */}
              <View style={{ gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={styles.affirmationCard}
                  onPress={() => setHasAgreed1(!hasAgreed1)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkSquare, hasAgreed1 && styles.checkSquareActive]}>
                    {hasAgreed1 && <Check size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.affirmationText}>
                    I certify that I am the <Text style={styles.fontBold}>legitimate owner</Text> of BVN {cleanBvn} or have been duly authorized, and all supplied details are authentic.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.affirmationCard}
                  onPress={() => setHasAgreed2(!hasAgreed2)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkSquare, hasAgreed2 && styles.checkSquareActive]}>
                    {hasAgreed2 && <Check size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.affirmationText}>
                    I have read and accepted the <Text style={styles.fontBold}>Strict No-Refund</Text> and <Text style={styles.fontBold}>VNIN Reflection</Text> conditions (Turnaround: 72 Hours – 7 Working Days).
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.affirmationCard}
                  onPress={() => setHasAgreed3(!hasAgreed3)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkSquare, hasAgreed3 && styles.checkSquareActive]}>
                    {hasAgreed3 && <Check size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.affirmationText}>
                    I authorize Lorabiz to debit <Text style={styles.fontBold}>₦{currentPrice.toLocaleString()}</Text> from my wallet to process this BVN record modification.
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsReviewModalOpen(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    (!hasAgreed1 || !hasAgreed2 || !hasAgreed3 || isSubmitting) && {
                      opacity: 0.5,
                    },
                  ]}
                  onPress={handleExecuteSubmission}
                  disabled={!hasAgreed1 || !hasAgreed2 || !hasAgreed3 || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Accept & Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Branded Alert */}
      <CustomAlertModal {...alertConfig} />
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
    paddingVertical: 6,
    paddingHorizontal: 14,
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
  scrollContent: {
    padding: 16,
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
    marginBottom: 12,
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
  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  pricingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
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
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  currentPriceText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#059669",
  },
  discountBadgeWrap: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 3,
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
    color: "#94A3B8",
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
    marginTop: 3,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
    flex: 1,
    lineHeight: 16,
  },
  formSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  pickerValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  pickerSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  dobPolicyWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: 12,
  },
  dobPolicyWarningText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
    flex: 1,
    lineHeight: 15,
  },
  dobPolicySuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 10,
    borderRadius: 12,
  },
  dobPolicySuccessText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#065F46",
    flex: 1,
    lineHeight: 15,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
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
  modalHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginTop: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  bankOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  bankOptionRowSelected: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
  },
  bankOptionName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  bankOptionDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  categoryOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  categoryOptionRowSelected: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
  },
  categoryOptionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  categoryOptionPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
    marginTop: 2,
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
    marginBottom: 3,
  },
  policyDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
  reviewSummaryGrid: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 8,
  },
  reviewSummaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewSummaryLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
  },
  reviewSummaryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  affirmationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  checkSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkSquareActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  affirmationText: {
    fontSize: 11,
    color: "#334155",
    flex: 1,
    lineHeight: 16,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  primaryActionBtn: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryActionBtn: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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
    marginTop: 4,
    lineHeight: 18,
  },
  summaryBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  timelineNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  timelineNoteText: {
    fontSize: 11,
    color: "#065F46",
    flex: 1,
    lineHeight: 15,
  },
});
