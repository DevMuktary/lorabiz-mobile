import React, { useState, useCallback } from "react";
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
  StatusBar,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  Building2,
  Store,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Wallet,
  ArrowRight,
  History,
  X,
  Check,
  Calendar,
  PenTool,
} from "lucide-react-native";
import { api, BASE_URL } from "../../lib/api";
import { getAuthToken } from "../../lib/storage";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export type CompanyType = "BUSINESS_NAME" | "LLC";

interface TypeOption {
  id: CompanyType;
  label: string;
  desc: string;
  icon: typeof Store;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    id: "BUSINESS_NAME",
    label: "Business Name",
    desc: "For Enterprises and Ventures",
    icon: Store,
  },
  {
    id: "LLC",
    label: "Company (LLC / LTD)",
    desc: "For Private Limited Companies",
    icon: Building2,
  },
];

const DESIGNEE_ROLES = [
  "Proprietor",
  "Director",
  "Secretary",
  "Managing Director",
  "Partner",
];

export default function AnnualReturnsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Loading & service status
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [pricing, setPricing] = useState<Record<string, any>>({});
  const [penaltyPerYear, setPenaltyPerYear] = useState<number>(5000);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Form State
  const [companyType, setCompanyType] = useState<CompanyType>("BUSINESS_NAME");
  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  // Multi-Year Selection
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 11 }, (_, i) => currentYear - i);
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear]);

  // Document Upload
  const [documentType, setDocumentType] = useState<"CERTIFICATE" | "STATUS_REPORT">("CERTIFICATE");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Designee
  const [designeeFullName, setDesigneeFullName] = useState("");
  const [designeeRole, setDesigneeRole] = useState("Proprietor");

  // Signature Upload
  const [signatureUrl, setSignatureUrl] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [isUploadingSig, setIsUploadingSig] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modals
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Load pricing & wallet data
  const loadData = useCallback(async () => {
    try {
      const [annualReturnsRes, walletRes] = await Promise.all([
        api.get<any>("/api/cac/annual-returns").catch(() => null),
        api.get<any>("/api/user/wallet").catch(() => null),
      ]);

      if (annualReturnsRes?.success) {
        if (annualReturnsRes.pricing) {
          setPricing(annualReturnsRes.pricing);
        }
        if (annualReturnsRes.penaltyPerYear !== undefined) {
          setPenaltyPerYear(Number(annualReturnsRes.penaltyPerYear));
        }
      }

      if (walletRes?.success && walletRes?.wallet) {
        setWalletBalance(Number(walletRes.wallet.balance) || 0);
      } else if (walletRes?.balance !== undefined) {
        setWalletBalance(Number(walletRes.balance) || 0);
      }
    } catch (err) {
      console.error("Failed to load Annual Returns dependencies:", err);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Price calculation
  const basePrice = pricing[companyType]?.price ||
    (companyType === "LLC" ? 18000 : 12000);
  const overdueYears = selectedYears.filter((y) => y < currentYear);
  const totalPenalty = overdueYears.length * penaltyPerYear;
  const totalCost = basePrice + totalPenalty;
  const isInsufficient = walletBalance < totalCost;

  // Toggle year selection
  const toggleYear = (year: number) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        const next = prev.filter((y) => y !== year);
        return next.length > 0 ? next : prev; // Must have at least 1 year
      }
      return [...prev, year].sort((a, b) => a - b);
    });
  };

  // File upload handler
  const handlePickDocument = async (target: "document" | "signature") => {
    const isPdfOnly = target === "document";
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: isPdfOnly
          ? ["application/pdf", "image/jpeg", "image/png"]
          : ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      if (asset.size && asset.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, [target]: "File exceeds the 5MB limit." }));
        return;
      }

      if (target === "document") setIsUploadingDoc(true);
      else setIsUploadingSig(true);
      setErrors((prev) => ({ ...prev, [target]: "" }));

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name || "document.pdf",
        type: asset.mimeType || "application/pdf",
      } as any);

      const token = await getAuthToken();
      const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
                Cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`,
              }
            : {}),
        },
        body: formData,
      });

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.success) {
        throw new Error(uploadJson.error || "Failed to upload file.");
      }

      if (target === "document") {
        setDocumentUrl(uploadJson.url);
        setDocumentName(asset.name || "Uploaded Document");
      } else {
        setSignatureUrl(uploadJson.url);
        setSignatureName(asset.name || "Uploaded Signature");
      }
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        [target]: err.message || "Failed to upload. Please try again.",
      }));
    } finally {
      if (target === "document") setIsUploadingDoc(false);
      else setIsUploadingSig(false);
    }
  };

  // Validation
  const handleOpenReview = () => {
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) {
      newErrors.companyName = "Please enter the exact entity name as on CAC.";
    }
    if (!registrationNumber.trim()) {
      newErrors.registrationNumber = "Please enter the RC or BN number.";
    }
    if (selectedYears.length === 0) {
      newErrors.years = "Please select at least one filing year.";
    }
    if (!documentUrl) {
      newErrors.document = "Please upload a CAC verification document.";
    }
    if (!designeeFullName.trim()) {
      newErrors.designeeFullName = "Authorizing officer name is required.";
    }
    if (!signatureUrl) {
      newErrors.signature = "Authorizing officer signature is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsConfirmModalOpen(true);
  };

  // Submission
  const handleConfirmAndPay = async () => {
    if (isInsufficient) {
      setIsConfirmModalOpen(false);
      setAlertConfig({
        visible: true,
        type: "insufficient_balance",
        title: "Insufficient Wallet Balance",
        message: `This filing costs ₦${totalCost.toLocaleString()}, but your wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
        confirmText: "Fund Wallet",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.push("/(tabs)/wallet" as any);
        },
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post<any>("/api/cac/annual-returns", {
        companyType,
        companyName: companyName.trim(),
        registrationNumber: registrationNumber.trim(),
        selectedYears,
        documentType,
        documentUrl,
        designeeFullName: designeeFullName.trim(),
        designeeRole,
        designeeSignatureUrl: signatureUrl,
      });

      if (!res || !res.success) {
        throw new Error(res?.error || "Failed to submit Annual Returns filing.");
      }

      setIsConfirmModalOpen(false);

      setAlertConfig({
        visible: true,
        type: "success",
        title: "Filing Submitted!",
        message: `Your CAC Annual Returns filing for "${companyName.trim()}" (${selectedYears.join(", ")}) has been received and is now pending review.`,
        confirmText: "View History",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.replace("/services/annual-returns-history" as any);
        },
      });
    } catch (err: any) {
      setIsConfirmModalOpen(false);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Submission Failed",
        message: err.message || "An unexpected error occurred. Please try again.",
        confirmText: "Try Again",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (isInitialLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>CAC Annual Returns</Text>
          <View style={{ width: 36 }} />
        </View>
        <BrandLoader message="Loading Annual Returns service..." />
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
        <Text style={styles.topBarTitle}>CAC Annual Returns</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/annual-returns-history" as any)}
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
          {/* Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroLogoBox}>
                <Image
                  source={require("../../assets/cac.png")}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>CAC Annual Returns</Text>
                <Text style={styles.heroSubtitle}>
                  Statutory annual filing with the Corporate Affairs Commission for registered entities
                </Text>
              </View>
            </View>

            <View style={styles.heroBadgeRow}>
              <View style={styles.turnaroundPill}>
                <Clock size={12} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.turnaroundText}>Turnaround: 1 – 48 Working Hours</Text>
              </View>
              <View style={styles.pricePill}>
                <Text style={styles.pricePillText}>From ₦{basePrice.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Section 1: Entity Type */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>1. Entity Structure</Text>
            <Text style={styles.sectionSub}>
              Select the CAC registration type for this filing.
            </Text>

            <View style={styles.typeOptionsContainer}>
              {TYPE_OPTIONS.map((opt) => {
                const isSelected = companyType === opt.id;
                const IconComponent = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.typeOptionCard, isSelected && styles.typeOptionCardActive]}
                    onPress={() => {
                      setCompanyType(opt.id);
                      if (errors.companyName) setErrors((p) => ({ ...p, companyName: "" }));
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.typeIconBox, isSelected && styles.typeIconBoxActive]}>
                      <IconComponent size={20} color={isSelected ? "#FFFFFF" : colors.primary} />
                    </View>
                    <View style={styles.typeTextCol}>
                      <Text style={[styles.typeLabel, isSelected && styles.typeLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.typeDesc}>{opt.desc}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.typeCheckmark}>
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 2: Entity Details */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>2. Entity Details</Text>
            <Text style={styles.sectionSub}>
              Enter details exactly as they appear on your CAC registration.
            </Text>

            <Text style={styles.fieldLabel}>
              {companyType === "LLC" ? "Company Name" : "Business Name"} *
            </Text>
            <View style={[styles.inputContainer, errors.companyName && styles.inputContainerError]}>
              <TextInput
                style={styles.textInput}
                placeholder={companyType === "LLC" ? "e.g. Zenith Tech Limited" : "e.g. Adebayo Enterprises"}
                placeholderTextColor={colors.textMuted}
                value={companyName}
                onChangeText={(val) => {
                  setCompanyName(val);
                  if (errors.companyName) setErrors((p) => ({ ...p, companyName: "" }));
                }}
              />
            </View>
            {errors.companyName ? <Text style={styles.errorText}>{errors.companyName}</Text> : null}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
              {companyType === "LLC" ? "RC Number" : "BN Number"} *
            </Text>
            <View style={[styles.inputContainer, errors.registrationNumber && styles.inputContainerError]}>
              <TextInput
                style={styles.textInput}
                placeholder={companyType === "LLC" ? "e.g. RC 1234567" : "e.g. BN 9876543"}
                placeholderTextColor={colors.textMuted}
                value={registrationNumber}
                onChangeText={(val) => {
                  setRegistrationNumber(val);
                  if (errors.registrationNumber) setErrors((p) => ({ ...p, registrationNumber: "" }));
                }}
              />
            </View>
            {errors.registrationNumber ? <Text style={styles.errorText}>{errors.registrationNumber}</Text> : null}
          </View>

          {/* Section 3: Filing Year(s) */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>3. Filing Year(s)</Text>
            <Text style={styles.sectionSub}>
              Select one or more years to file. Overdue years attract a penalty of ₦{penaltyPerYear.toLocaleString()} per year.
            </Text>

            <View style={styles.yearGrid}>
              {availableYears.map((year) => {
                const isSelected = selectedYears.includes(year);
                const isOverdue = year < currentYear;
                return (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.yearChip,
                      isSelected && styles.yearChipActive,
                      isSelected && isOverdue && styles.yearChipOverdue,
                    ]}
                    onPress={() => toggleYear(year)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.yearChipText,
                        isSelected && styles.yearChipTextActive,
                      ]}
                    >
                      {year}
                    </Text>
                    {isSelected && isOverdue && (
                      <Text style={styles.yearPenaltyTag}>+₦{penaltyPerYear.toLocaleString()}</Text>
                    )}
                    {isSelected && !isOverdue && (
                      <Text style={styles.yearCurrentTag}>Current</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.years ? <Text style={styles.errorText}>{errors.years}</Text> : null}

            {/* Cost Breakdown */}
            <View style={styles.costBreakdownBox}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Base Filing Fee ({selectedYears.length} year{selectedYears.length > 1 ? "s" : ""})</Text>
                <Text style={styles.costValue}>₦{basePrice.toLocaleString()}</Text>
              </View>
              {totalPenalty > 0 && (
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: "#D97706" }]}>
                    Late Filing Penalty ({overdueYears.length} overdue)
                  </Text>
                  <Text style={[styles.costValue, { color: "#D97706" }]}>
                    ₦{totalPenalty.toLocaleString()}
                  </Text>
                </View>
              )}
              <View style={[styles.costRow, styles.costTotalRow]}>
                <Text style={styles.costTotalLabel}>Total Amount</Text>
                <Text style={styles.costTotalValue}>₦{totalCost.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Section 4: Verification Document */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>4. Verification Document</Text>
            <Text style={styles.sectionSub}>
              Upload your CAC Certificate of Registration or Status Report.
            </Text>

            {/* Document Type Toggle */}
            <View style={styles.docTypeRow}>
              <TouchableOpacity
                style={[styles.docTypeBtn, documentType === "CERTIFICATE" && styles.docTypeBtnActive]}
                onPress={() => setDocumentType("CERTIFICATE")}
                activeOpacity={0.8}
              >
                <Text style={[styles.docTypeBtnText, documentType === "CERTIFICATE" && styles.docTypeBtnTextActive]}>
                  CAC Certificate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docTypeBtn, documentType === "STATUS_REPORT" && styles.docTypeBtnActive]}
                onPress={() => setDocumentType("STATUS_REPORT")}
                activeOpacity={0.8}
              >
                <Text style={[styles.docTypeBtnText, documentType === "STATUS_REPORT" && styles.docTypeBtnTextActive]}>
                  Status Report
                </Text>
              </TouchableOpacity>
            </View>

            {!documentUrl ? (
              <TouchableOpacity
                style={[styles.uploadZone, errors.document && styles.uploadZoneError]}
                onPress={() => handlePickDocument("document")}
                disabled={isUploadingDoc}
                activeOpacity={0.7}
              >
                {isUploadingDoc ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <UploadCloud size={28} color={colors.textMuted} />
                    <Text style={styles.uploadZoneText}>Tap to upload document</Text>
                    <Text style={styles.uploadZoneHint}>PDF, JPEG or PNG • Max 5MB</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.uploadedFile}>
                <FileText size={18} color={colors.primary} />
                <Text style={styles.uploadedFileName} numberOfLines={1}>
                  {documentName}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setDocumentUrl("");
                    setDocumentName("");
                  }}
                  style={styles.removeFileBtn}
                >
                  <Trash2 size={14} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
            {errors.document ? <Text style={styles.errorText}>{errors.document}</Text> : null}
          </View>

          {/* Section 5: Authorizing Officer */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>5. Authorizing Officer</Text>
            <Text style={styles.sectionSub}>
              Details of the officer authorizing this annual return filing.
            </Text>

            <Text style={styles.fieldLabel}>Full Name *</Text>
            <View style={[styles.inputContainer, errors.designeeFullName && styles.inputContainerError]}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Jane Doe"
                placeholderTextColor={colors.textMuted}
                value={designeeFullName}
                onChangeText={(val) => {
                  setDesigneeFullName(val);
                  if (errors.designeeFullName) setErrors((p) => ({ ...p, designeeFullName: "" }));
                }}
              />
            </View>
            {errors.designeeFullName ? <Text style={styles.errorText}>{errors.designeeFullName}</Text> : null}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Designation</Text>
            <View style={styles.roleChipsRow}>
              {DESIGNEE_ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleChip, designeeRole === role && styles.roleChipActive]}
                  onPress={() => setDesigneeRole(role)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleChipText, designeeRole === role && styles.roleChipTextActive]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Section 6: Signature */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>6. Officer Signature</Text>
            <Text style={styles.sectionSub}>
              Upload the authorizing officer's signature image.
            </Text>

            {!signatureUrl ? (
              <TouchableOpacity
                style={[styles.uploadZone, errors.signature && styles.uploadZoneError]}
                onPress={() => handlePickDocument("signature")}
                disabled={isUploadingSig}
                activeOpacity={0.7}
              >
                {isUploadingSig ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <PenTool size={28} color={colors.textMuted} />
                    <Text style={styles.uploadZoneText}>Tap to upload signature</Text>
                    <Text style={styles.uploadZoneHint}>PNG, JPEG or PDF • Max 5MB</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.uploadedFile}>
                <View style={styles.sigPreviewBox}>
                  <Image source={{ uri: signatureUrl }} style={styles.sigPreview} resizeMode="contain" />
                </View>
                <Text style={styles.uploadedFileName} numberOfLines={1}>
                  {signatureName}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSignatureUrl("");
                    setSignatureName("");
                  }}
                  style={styles.removeFileBtn}
                >
                  <Trash2 size={14} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
            {errors.signature ? <Text style={styles.errorText}>{errors.signature}</Text> : null}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleOpenReview}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Review & Submit</Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation Bottom Sheet Modal */}
      <Modal visible={isConfirmModalOpen} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => !isSubmitting && setIsConfirmModalOpen(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Annual Returns Filing</Text>
                <TouchableOpacity
                  onPress={() => !isSubmitting && setIsConfirmModalOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Summary */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Entity:</Text>
                  <Text style={styles.summaryValue}>{companyName}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Reg Number:</Text>
                  <Text style={styles.summaryValue}>{registrationNumber}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Structure:</Text>
                  <Text style={styles.summaryValue}>
                    {companyType === "LLC" ? "Company (LLC)" : "Business Name"}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Filing Year(s):</Text>
                  <Text style={styles.summaryValue}>{selectedYears.join(", ")}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Officer:</Text>
                  <Text style={styles.summaryValue}>
                    {designeeFullName} ({designeeRole})
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Base Fee:</Text>
                  <Text style={styles.summaryValue}>₦{basePrice.toLocaleString()}</Text>
                </View>
                {totalPenalty > 0 && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: "#D97706" }]}>
                        Late Penalty:
                      </Text>
                      <Text style={[styles.summaryValue, { color: "#D97706" }]}>
                        ₦{totalPenalty.toLocaleString()}
                      </Text>
                    </View>
                  </>
                )}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { fontWeight: "800", color: colors.text }]}>
                    Total:
                  </Text>
                  <Text style={[styles.summaryValue, { fontWeight: "900", color: colors.primary, fontSize: 16 }]}>
                    ₦{totalCost.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Wallet Balance */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Wallet size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={styles.summaryLabel}>Wallet Balance:</Text>
                  </View>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: isInsufficient ? colors.error : colors.success },
                    ]}
                  >
                    ₦{walletBalance.toLocaleString()}
                  </Text>
                </View>
              </View>

              {isInsufficient && (
                <View style={styles.insufficientWarning}>
                  <AlertCircle size={16} color={colors.error} style={{ marginRight: 8 }} />
                  <Text style={styles.insufficientWarningText}>
                    Insufficient balance. You need ₦{(totalCost - walletBalance).toLocaleString()} more to proceed.
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={[styles.modalActionsRow, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsConfirmModalOpen(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmPayBtn}
                  onPress={handleConfirmAndPay}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.confirmPayBtnText}>
                      {isInsufficient ? "Fund Wallet" : `Pay ₦${totalCost.toLocaleString()}`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
        onConfirm={alertConfig.onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
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
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  contentContainer: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  heroLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 12,
  },
  heroLogo: {
    width: 32,
    height: 32,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  turnaroundPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  turnaroundText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },
  pricePill: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.15)",
  },
  pricePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeOptionsContainer: {
    gap: 8,
  },
  typeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  typeOptionCardActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.04)",
  },
  typeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  typeIconBoxActive: {
    backgroundColor: colors.primary,
  },
  typeTextCol: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  typeLabelActive: {
    color: colors.primary,
  },
  typeDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  typeCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
  },
  inputContainerError: {
    borderColor: colors.error,
    backgroundColor: "#FEF2F2",
  },
  textInput: {
    flex: 1,
    height: 44,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  errorText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.error,
    marginTop: 4,
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  yearChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.06)",
  },
  yearChipOverdue: {
    borderColor: "#D97706",
    backgroundColor: "rgba(217, 119, 6, 0.06)",
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  yearChipTextActive: {
    color: colors.text,
    fontWeight: "800",
  },
  yearPenaltyTag: {
    fontSize: 9,
    fontWeight: "700",
    color: "#D97706",
    marginTop: 2,
  },
  yearCurrentTag: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.success,
    marginTop: 2,
  },
  costBreakdownBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  costLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  costValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  costTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 6,
    paddingTop: 8,
  },
  costTotalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  costTotalValue: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  docTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  docTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  docTypeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.06)",
  },
  docTypeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  docTypeBtnTextActive: {
    color: colors.primary,
  },
  uploadZone: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    backgroundColor: "#F8FAFC",
  },
  uploadZoneError: {
    borderColor: colors.error,
    backgroundColor: "#FEF2F2",
  },
  uploadZoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginTop: 6,
  },
  uploadZoneHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  uploadedFile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 10,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  removeFileBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  sigPreviewBox: {
    width: 40,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sigPreview: {
    width: 36,
    height: 24,
  },
  roleChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  roleChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.06)",
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  roleChipTextActive: {
    color: colors.primary,
  },
  submitBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
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
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "85%",
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
  summaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    maxWidth: "55%",
    textAlign: "right",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
  },
  insufficientWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 14,
  },
  insufficientWarningText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
    lineHeight: 15,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  confirmPayBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPayBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
