import React, { useState, useEffect, useRef, useCallback } from "react";
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
  StatusBar,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  User,
  Calendar,
  Building,
  ChevronDown,
  X,
  Wallet,
  ArrowRight,
  Check,
  Gift,
  History,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export type TaxIdType = "INDIVIDUAL" | "CORPORATE";

export const CORPORATE_CATEGORIES = [
  "Business Name",
  "Company (LLC)",
  "Incorporated Trustee",
  "Limited Partnership",
  "Limited Liability Partnership",
];

export const MONTHS = [
  { value: 1, label: "January", short: "Jan" },
  { value: 2, label: "February", short: "Feb" },
  { value: 3, label: "March", short: "Mar" },
  { value: 4, label: "April", short: "Apr" },
  { value: 5, label: "May", short: "May" },
  { value: 6, label: "June", short: "Jun" },
  { value: 7, label: "July", short: "Jul" },
  { value: 8, label: "August", short: "Aug" },
  { value: 9, label: "September", short: "Sep" },
  { value: 10, label: "October", short: "Oct" },
  { value: 11, label: "November", short: "Nov" },
  { value: 12, label: "December", short: "Dec" },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// ==========================================
// INTERACTIVE DATE PICKER MODAL (Wheel Style)
// ==========================================
function TaxDatePickerModal({
  visible,
  currentDate,
  onClose,
  onSelectDate,
}: {
  visible: boolean;
  currentDate: string;
  onClose: () => void;
  onSelectDate: (formattedDate: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1939 }, (_, i) => currentYear - i);

  const initialParts = currentDate ? currentDate.split("-") : [];
  const initYear = initialParts[0] ? parseInt(initialParts[0], 10) : 1995;
  const initMonth = initialParts[1] ? parseInt(initialParts[1], 10) : 1;
  const initDay = initialParts[2] ? parseInt(initialParts[2], 10) : 1;

  const [selectedYear, setSelectedYear] = useState<number>(initYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initMonth);
  const [selectedDay, setSelectedDay] = useState<number>(initDay);
  const [activeColumn, setActiveColumn] = useState<"year" | "month" | "day">("year");

  useEffect(() => {
    if (visible) {
      if (currentDate && currentDate.includes("-")) {
        const parts = currentDate.split("-");
        setSelectedYear(parseInt(parts[0], 10) || 1995);
        setSelectedMonth(parseInt(parts[1], 10) || 1);
        setSelectedDay(parseInt(parts[2], 10) || 1);
      }
      setActiveColumn("year");
    }
  }, [visible, currentDate]);

  const maxDays = getDaysInMonth(selectedYear, selectedMonth);
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  useEffect(() => {
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  }, [selectedYear, selectedMonth, maxDays, selectedDay]);

  const handleConfirm = () => {
    const mm = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const dd = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
    onSelectDate(`${selectedYear}-${mm}-${dd}`);
    onClose();
  };

  const previewString = `${MONTHS.find((m) => m.value === selectedMonth)?.label || "Jan"} ${selectedDay}, ${selectedYear}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={datePickerStyles.backdrop}>
        <View style={datePickerStyles.container}>
          <View style={datePickerStyles.header}>
            <View>
              <Text style={datePickerStyles.title}>Select Date of Birth</Text>
              <Text style={datePickerStyles.subtitle}>{previewString}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={datePickerStyles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={datePickerStyles.tabRow}>
            <TouchableOpacity
              style={[datePickerStyles.tabBtn, activeColumn === "year" && datePickerStyles.tabBtnActive]}
              onPress={() => setActiveColumn("year")}
            >
              <Text style={[datePickerStyles.tabBtnText, activeColumn === "year" && datePickerStyles.tabBtnTextActive]}>
                Year: {selectedYear}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[datePickerStyles.tabBtn, activeColumn === "month" && datePickerStyles.tabBtnActive]}
              onPress={() => setActiveColumn("month")}
            >
              <Text style={[datePickerStyles.tabBtnText, activeColumn === "month" && datePickerStyles.tabBtnTextActive]}>
                {MONTHS.find((m) => m.value === selectedMonth)?.short}: {selectedMonth}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[datePickerStyles.tabBtn, activeColumn === "day" && datePickerStyles.tabBtnActive]}
              onPress={() => setActiveColumn("day")}
            >
              <Text style={[datePickerStyles.tabBtnText, activeColumn === "day" && datePickerStyles.tabBtnTextActive]}>
                Day: {selectedDay}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={datePickerStyles.listContainer}>
            {activeColumn === "year" && (
              <ScrollView showsVerticalScrollIndicator style={datePickerStyles.scroll}>
                <View style={datePickerStyles.grid}>
                  {years.map((y) => {
                    const isSelected = y === selectedYear;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[datePickerStyles.pillItem, isSelected && datePickerStyles.pillItemActive]}
                        onPress={() => {
                          setSelectedYear(y);
                          setActiveColumn("month");
                        }}
                      >
                        <Text style={[datePickerStyles.pillItemText, isSelected && datePickerStyles.pillItemTextActive]}>
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {activeColumn === "month" && (
              <ScrollView showsVerticalScrollIndicator style={datePickerStyles.scroll}>
                <View style={datePickerStyles.gridTwoCol}>
                  {MONTHS.map((m) => {
                    const isSelected = m.value === selectedMonth;
                    return (
                      <TouchableOpacity
                        key={m.value}
                        style={[datePickerStyles.pillItemWide, isSelected && datePickerStyles.pillItemActive]}
                        onPress={() => {
                          setSelectedMonth(m.value);
                          setActiveColumn("day");
                        }}
                      >
                        <Text style={[datePickerStyles.pillItemText, isSelected && datePickerStyles.pillItemTextActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {activeColumn === "day" && (
              <ScrollView showsVerticalScrollIndicator style={datePickerStyles.scroll}>
                <View style={datePickerStyles.gridFourCol}>
                  {days.map((d) => {
                    const isSelected = d === selectedDay;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[datePickerStyles.pillItemSquare, isSelected && datePickerStyles.pillItemActive]}
                        onPress={() => setSelectedDay(d)}
                      >
                        <Text style={[datePickerStyles.pillItemText, isSelected && datePickerStyles.pillItemTextActive]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          <TouchableOpacity style={datePickerStyles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
            <Check size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={datePickerStyles.confirmBtnText}>Confirm Date</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ==========================================
// CORPORATE CATEGORY PICKER MODAL
// ==========================================
function CategoryPickerModal({
  visible,
  selectedCategory,
  onClose,
  onSelectCategory,
}: {
  visible: boolean;
  selectedCategory: string;
  onClose: () => void;
  onSelectCategory: (cat: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={datePickerStyles.backdrop}>
        <View style={datePickerStyles.container}>
          <View style={datePickerStyles.header}>
            <View>
              <Text style={datePickerStyles.title}>Corporate Category</Text>
              <Text style={datePickerStyles.subtitle}>Select the registered entity type</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={datePickerStyles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 320, marginVertical: 8 }} showsVerticalScrollIndicator={false}>
            {CORPORATE_CATEGORIES.map((cat) => {
              const isSelected = cat === selectedCategory;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[categoryPickerStyles.itemRow, isSelected && categoryPickerStyles.itemRowActive]}
                  onPress={() => {
                    onSelectCategory(cat);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={categoryPickerStyles.iconBox}>
                    <Building size={16} color={isSelected ? colors.primary : colors.textMuted} />
                  </View>
                  <Text style={[categoryPickerStyles.itemText, isSelected && categoryPickerStyles.itemTextActive]}>
                    {cat}
                  </Text>
                  {isSelected && <Check size={18} color={colors.primary} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ==========================================
// MAIN SCREEN: GENERATE TAX ID (TIN)
// ==========================================
export default function TaxIdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Screen Initial Loading State (BrandLoader until prices are resolved)
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Mode Selection
  const [reqType, setReqType] = useState<TaxIdType>("INDIVIDUAL");

  // Dynamic Pricing State (Strictly non-hardcoded)
  const [prices, setPrices] = useState<{ individual: number | null; corporate: number | null }>({
    individual: null,
    corporate: null,
  });
  const [discountDetails, setDiscountDetails] = useState<Record<string, any>>({});
  const [freePassCount, setFreePassCount] = useState<number>(0);
  const [useRewardCredit, setUseRewardCredit] = useState<boolean>(true);

  // Live Wallet Balance
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Form Fields - Individual
  const [nin, setNin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");

  // Form Fields - Corporate
  const [cacNumber, setCacNumber] = useState("");
  const [corporateCategory, setCorporateCategory] = useState("Business Name");

  // Modals & UI States
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Inline Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Alert State
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

  // Fetch dynamic pricing & wallet balance
  const loadPricingAndWallet = useCallback(async () => {
    try {
      const [priceRes, walletRes, taxRes] = await Promise.all([
        api.get<any>("/api/pricing").catch(() => null),
        api.get<any>("/api/user/wallet").catch(() => null),
        api.get<any>("/api/tax-id").catch(() => null),
      ]);

      if (priceRes && priceRes.success && priceRes.data) {
        setPrices({
          individual: typeof priceRes.data.TAX_ID_INDIVIDUAL === "number" ? priceRes.data.TAX_ID_INDIVIDUAL : null,
          corporate: typeof priceRes.data.TAX_ID_CORPORATE === "number" ? priceRes.data.TAX_ID_CORPORATE : null,
        });
        if (priceRes.discountDetails) {
          setDiscountDetails(priceRes.discountDetails);
        }
      }

      if (walletRes) {
        const bal = walletRes.wallet?.balance ?? walletRes.balance;
        if (typeof bal === "number" || typeof bal === "string") {
          setWalletBalance(Number(bal));
        }
      } else if (user?.wallet?.balance !== undefined) {
        setWalletBalance(Number(user.wallet.balance));
      }

      if (taxRes && typeof taxRes.freePassCount === "number") {
        setFreePassCount(taxRes.freePassCount);
      }
    } catch (e) {
      console.warn("Tax ID initial load error:", e);
    } finally {
      setIsInitialLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadPricingAndWallet();
    }, [loadPricingAndWallet])
  );

  const activePriceKey = reqType === "INDIVIDUAL" ? "TAX_ID_INDIVIDUAL" : "TAX_ID_CORPORATE";
  const activePrice = reqType === "INDIVIDUAL" ? prices.individual : prices.corporate;
  const currentDiscount = discountDetails[activePriceKey];
  const isPassApplied = freePassCount > 0 && useRewardCredit;
  const payablePrice = isPassApplied ? 0 : (activePrice ?? 0);
  const isInsufficient = walletBalance !== null && activePrice !== null && walletBalance < payablePrice;

  // Validation Logic
  const validateForm = () => {
    const errs: Record<string, string> = {};

    if (reqType === "INDIVIDUAL") {
      const cleanNin = nin.trim();
      if (!cleanNin) {
        errs.nin = "NIN is required.";
      } else if (!/^\d{11}$/.test(cleanNin)) {
        errs.nin = "NIN must be exactly 11 numeric digits.";
      }

      if (!firstName.trim()) {
        errs.firstName = "First name is required.";
      }
      if (!lastName.trim()) {
        errs.lastName = "Last name is required.";
      }
      if (!dob.trim()) {
        errs.dob = "Date of birth is required.";
      }
    } else {
      const cleanCac = cacNumber.trim();
      if (!cleanCac) {
        errs.cacNumber = "CAC Registration Number is required.";
      } else if (cleanCac.length < 4) {
        errs.cacNumber = "Please enter a valid CAC registration number.";
      }

      if (!corporateCategory) {
        errs.corporateCategory = "Please select a corporate category.";
      }
    }

    if (!consentChecked) {
      errs.consent = "You must acknowledge authorization before proceeding.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenConfirmation = () => {
    Keyboard.dismiss();
    if (!validateForm()) return;

    if (isInsufficient) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Insufficient Wallet Balance",
        message: `This service costs ₦${payablePrice.toLocaleString()}, but your current wallet balance is ₦${(walletBalance || 0).toLocaleString()}. Please fund your wallet to continue.`,
        confirmText: "Fund Wallet",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.push("/(tabs)/wallet" as any);
        },
      });
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    setIsConfirmModalOpen(false);
    setIsSubmitting(true);

    try {
      const payload: any = {
        type: reqType,
        price: payablePrice,
        useRewardCredit: isPassApplied,
      };

      if (reqType === "INDIVIDUAL") {
        payload.individualData = {
          nin: nin.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob: dob.trim(),
        };
      } else {
        payload.corporateData = {
          cacNumber: cacNumber.trim(),
          category: corporateCategory,
        };
      }

      const res = await api.post<any>("/api/tax-id", payload);

      if (res && res.success) {
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Request Submitted!",
          message: `Your Tax ID (${reqType === "INDIVIDUAL" ? "Individual" : "Corporate"}) application has been received and is now processing.`,
          confirmText: "View History",
          onConfirm: () => {
            setAlertConfig((prev) => ({ ...prev, visible: false }));
            router.replace("/services/tax-id-history" as any);
          },
        });
      } else {
        throw new Error(res?.error || res?.message || "Failed to submit request.");
      }
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Submission Failed",
        message: err.message || "An unexpected error occurred. Please verify your details and try again.",
        confirmText: "Try Again",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Generate Tax ID (TIN)</Text>
          <View style={{ width: 36 }} />
        </View>
        <BrandLoader message="Loading Tax ID service..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top App Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Generate Tax ID (TIN)</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/tax-id-history" as any)}
          style={styles.historyBtn}
          activeOpacity={0.7}
        >
          <History size={16} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: Math.max(insets.bottom, 16) + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Brand Header */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroLogoBox}>
                <Image
                  source={require("../../assets/nrs.png")}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>Nigeria Revenue Service (NRS)</Text>
                <Text style={styles.heroSubtitle}>
                  Generate your Tax Identification Number (TIN).
                </Text>
              </View>
            </View>

            {/* Turnaround Pill (Strictly Working Hours) */}
            <View style={styles.turnaroundPill}>
              <Clock size={12} color="#047857" style={{ marginRight: 6 }} />
              <Text style={styles.turnaroundText}>Turnaround: 1 – 24 Working Hours</Text>
            </View>
          </View>

          {/* Reward Voucher Pass Card (If Available) */}
          {freePassCount > 0 && (
            <View style={styles.passCard}>
              <View style={styles.passIconBox}>
                <Gift size={16} color="#EA580C" />
              </View>
              <View style={styles.passTextCol}>
                <View style={styles.passBadgeRow}>
                  <Text style={styles.passTitle}>1 Free Tax ID Pass</Text>
                  <View style={styles.passTag}>
                    <Text style={styles.passTagText}>READY</Text>
                  </View>
                </View>
                <Text style={styles.passDesc}>
                  {useRewardCredit
                    ? "Applied! Valid for Individual or Corporate Tax ID at ₦0 fee."
                    : "Pass available · Tap toggle to apply to this order"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setUseRewardCredit(!useRewardCredit)}
                style={[styles.toggleTrack, useRewardCredit && styles.toggleTrackActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, useRewardCredit && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
          )}

          {/* Service Type Switcher (Individual vs Corporate) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Registration Type</Text>
          </View>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, reqType === "INDIVIDUAL" && styles.tabButtonActive]}
              onPress={() => {
                setReqType("INDIVIDUAL");
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <User size={16} color={reqType === "INDIVIDUAL" ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabButtonText, reqType === "INDIVIDUAL" && styles.tabButtonTextActive]}>
                Individual (Personal)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, reqType === "CORPORATE" && styles.tabButtonActive]}
              onPress={() => {
                setReqType("CORPORATE");
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Building size={16} color={reqType === "CORPORATE" ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabButtonText, reqType === "CORPORATE" && styles.tabButtonTextActive]}>
                Corporate (Business)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Fee Box (Zero hardcoded values) */}
          <View style={styles.feeBanner}>
            <View style={styles.feeLeft}>
              <Text style={styles.feeLabel}>Service Fee</Text>
              <View style={styles.feeRow}>
                {isPassApplied ? (
                  <>
                    <Text style={styles.feeAmount}>₦0</Text>
                    <View style={styles.freePassPill}>
                      <Text style={styles.freePassPillText}>FREE PASS</Text>
                    </View>
                  </>
                ) : activePrice !== null ? (
                  <>
                    <Text style={styles.feeAmount}>₦{activePrice.toLocaleString()}</Text>
                    {currentDiscount?.hasDiscount && currentDiscount?.badge && (
                      <View style={styles.discountPill}>
                        <Text style={styles.discountPillText}>{currentDiscount.badge}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.feeAmount}>Fee unavailable</Text>
                )}
              </View>
            </View>

            <View style={styles.walletBox}>
              <Wallet size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.walletLabel}>
                Balance: {walletBalance !== null ? `₦${walletBalance.toLocaleString()}` : "—"}
              </Text>
            </View>
          </View>

          {/* Form Content: INDIVIDUAL */}
          {reqType === "INDIVIDUAL" ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Applicant Details</Text>
              <Text style={styles.cardSubtitle}>
                Ensure details match your National Identification Number (NIN) record.
              </Text>

              {/* NIN Input */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>National Identity Number (NIN)</Text>
                  <Text style={styles.fieldCounter}>{nin.length}/11</Text>
                </View>
                <View style={[styles.inputContainer, errors.nin && styles.inputContainerError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter 11-digit NIN"
                    placeholderTextColor={colors.textMuted}
                    value={nin}
                    onChangeText={(val) => {
                      const clean = val.replace(/\D/g, "").slice(0, 11);
                      setNin(clean);
                      if (errors.nin) setErrors((prev) => ({ ...prev, nin: "" }));
                    }}
                    keyboardType="number-pad"
                    maxLength={11}
                  />
                </View>
                {errors.nin ? <Text style={styles.errorText}>{errors.nin}</Text> : null}
              </View>

              {/* First Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>First Name</Text>
                <View style={[styles.inputContainer, errors.firstName && styles.inputContainerError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. John"
                    placeholderTextColor={colors.textMuted}
                    value={firstName}
                    onChangeText={(val) => {
                      setFirstName(val);
                      if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: "" }));
                    }}
                    autoCapitalize="words"
                  />
                </View>
                {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
              </View>

              {/* Last Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Last Name (Surname)</Text>
                <View style={[styles.inputContainer, errors.lastName && styles.inputContainerError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Doe"
                    placeholderTextColor={colors.textMuted}
                    value={lastName}
                    onChangeText={(val) => {
                      setLastName(val);
                      if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: "" }));
                    }}
                    autoCapitalize="words"
                  />
                </View>
                {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
              </View>

              {/* Date of Birth Picker Button */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <TouchableOpacity
                  style={[styles.pickerTrigger, errors.dob && styles.inputContainerError]}
                  onPress={() => setIsDatePickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Calendar size={18} color={colors.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.pickerTriggerText, !dob && { color: colors.textMuted }]}>
                    {dob || "Select Date of Birth"}
                  </Text>
                  <ChevronDown size={18} color={colors.textMuted} style={{ marginLeft: "auto" }} />
                </TouchableOpacity>
                {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}
              </View>
            </View>
          ) : (
            /* Form Content: CORPORATE */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Registered Entity Details</Text>
              <Text style={styles.cardSubtitle}>
                Enter the registered Corporate Affairs Commission (CAC) details.
              </Text>

              {/* CAC Registration Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CAC Registration Number (RC / BN / IT)</Text>
                <View style={[styles.inputContainer, errors.cacNumber && styles.inputContainerError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. BN123456 or RC123456"
                    placeholderTextColor={colors.textMuted}
                    value={cacNumber}
                    onChangeText={(val) => {
                      setCacNumber(val.toUpperCase());
                      if (errors.cacNumber) setErrors((prev) => ({ ...prev, cacNumber: "" }));
                    }}
                    autoCapitalize="characters"
                  />
                </View>
                {errors.cacNumber ? <Text style={styles.errorText}>{errors.cacNumber}</Text> : null}
              </View>

              {/* Corporate Category Picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Entity Category</Text>
                <TouchableOpacity
                  style={[styles.pickerTrigger, errors.corporateCategory && styles.inputContainerError]}
                  onPress={() => setIsCategoryPickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Building size={18} color={colors.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.pickerTriggerText, !corporateCategory && { color: colors.textMuted }]}>
                    {corporateCategory || "Select Category"}
                  </Text>
                  <ChevronDown size={18} color={colors.textMuted} style={{ marginLeft: "auto" }} />
                </TouchableOpacity>
                {errors.corporateCategory ? (
                  <Text style={styles.errorText}>{errors.corporateCategory}</Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Terms & Authorization Checkbox */}
          <TouchableOpacity
            style={styles.consentCard}
            onPress={() => {
              setConsentChecked(!consentChecked);
              if (errors.consent) setErrors((prev) => ({ ...prev, consent: "" }));
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, consentChecked && styles.checkboxActive]}>
              {consentChecked && <Check size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.consentText}>
              I confirm the details provided match registered identity records for Nigeria Revenue Service (NRS) verification.
            </Text>
          </TouchableOpacity>
          {errors.consent ? <Text style={styles.errorText}>{errors.consent}</Text> : null}

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              isSubmitting && styles.submitBtnDisabled,
            ]}
            onPress={handleOpenConfirmation}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isInsufficient ? (
              <>
                <Wallet size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Insufficient Balance · Fund Wallet</Text>
              </>
            ) : (
              <>
                <Text style={styles.submitBtnText}>
                  Continue to Verification {payablePrice > 0 ? `(₦${payablePrice.toLocaleString()})` : "(₦0 Free)"}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <TaxDatePickerModal
        visible={isDatePickerVisible}
        currentDate={dob}
        onClose={() => setIsDatePickerVisible(false)}
        onSelectDate={(selected) => {
          setDob(selected);
          if (errors.dob) setErrors((prev) => ({ ...prev, dob: "" }));
        }}
      />

      {/* Corporate Category Picker Modal */}
      <CategoryPickerModal
        visible={isCategoryPickerVisible}
        selectedCategory={corporateCategory}
        onClose={() => setIsCategoryPickerVisible(false)}
        onSelectCategory={(selected) => {
          setCorporateCategory(selected);
          if (errors.corporateCategory) setErrors((prev) => ({ ...prev, corporateCategory: "" }));
        }}
      />

      {/* Order Review & Confirmation Modal (Sliding Bottom Sheet) */}
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
                <Text style={styles.modalTitle}>Confirm Tax ID Request</Text>
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
                <Text style={styles.summaryLabel}>Registration Type:</Text>
                <Text style={styles.summaryValue}>
                  {reqType === "INDIVIDUAL" ? "Individual (Personal)" : "Corporate (Business)"}
                </Text>
              </View>
              <View style={styles.summaryDivider} />

              {reqType === "INDIVIDUAL" ? (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Applicant Name:</Text>
                    <Text style={[styles.summaryValue, { fontWeight: "700" }]}>{`${firstName} ${lastName}`}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Linked NIN:</Text>
                    <Text style={styles.summaryValue}>{nin}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Date of Birth:</Text>
                    <Text style={styles.summaryValue}>{dob}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>CAC Number:</Text>
                    <Text style={[styles.summaryValue, { fontWeight: "700" }]}>{cacNumber}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Entity Category:</Text>
                    <Text style={styles.summaryValue}>{corporateCategory}</Text>
                  </View>
                </>
              )}

              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Turnaround:</Text>
                <Text style={[styles.summaryValue, { color: "#059669", fontWeight: "700" }]}>
                  1 – 24 Working Hours
                </Text>
              </View>

              {isPassApplied && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Voucher Applied:</Text>
                    <Text style={[styles.summaryValue, { color: "#059669", fontWeight: "800" }]}>
                      1x Free Tax ID Pass
                    </Text>
                  </View>
                </>
              )}

              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount:</Text>
                <Text style={[styles.summaryValue, { color: colors.primary, fontSize: 16, fontWeight: "900" }]}>
                  {payablePrice > 0 ? `₦${payablePrice.toLocaleString()}` : "₦0.00 Free"}
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
                onPress={handleFinalSubmit}
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

      {/* Brand Alert Modal */}
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

// ==========================================
// STYLES
// ==========================================
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
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  heroLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroLogo: {
    width: 34,
    height: 34,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  turnaroundPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  turnaroundText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  passCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  passIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  passTextCol: {
    flex: 1,
    marginRight: 8,
  },
  passBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  passTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9A3412",
    marginRight: 6,
  },
  passTag: {
    backgroundColor: "#EA580C",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  passTagText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  passDesc: {
    fontSize: 11,
    color: "#C2410C",
    lineHeight: 14,
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#CBD5E1",
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: "#EA580C",
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  feeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  feeLeft: {
    flexDirection: "column",
  },
  feeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginRight: 6,
  },
  freePassPill: {
    backgroundColor: "#EA580C",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freePassPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  discountPill: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  walletBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  walletLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
  },
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
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  fieldCounter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  inputContainer: {
    height: 48,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  inputContainerError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  textInput: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  pickerTrigger: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  pickerTriggerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  errorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 4,
    marginLeft: 2,
  },
  consentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  submitBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  summaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "600",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  confirmModalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  modalConfirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmBtnDisabled: {
    opacity: 0.6,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

const datePickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  listContainer: {
    height: 220,
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridTwoCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridFourCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  pillItem: {
    width: "31%",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    marginBottom: 8,
  },
  pillItemWide: {
    width: "48%",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    marginBottom: 8,
  },
  pillItemSquare: {
    width: "18%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pillItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillItemText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  pillItemTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  confirmBtn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

const categoryPickerStyles = StyleSheet.create({
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  itemRowActive: {
    backgroundColor: "#EEF2FF",
    borderColor: colors.primary,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  itemText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
});
