import React, { useState, useEffect, useCallback } from "react";
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
  Globe,
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
} from "lucide-react-native";
import { api, BASE_URL } from "../../lib/api";
import { getAuthToken } from "../../lib/storage";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export type ScumlType = "BUSINESS_NAME" | "LLC" | "NGO";

interface RegistrationOption {
  id: ScumlType;
  label: string;
  desc: string;
  icon: typeof Store;
}

const REG_OPTIONS: RegistrationOption[] = [
  {
    id: "BUSINESS_NAME",
    label: "Business Name",
    desc: "For Enterprises and Ventures",
    icon: Store,
  },
  {
    id: "LLC",
    label: "Company (LLC)",
    desc: "For Private Limited Companies",
    icon: Building2,
  },
  {
    id: "NGO",
    label: "NGO / Trustees",
    desc: "For Foundations, Charities, and Clubs",
    icon: Globe,
  },
];

export default function ScumlScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Loading & service status
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [price, setPrice] = useState<number>(320000);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Form State
  const [regType, setRegType] = useState<ScumlType>("BUSINESS_NAME");
  const [companyName, setCompanyName] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  // Uploaded Documents State
  const [documents, setDocuments] = useState({
    certificateUrl: "",
    certificateName: "",
    statusReportUrl: "",
    statusReportName: "",
    memorandumUrl: "",
    memorandumName: "",
    constitutionUrl: "",
    constitutionName: "",
  });

  const [uploading, setUploading] = useState({
    certificate: false,
    statusReport: false,
    memorandum: false,
    constitution: false,
  });

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Confirmation modal & submission
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Load pricing, service status, and wallet balance
  const loadData = useCallback(async () => {
    try {
      const [pricingRes, walletRes, settingsRes] = await Promise.all([
        api.get<any>("/api/pricing").catch(() => null),
        api.get<any>("/api/user/wallet").catch(() => null),
        api.get<any>("/api/settings/global").catch(() => null),
      ]);

      if (pricingRes?.success && pricingRes?.data?.SCUML) {
        setPrice(Number(pricingRes.data.SCUML));
      }

      if (walletRes?.success && walletRes?.wallet) {
        setWalletBalance(Number(walletRes.wallet.balance) || 0);
      } else if (walletRes?.balance !== undefined) {
        setWalletBalance(Number(walletRes.balance) || 0);
      }

      if (settingsRes?.success && settingsRes?.settings) {
        setIsActive(settingsRes.settings.scumlEnabled ?? true);
        if (settingsRes.settings.scumlReason) {
          setMaintenanceMsg(settingsRes.settings.scumlReason);
        }
      }
    } catch (err) {
      console.error("Failed to load SCUML dependencies:", err);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Document Picker & Cloudinary Upload Handler
  const handlePickDocument = async (
    docKey: "certificate" | "statusReport" | "memorandum" | "constitution",
    isPdfOnly: boolean
  ) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: isPdfOnly ? ["application/pdf"] : ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      // Validate 5MB limit
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          [docKey]: "File exceeds the 5MB limit. Please compress your document.",
        }));
        return;
      }

      setUploading((prev) => ({ ...prev, [docKey]: true }));
      setErrors((prev) => ({ ...prev, [docKey]: "" }));

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name || (isPdfOnly ? "document.pdf" : "document.jpg"),
        type: asset.mimeType || (isPdfOnly ? "application/pdf" : "image/jpeg"),
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
        throw new Error(uploadJson.error || "Failed to upload file to storage.");
      }

      setDocuments((prev) => ({
        ...prev,
        [docKey === "certificate"
          ? "certificateUrl"
          : docKey === "statusReport"
          ? "statusReportUrl"
          : docKey === "memorandum"
          ? "memorandumUrl"
          : "constitutionUrl"]: uploadJson.url,
        [docKey === "certificate"
          ? "certificateName"
          : docKey === "statusReport"
          ? "statusReportName"
          : docKey === "memorandum"
          ? "memorandumName"
          : "constitutionName"]: asset.name || "Uploaded Document",
      }));
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        [docKey]: err.message || "Failed to upload document. Please try again.",
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [docKey]: false }));
    }
  };

  const handleRemoveDocument = (
    docKey: "certificate" | "statusReport" | "memorandum" | "constitution"
  ) => {
    setDocuments((prev) => ({
      ...prev,
      [docKey === "certificate"
        ? "certificateUrl"
        : docKey === "statusReport"
        ? "statusReportUrl"
        : docKey === "memorandum"
        ? "memorandumUrl"
        : "constitutionUrl"]: "",
      [docKey === "certificate"
        ? "certificateName"
        : docKey === "statusReport"
        ? "statusReportName"
        : docKey === "memorandum"
        ? "memorandumName"
        : "constitutionName"]: "",
    }));
  };

  // Form Validation before opening Bottom Sheet
  const handleOpenReview = () => {
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) {
      newErrors.companyName =
        regType === "BUSINESS_NAME"
          ? "Please enter your exact business name."
          : regType === "LLC"
          ? "Please enter your exact company name."
          : "Please enter your exact NGO / Trustees name.";
    }

    if (!documents.certificateUrl) {
      newErrors.certificate = "CAC Certificate is required.";
    }

    if (!documents.statusReportUrl) {
      newErrors.statusReport = "Status Report (PDF) is required.";
    }

    if (regType === "LLC" && !documents.memorandumUrl) {
      newErrors.memorandum = "Memorandum & Articles (MEMART) is required for LLC.";
    }

    if (regType === "NGO" && !documents.constitutionUrl) {
      newErrors.constitution = "NGO Constitution is required for Trustees.";
    }

    if (!consentChecked) {
      newErrors.consent = "You must confirm the statutory compliance declaration.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsConfirmModalOpen(true);
  };

  // Submission & Wallet Checkout
  const handleConfirmAndPay = async () => {
    if (isInsufficient) {
      setIsConfirmModalOpen(false);
      setAlertConfig({
        visible: true,
        type: "insufficient_balance",
        title: "Insufficient Wallet Balance",
        message: `This service costs ₦${price.toLocaleString()}, but your current wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet to continue.`,
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
      // 1. Create Draft via /api/scuml
      const draftRes = await api.post<any>("/api/scuml", {
        type: regType,
        companyName: companyName.trim(),
        documents: {
          certificateUrl: documents.certificateUrl,
          statusReportUrl: documents.statusReportUrl,
          memorandumUrl: regType === "LLC" ? documents.memorandumUrl : undefined,
          constitutionUrl: regType === "NGO" ? documents.constitutionUrl : undefined,
        },
      });

      if (!draftRes || !draftRes.success || !draftRes.data?.id) {
        throw new Error(draftRes?.error || "Failed to initialize SCUML application draft.");
      }

      const draftId = draftRes.data.id;

      // 2. Pay via Wallet Checkout
      const checkoutRes = await api.post<any>("/api/payment/checkout", {
        registrationId: draftId,
        paymentMethod: "WALLET",
        service: "scuml",
      });

      if (!checkoutRes || !checkoutRes.success) {
        throw new Error(checkoutRes?.message || "Failed to process payment from wallet.");
      }

      setIsConfirmModalOpen(false);

      // 3. Show Success Alert & route to History
      setAlertConfig({
        visible: true,
        type: "success",
        title: "Application Submitted!",
        message: `Your SCUML application for "${companyName.trim()}" has been received and is now PENDING review.`,
        confirmText: "View History",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.replace("/services/scuml-history" as any);
        },
      });
    } catch (err: any) {
      setIsConfirmModalOpen(false);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Submission Failed",
        message: err.message || "An unexpected error occurred during submission. Please try again.",
        confirmText: "Try Again",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInsufficient = walletBalance < price;

  // Dynamic Placeholders & Labels
  const getDynamicLabel = () => {
    if (regType === "BUSINESS_NAME") return "Exact Business Name";
    if (regType === "LLC") return "Exact Company Name (as on CAC)";
    if (regType === "NGO") return "Exact NGO / Trustees Name";
    return "Exact Entity Name";
  };

  const getDynamicPlaceholder = () => {
    if (regType === "BUSINESS_NAME") return "e.g. Adebayo & Sons Enterprises";
    if (regType === "LLC") return "e.g. Zenith Tech Limited";
    if (regType === "NGO") return "e.g. Harmony Foundation Initiative";
    return "Enter name...";
  };

  if (isInitialLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>SCUML Registration</Text>
          <View style={{ width: 36 }} />
        </View>
        <BrandLoader message="Loading SCUML service..." />
      </View>
    );
  }

  if (!isActive) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>SCUML Registration</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.unavailableContainer}>
          <Image
            source={require("../../assets/scuml.png")}
            style={[styles.unavailableLogo, { opacity: 0.5 }]}
            resizeMode="contain"
          />
          <Text style={styles.unavailableTitle}>Service Temporarily Unavailable</Text>
          <Text style={styles.unavailableText}>
            {maintenanceMsg ||
              "SCUML registration is currently undergoing scheduled maintenance. Please check back later."}
          </Text>
          <TouchableOpacity
            style={styles.unavailableBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.unavailableBtnText}>Back to Services</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.topBarTitle}>SCUML Registration</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/scuml-history" as any)}
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
                  source={require("../../assets/scuml.png")}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>SCUML Certification</Text>
                <Text style={styles.heroSubtitle}>
                  Special Control Unit Against Money Laundering compliance certification for corporate entities
                </Text>
              </View>
            </View>

            <View style={styles.heroBadgeRow}>
              <View style={styles.turnaroundPill}>
                <Clock size={12} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.turnaroundText}>Turnaround Time: 24 – 72 Working Hours</Text>
              </View>
              <View style={styles.pricePill}>
                <Text style={styles.pricePillText}>Fee: ₦{price.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Section 1: Registration Type Selection */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>1. Select Registration Type</Text>
            <Text style={styles.sectionSub}>
              Choose the entity structure matching your CAC incorporation documents.
            </Text>

            <View style={styles.typeOptionsContainer}>
              {REG_OPTIONS.map((opt) => {
                const isSelected = regType === opt.id;
                const IconComponent = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.typeOptionCard, isSelected && styles.typeOptionCardActive]}
                    onPress={() => {
                      setRegType(opt.id);
                      setCompanyName("");
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

          {/* Section 2: Exact Entity Name */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>2. {getDynamicLabel()}</Text>
            <Text style={styles.sectionSub}>
              Must match the exact spelling on your CAC Certificate of Incorporation.
            </Text>

            <View style={[styles.inputContainer, errors.companyName && styles.inputContainerError]}>
              <TextInput
                style={styles.textInput}
                placeholder={getDynamicPlaceholder()}
                placeholderTextColor={colors.textMuted}
                value={companyName}
                onChangeText={(val) => {
                  setCompanyName(val);
                  if (errors.companyName) setErrors((p) => ({ ...p, companyName: "" }));
                }}
              />
            </View>
            {errors.companyName ? (
              <Text style={styles.errorText}>{errors.companyName}</Text>
            ) : null}
          </View>

          {/* Section 3: Upload Documents */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>3. Upload Required Documents</Text>
            <Text style={styles.sectionSub}>
              Clear, legible copies of your CAC documents. Maximum file size is 5MB per document.
            </Text>

            {/* Document 1: CAC Certificate */}
            <View style={styles.uploadSlot}>
              <View style={styles.uploadHeaderRow}>
                <View>
                  <Text style={styles.uploadTitle}>CAC Certificate</Text>
                  <Text style={styles.uploadMeta}>PDF, JPG, or PNG (Max 5MB)</Text>
                </View>
                {documents.certificateUrl ? (
                  <TouchableOpacity
                    onPress={() => handleRemoveDocument("certificate")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {documents.certificateUrl ? (
                <View style={styles.uploadedSuccessBox}>
                  <CheckCircle2 size={18} color="#10B981" style={{ marginRight: 8 }} />
                  <Text style={styles.uploadedFileName} numberOfLines={1}>
                    {documents.certificateName || "CAC_Certificate.pdf"}
                  </Text>
                  <TouchableOpacity
                    style={styles.replaceBtn}
                    onPress={() => handlePickDocument("certificate", false)}
                    disabled={uploading.certificate}
                  >
                    <Text style={styles.replaceBtnText}>Replace</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadBox, errors.certificate && styles.uploadBoxError]}
                  onPress={() => handlePickDocument("certificate", false)}
                  disabled={uploading.certificate}
                  activeOpacity={0.8}
                >
                  {uploading.certificate ? (
                    <View style={styles.uploadLoadingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.uploadLoadingText}>Uploading to secure storage...</Text>
                    </View>
                  ) : (
                    <View style={styles.uploadIdleRow}>
                      <UploadCloud size={20} color={colors.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.uploadBoxText}>Select CAC Certificate</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {errors.certificate ? (
                <Text style={styles.errorText}>{errors.certificate}</Text>
              ) : null}
            </View>

            {/* Document 2: Status Report */}
            <View style={styles.uploadSlot}>
              <View style={styles.uploadHeaderRow}>
                <View>
                  <Text style={styles.uploadTitle}>Status Report</Text>
                  <Text style={styles.uploadMeta}>Strictly PDF format (Max 5MB)</Text>
                </View>
                {documents.statusReportUrl ? (
                  <TouchableOpacity
                    onPress={() => handleRemoveDocument("statusReport")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {documents.statusReportUrl ? (
                <View style={styles.uploadedSuccessBox}>
                  <CheckCircle2 size={18} color="#10B981" style={{ marginRight: 8 }} />
                  <Text style={styles.uploadedFileName} numberOfLines={1}>
                    {documents.statusReportName || "Status_Report.pdf"}
                  </Text>
                  <TouchableOpacity
                    style={styles.replaceBtn}
                    onPress={() => handlePickDocument("statusReport", true)}
                    disabled={uploading.statusReport}
                  >
                    <Text style={styles.replaceBtnText}>Replace</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadBox, errors.statusReport && styles.uploadBoxError]}
                  onPress={() => handlePickDocument("statusReport", true)}
                  disabled={uploading.statusReport}
                  activeOpacity={0.8}
                >
                  {uploading.statusReport ? (
                    <View style={styles.uploadLoadingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.uploadLoadingText}>Uploading to secure storage...</Text>
                    </View>
                  ) : (
                    <View style={styles.uploadIdleRow}>
                      <UploadCloud size={20} color={colors.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.uploadBoxText}>Select Status Report (PDF)</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {errors.statusReport ? (
                <Text style={styles.errorText}>{errors.statusReport}</Text>
              ) : null}
            </View>

            {/* Document 3: LLC Memorandum & Articles */}
            {regType === "LLC" && (
              <View style={styles.uploadSlot}>
                <View style={styles.uploadHeaderRow}>
                  <View>
                    <Text style={styles.uploadTitle}>Memorandum & Articles (MEMART)</Text>
                    <Text style={styles.uploadMeta}>Strictly PDF format (Max 5MB)</Text>
                  </View>
                  {documents.memorandumUrl ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveDocument("memorandum")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {documents.memorandumUrl ? (
                  <View style={styles.uploadedSuccessBox}>
                    <CheckCircle2 size={18} color="#10B981" style={{ marginRight: 8 }} />
                    <Text style={styles.uploadedFileName} numberOfLines={1}>
                      {documents.memorandumName || "MEMART.pdf"}
                    </Text>
                    <TouchableOpacity
                      style={styles.replaceBtn}
                      onPress={() => handlePickDocument("memorandum", true)}
                      disabled={uploading.memorandum}
                    >
                      <Text style={styles.replaceBtnText}>Replace</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadBox, errors.memorandum && styles.uploadBoxError]}
                    onPress={() => handlePickDocument("memorandum", true)}
                    disabled={uploading.memorandum}
                    activeOpacity={0.8}
                  >
                    {uploading.memorandum ? (
                      <View style={styles.uploadLoadingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.uploadLoadingText}>Uploading to secure storage...</Text>
                      </View>
                    ) : (
                      <View style={styles.uploadIdleRow}>
                        <UploadCloud size={20} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.uploadBoxText}>Select MEMART (PDF)</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                {errors.memorandum ? (
                  <Text style={styles.errorText}>{errors.memorandum}</Text>
                ) : null}
              </View>
            )}

            {/* Document 4: NGO Constitution */}
            {regType === "NGO" && (
              <View style={styles.uploadSlot}>
                <View style={styles.uploadHeaderRow}>
                  <View>
                    <Text style={styles.uploadTitle}>NGO Constitution</Text>
                    <Text style={styles.uploadMeta}>Strictly PDF format (Max 5MB)</Text>
                  </View>
                  {documents.constitutionUrl ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveDocument("constitution")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {documents.constitutionUrl ? (
                  <View style={styles.uploadedSuccessBox}>
                    <CheckCircle2 size={18} color="#10B981" style={{ marginRight: 8 }} />
                    <Text style={styles.uploadedFileName} numberOfLines={1}>
                      {documents.constitutionName || "Constitution.pdf"}
                    </Text>
                    <TouchableOpacity
                      style={styles.replaceBtn}
                      onPress={() => handlePickDocument("constitution", true)}
                      disabled={uploading.constitution}
                    >
                      <Text style={styles.replaceBtnText}>Replace</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadBox, errors.constitution && styles.uploadBoxError]}
                    onPress={() => handlePickDocument("constitution", true)}
                    disabled={uploading.constitution}
                    activeOpacity={0.8}
                  >
                    {uploading.constitution ? (
                      <View style={styles.uploadLoadingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.uploadLoadingText}>Uploading to secure storage...</Text>
                      </View>
                    ) : (
                      <View style={styles.uploadIdleRow}>
                        <UploadCloud size={20} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.uploadBoxText}>Select Constitution (PDF)</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                {errors.constitution ? (
                  <Text style={styles.errorText}>{errors.constitution}</Text>
                ) : null}
              </View>
            )}
          </View>

          {/* Section 4: Statutory Consent Checkbox */}
          <TouchableOpacity
            style={styles.consentCard}
            onPress={() => {
              setConsentChecked(!consentChecked);
              if (errors.consent) setErrors((p) => ({ ...p, consent: "" }));
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, consentChecked && styles.checkboxActive]}>
              {consentChecked && <Check size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.consentText}>
              I declare under the <Text style={styles.consentBold}>Nigeria Data Protection Act (NDPA) 2023</Text> and the Money Laundering (Prevention and Prohibition) Act 2022 that I am authorized to submit this corporate SCUML application, and that all uploaded documents are authentic and unmanipulated.
            </Text>
          </TouchableOpacity>
          {errors.consent ? <Text style={styles.errorText}>{errors.consent}</Text> : null}

          {/* Submit / Proceed to Review Button */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleOpenReview}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>
                  Continue to Submission (₦{price.toLocaleString()})
                </Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Review & Confirmation Modal (Sliding Bottom Sheet) */}
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
                <Text style={styles.modalTitle}>Confirm SCUML Application</Text>
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
                <Text style={styles.summaryLabel}>Entity Type:</Text>
                <Text style={styles.summaryValue}>
                  {regType === "BUSINESS_NAME"
                    ? "Business Name"
                    : regType === "LLC"
                    ? "Company (LLC)"
                    : "NGO / Incorporated Trustees"}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Entity Name:</Text>
                <Text style={[styles.summaryValue, { maxWidth: "60%" }]} numberOfLines={1}>
                  {companyName.trim()}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Turnaround Time:</Text>
                <Text style={[styles.summaryValue, { color: "#334155", fontWeight: "700" }]}>
                  24 – 72 Working Hours
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Processing Fee:</Text>
                <Text style={[styles.summaryValue, { color: colors.primary, fontWeight: "800" }]}>
                  ₦{price.toLocaleString()}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Wallet Balance:</Text>
                <Text style={styles.summaryValue}>₦{walletBalance.toLocaleString()}</Text>
              </View>
            </View>

            {isInsufficient && (
              <View style={styles.insufficientWarning}>
                <AlertCircle size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.insufficientWarningText}>
                  Your wallet balance is insufficient. Please fund your wallet to complete this order.
                </Text>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              {isInsufficient ? (
                <TouchableOpacity
                  style={[styles.confirmPayBtn, { backgroundColor: "#D97706" }]}
                  onPress={() => {
                    setIsConfirmModalOpen(false);
                    router.push("/(tabs)/wallet" as any);
                  }}
                  activeOpacity={0.85}
                >
                  <Wallet size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmPayBtnText}>Fund Wallet</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.confirmPayBtn, isSubmitting && styles.submitBtnDisabled]}
                  onPress={handleConfirmAndPay}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmPayBtnText}>Confirm & Pay</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Alert Modal */}
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
    fontWeight: "700",
    color: colors.text,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
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
    padding: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
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
    width: 36,
    height: 36,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  turnaroundPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  turnaroundText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  pricePill: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pricePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 16,
  },
  typeOptionsContainer: {
    gap: 10,
  },
  typeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  typeOptionCardActive: {
    backgroundColor: "#EEF2FF",
    borderColor: colors.primary,
  },
  typeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  typeIconBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeTextCol: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  typeLabelActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  typeDesc: {
    fontSize: 11,
    color: colors.textMuted,
  },
  typeCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  inputContainer: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: "center",
  },
  inputContainerError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  textInput: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "600",
    marginTop: 4,
  },
  uploadSlot: {
    marginBottom: 14,
  },
  uploadHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  uploadMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  uploadBox: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  uploadBoxError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  uploadIdleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  uploadBoxText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  uploadLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  uploadLoadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginLeft: 8,
  },
  uploadedSuccessBox: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
  },
  replaceBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginLeft: 8,
  },
  replaceBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  consentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
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
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  consentBold: {
    color: colors.text,
    fontWeight: "700",
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
  unavailableContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  unavailableLogo: {
    width: 64,
    height: 64,
    marginBottom: 16,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  unavailableText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 300,
  },
  unavailableBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  unavailableBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
