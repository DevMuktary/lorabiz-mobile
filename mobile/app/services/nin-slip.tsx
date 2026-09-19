import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Image,
  Platform,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  Check,
  Eye,
  Clock,
  Phone,
  FileText,
  Wallet,
  User,
  RotateCw,
  WifiOff,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { parseDemographics, NormalizedDemographics } from "../../lib/demographics";
import { downloadAndSharePdf } from "../../lib/pdf";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface SlipFormatConfig {
  id: "nin_basic" | "nin_regular" | "nin_standard" | "nin_premium" | "nin_vnin";
  label: string;
  imageSource: any;
  serviceKey: string;
}

const NIN_QUERY_SLIPS: SlipFormatConfig[] = [
  {
    id: "nin_basic",
    label: "Basic Slip",
    imageSource: require("../../assets/examples/nin_basic.png"),
    serviceKey: "NIN_BASIC",
  },
  {
    id: "nin_regular",
    label: "Regular Slip",
    imageSource: require("../../assets/examples/nin_regular_example.png"),
    serviceKey: "NIN_REGULAR",
  },
  {
    id: "nin_standard",
    label: "Standard Slip",
    imageSource: require("../../assets/examples/nin_standard_example.png"),
    serviceKey: "NIN_STANDARD",
  },
  {
    id: "nin_premium",
    label: "Premium Slip",
    imageSource: require("../../assets/examples/nin_premium_example.png"),
    serviceKey: "NIN_PREMIUM",
  },
  {
    id: "nin_vnin",
    label: "VNIN Slip",
    imageSource: require("../../assets/examples/nin_vnin.png"),
    serviceKey: "NIN_VNIN",
  },
];

const PHONE_QUERY_SLIPS: SlipFormatConfig[] = [
  {
    id: "nin_regular",
    label: "Regular Slip",
    imageSource: require("../../assets/examples/nin_regular_example.png"),
    serviceKey: "NIN_PHONE_REGULAR",
  },
  {
    id: "nin_standard",
    label: "Standard Slip",
    imageSource: require("../../assets/examples/nin_standard_example.png"),
    serviceKey: "NIN_PHONE_STANDARD",
  },
  {
    id: "nin_premium",
    label: "Premium Slip",
    imageSource: require("../../assets/examples/nin_premium_example.png"),
    serviceKey: "NIN_PHONE_PREMIUM",
  },
];

export default function NinSlipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, wallet, refreshWallet, refreshProfile } = useAuth();

  // Auto-refresh wallet when screen focuses
  useFocusEffect(
    useCallback(() => {
      refreshWallet().catch(() => {});
    }, [refreshWallet])
  );

  // Search Mode: Query by NIN Number vs Query by Phone Number
  const [searchMode, setSearchMode] = useState<"NIN" | "PHONE">("NIN");
  const [identifierInput, setIdentifierInput] = useState("");
  const [selectedFormatId, setSelectedFormatId] = useState<
    "nin_basic" | "nin_regular" | "nin_standard" | "nin_premium" | "nin_vnin"
  >("nin_standard");
  const [ndpaConsent, setNdpaConsent] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Specimen Lightbox Modal State
  const [lightbox, setLightbox] = useState<{
    visible: boolean;
    imageSource: any;
    label: string;
  }>({
    visible: false,
    imageSource: null,
    label: "",
  });

  // Custom Branded Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: AlertType;
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    type: "info",
    title: "",
    message: "",
    confirmText: "OK",
    onConfirm: () => {},
  });

  const [isDownloading, setIsDownloading] = useState(false);

  // Success Result Modal State with normalized demographic fields
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    pdfBase64?: string;
    pdfUrl?: string;
    userData?: any;
    demographics?: NormalizedDemographics;
    fullName?: string;
    dob?: string;
    gender?: string;
    photo?: string;
    slipLabel: string;
    identifier: string;
  }>({
    visible: false,
    slipLabel: "",
    identifier: "",
  });

  // 1. Fetch live pricing and availability status from backend
  const {
    data: statusData,
    isLoading: isStatusLoading,
    isError: isStatusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["ninSlipsStatus"],
    queryFn: async () => {
      const res = await api.get("/api/nin/slips/status");
      if (!res || !res.success) {
        throw new Error(res?.message || "Failed to load NIN services");
      }
      return res;
    },
    staleTime: 60000,
    retry: 1,
  });

  // 2. Fetch recent NIN generation history
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["ninSlipsHistory"],
    queryFn: async () => {
      try {
        return await api.get("/api/nin/slips/history");
      } catch {
        return null;
      }
    },
  });

  // Map dynamic prices and active states
  const pricingMap: Record<string, { price: number; isActive: boolean }> =
    statusData?.pricing || {};
  const availableSlips: string[] =
    Array.isArray(statusData?.status?.availableNINSlips)
      ? statusData.status.availableNINSlips
      : [];

  // Active status per format
  const activeMap: Record<string, boolean> = {};
  NIN_QUERY_SLIPS.forEach((opt) => {
    const isServiceActive = Boolean(pricingMap[opt.serviceKey]?.isActive);
    const isGatewayAvailable = availableSlips.includes(opt.id);
    activeMap[opt.id] = isServiceActive && isGatewayAvailable;
  });

  const currentOptions =
    searchMode === "NIN" ? NIN_QUERY_SLIPS : PHONE_QUERY_SLIPS;
  const selectedOption =
    currentOptions.find((opt) => opt.id === selectedFormatId) ||
    currentOptions[0];
  const currentPrice = pricingMap[selectedOption.serviceKey]?.price;
  const isSelectedAvailable = activeMap[selectedOption.id] === true;

  // Validation
  const cleanInput = identifierInput.trim();
  const isInputValid = /^\d{11}$/.test(cleanInput);
  const canSubmit =
    isInputValid &&
    ndpaConsent &&
    !isGenerating &&
    !isStatusLoading &&
    isSelectedAvailable &&
    typeof currentPrice === "number" &&
    currentPrice > 0;

  const handleGenerate = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);

    if (!isInputValid) {
      setErrorMessage(
        searchMode === "NIN"
          ? "Please enter a valid 11-digit NIN."
          : "Please enter a valid 11-digit Phone Number."
      );
      return;
    }

    if (!ndpaConsent) {
      setErrorMessage("Please accept the statutory NDPA compliance attestation.");
      return;
    }

    if (!isSelectedAvailable || typeof currentPrice !== "number" || currentPrice <= 0) {
      setErrorMessage(`${selectedOption.label} is temporarily unavailable.`);
      return;
    }

    const walletBalance = wallet?.balance ?? user?.wallet?.balance ?? 0;
    if (walletBalance < currentPrice) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Insufficient Balance",
        message: `Your balance is ₦${walletBalance.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}. Generating this ${selectedOption.label} requires ₦${currentPrice.toLocaleString()}. Please fund your wallet.`,
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

    setIsGenerating(true);
    try {
      const res = await api.post("/api/nin/slips", {
        identifier: cleanInput,
        searchType: searchMode,
        slipType: selectedOption.id,
        attestationsAccepted: true,
        attestationAccepted: true,
        consentAccepted: true,
      });

      setIsGenerating(false);

      if (!res?.success || (!res?.pdfBase64 && !res?.pdfUrl)) {
        setErrorMessage(
          res?.message ||
            "Failed to generate NIN slip. Please check your details and try again."
        );
        return;
      }

      const demo = parseDemographics(res.userData || res, res.fullName);
      const fullName = demo.fullName || res.fullName || "Verified Citizen";
      const dob = demo.dob || res.dob || "N/A";
      const gender = demo.gender || res.gender || "N/A";
      const photoUri = demo.photo || (res.photo ? (res.photo.startsWith("data:") || res.photo.startsWith("http") ? res.photo : `data:image/jpeg;base64,${res.photo}`) : undefined);

      setResultModal({
        visible: true,
        pdfBase64: res.pdfBase64,
        pdfUrl: res.pdfUrl,
        userData: res.userData,
        demographics: demo,
        fullName,
        dob,
        gender,
        photo: photoUri,
        slipLabel: selectedOption.label,
        identifier: cleanInput,
      });

      refreshWallet().catch(() => {});
      refreshProfile();
      refetchHistory();
    } catch (err: any) {
      setIsGenerating(false);
      setErrorMessage(
        err.message || "Network error. Please check your internet connection."
      );
    }
  };

  const handleDownloadPdf = async (pdfBase64?: string, pdfUrl?: string) => {
    if (isDownloading) return;

    const source = pdfBase64 || pdfUrl || resultModal.pdfBase64 || resultModal.pdfUrl;

    if (!source) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Notice",
        message: "No document available for download.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsDownloading(true);

    const filename = `NIN_Slip_${resultModal.identifier || "document"}_${Date.now()}.pdf`;
    const res = await downloadAndSharePdf({
      source,
      filename,
      dialogTitle: "Download NIN Slip",
    });

    setIsDownloading(false);

    if (!res.success) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Failed",
        message: res.error || "Unable to process document download. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const formatRecentSlipDate = (item: any) => {
    const raw = item.createdAtFull || item.createdAt || item.date;
    if (!raw) return "Recent";
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    if (item.timeFormatted) return item.timeFormatted;
    return String(raw);
  };

  const historyList: any[] = historyData?.history || [];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screen}>
        {/* Top Header matching BVN Slip */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NIN Slip Printing</Text>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/services/slip-history", params: { type: "NIN" } } as any)}
            style={styles.historyNavPill}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Clock size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.historyNavPillText}>History</Text>
          </TouchableOpacity>
        </View>

        {isStatusLoading ? (
          <View style={styles.centerContainer}>
            <BrandLoader inline visible message="Loading NIN services..." />
          </View>
        ) : isStatusError || !statusData ? (
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
            style={styles.container}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: Math.max(insets.bottom, 16) + 32 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Search Mode Segmented Control */}
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  searchMode === "NIN" && styles.segmentBtnActive,
                ]}
                onPress={() => {
                  setSearchMode("NIN");
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <FileText
                  size={15}
                  color={searchMode === "NIN" ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.segmentBtnText,
                    searchMode === "NIN" && styles.segmentBtnTextActive,
                  ]}
                >
                  Query by NIN
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  searchMode === "PHONE" && styles.segmentBtnActive,
                ]}
                onPress={() => {
                  setSearchMode("PHONE");
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <Phone
                  size={15}
                  color={searchMode === "PHONE" ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.segmentBtnText,
                    searchMode === "PHONE" && styles.segmentBtnTextActive,
                  ]}
                >
                  Query by Phone
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color={colors.error} style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Input Card */}
            <View style={styles.inputCard}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>
                  {searchMode === "NIN"
                    ? "11-Digit National Identification Number"
                    : "11-Digit Registered Mobile Phone Number"}
                </Text>
                <Text style={styles.inputCounter}>{cleanInput.length}/11</Text>
              </View>

              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  maxLength={11}
                  value={identifierInput}
                  onChangeText={(val) => {
                    setIdentifierInput(val.replace(/\D/g, ""));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={
                    searchMode === "NIN"
                      ? "Enter 11-digit NIN"
                      : "Enter 11-digit phone number"
                  }
                  placeholderTextColor={colors.textMuted}
                />
                {isInputValid ? (
                  <CheckCircle2
                    size={20}
                    color={colors.success}
                    style={{ marginLeft: 8 }}
                  />
                ) : null}
              </View>
            </View>

            {/* Slip Formats List */}
            <View style={styles.formatSection}>
              <View style={styles.formatHeaderRow}>
                <Text style={styles.sectionLabel}>Select NIN Slip Format</Text>
                <TouchableOpacity
                  style={styles.walletBalanceChip}
                  onPress={() => router.push("/wallet/fund" as any)}
                  activeOpacity={0.7}
                >
                  <Wallet size={13} color={colors.primaryLight} style={{ marginRight: 5 }} />
                  <Text style={styles.walletBalanceChipText}>
                    ₦{(wallet?.balance ?? user?.wallet?.balance ?? 0).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formatsList}>
                {currentOptions.map((opt) => {
                  const isSelected = selectedFormatId === opt.id;
                  const isAvailable = activeMap[opt.id] === true;
                  const formatPrice = pricingMap[opt.serviceKey]?.price;

                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.formatCard,
                        isSelected && styles.formatCardSelected,
                        !isAvailable && styles.formatCardDisabled,
                      ]}
                      onPress={() => {
                        if (isAvailable) setSelectedFormatId(opt.id);
                      }}
                      activeOpacity={isAvailable ? 0.75 : 1}
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
                            <Text
                              style={[
                                styles.formatTitle,
                                !isAvailable && { color: colors.textMuted },
                              ]}
                            >
                              {opt.label}
                            </Text>

                            <TouchableOpacity
                              style={styles.viewExampleBtn}
                              onPress={() =>
                                setLightbox({
                                  visible: true,
                                  imageSource: opt.imageSource,
                                  label: opt.label,
                                })
                              }
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Eye
                                size={12}
                                color={colors.primary}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.viewExampleText}>View Example</Text>
                            </TouchableOpacity>

                            {!isAvailable ? (
                              <View style={styles.unavailableBadge}>
                                <Text style={styles.unavailableBadgeText}>
                                  Unavailable
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      <View style={styles.formatPriceWrap}>
                        <Text
                          style={[
                            styles.formatPrice,
                            !isAvailable && styles.formatPriceDisabled,
                          ]}
                        >
                          {formatPrice !== undefined ? `₦${Number(formatPrice).toLocaleString()}` : "Unavailable"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Statutory NDPA Consent */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setNdpaConsent(!ndpaConsent)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkboxBox,
                  ndpaConsent && styles.checkboxBoxChecked,
                ]}
              >
                {ndpaConsent ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                ) : null}
              </View>
              <Text style={styles.consentText}>
                I confirm that I am the owner of this NIN or have lawful
                authorization to retrieve this record in accordance with the{" "}
                <Text style={{ fontWeight: "800", color: colors.text }}>
                  Nigeria Data Protection Act (NDPA) 2023
                </Text>{" "}
                and LoraBiz Terms.
              </Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleGenerate}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>
                {typeof currentPrice === "number" && currentPrice > 0
                  ? `Verify & Generate (₦${Number(currentPrice).toLocaleString()})`
                  : "Verify & Generate"}
              </Text>
            </TouchableOpacity>

            {/* Recent NIN Slips History */}
            {historyList.length > 0 ? (
              <View style={styles.historySection}>
                <View style={styles.historyHeaderRow}>
                  <Text style={styles.sectionLabel}>Recent Slips Generated</Text>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/services/slip-history", params: { type: "NIN" } } as any)}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.historyCard}>
                  {historyList.slice(0, 5).map((item, idx) => (
                    <TouchableOpacity
                      key={item.id || idx}
                      style={[
                        styles.historyItem,
                        idx === Math.min(historyList.length, 5) - 1 && {
                          borderBottomWidth: 0,
                        },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/services/slip-history",
                          params: {
                            type: "NIN",
                            id: item.id || item.reference || item.identifier,
                          },
                        } as any)
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyIconWrap}>
                        <FileText size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {item.fullName || item.ninMasked || "NIN Slip"}
                        </Text>
                        <Text style={styles.historySub}>
                          {item.slipType || "Standard"} • {formatRecentSlipDate(item)}
                        </Text>
                      </View>
                      {item.pdfUrl ? (
                        <TouchableOpacity
                          style={styles.historyDownloadBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDownloadPdf(undefined, item.pdfUrl);
                          }}
                          activeOpacity={0.7}
                        >
                          <Download size={14} color={colors.primary} />
                        </TouchableOpacity>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
        )}

        {/* Specimen Lightbox Modal */}
        <Modal
          visible={lightbox.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setLightbox({ visible: false, imageSource: null, label: "" })}
        >
          <View style={styles.lightboxBackdrop}>
            <View style={styles.lightboxCard}>
              <View style={styles.lightboxHeader}>
                <Text style={styles.lightboxTitle}>{lightbox.label} Specimen</Text>
                <TouchableOpacity
                  style={styles.lightboxCloseBtn}
                  onPress={() =>
                    setLightbox({ visible: false, imageSource: null, label: "" })
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.lightboxImageWrap}>
                {lightbox.imageSource ? (
                  <Image
                    source={lightbox.imageSource}
                    style={styles.lightboxImage}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>

        {/* Success Result Modal */}
        <Modal
          visible={resultModal.visible}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setResultModal({ visible: false, slipLabel: "", identifier: "" })
          }
        >
          <View style={styles.resultBackdrop}>
            <View style={[styles.resultCard, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 34 : 24) }]}>
              <View style={styles.resultHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <CheckCircle2 size={20} color={colors.success} style={{ marginRight: 8 }} />
                  <Text style={styles.resultTitle}>NIN Record Verified</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setResultModal({ visible: false, slipLabel: "", identifier: "" })
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: SCREEN_HEIGHT * 0.65 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                {(() => {
                  const demo = resultModal.demographics || parseDemographics(resultModal.userData, undefined);
                  const photoUri = demo.photo
                    ? demo.photo.startsWith("data:") || demo.photo.startsWith("http")
                      ? demo.photo
                      : `data:image/jpeg;base64,${demo.photo}`
                    : resultModal.photo || null;
                  const cleanId = resultModal.identifier || demo.nin || "";
                  const maskedNin = cleanId.length >= 6 ? `${cleanId.slice(0, 3)}*****${cleanId.slice(-3)}` : cleanId || "Verified";

                  const detailFields: { label: string; value?: string; fullWidth?: boolean; isMono?: boolean }[] = [
                    { label: "DATE OF BIRTH", value: demo.dob || resultModal.dob },
                    { label: "GENDER", value: demo.gender || resultModal.gender },
                    { label: "PHONE NUMBER", value: demo.phone, isMono: true },
                    { label: "EMAIL", value: demo.email },
                    { label: "STATE OF ORIGIN", value: demo.stateOfOrigin },
                    { label: "LGA OF ORIGIN", value: demo.lgaOfOrigin },
                    { label: "NATIONALITY", value: demo.nationality },
                    { label: "MARITAL STATUS", value: demo.maritalStatus },
                    { label: "TITLE", value: demo.title },
                    { label: "RELIGION", value: demo.religion },
                    { label: "HEIGHT", value: demo.height },
                    { label: "WEIGHT", value: demo.weight },
                    { label: "STATE OF RESIDENCE", value: demo.stateOfResidence },
                    { label: "LGA OF RESIDENCE", value: demo.lgaOfResidence },
                    { label: "RESIDENTIAL ADDRESS", value: demo.residentialAddress || demo.address, fullWidth: true },
                  ].filter((item) => {
                    if (!item.value) return false;
                    const s = String(item.value).trim();
                    return s !== "" && s.toUpperCase() !== "N/A" && s.toUpperCase() !== "NULL" && s.toUpperCase() !== "UNDEFINED";
                  });

                  return (
                    <View style={{ marginBottom: 12 }}>
                      {/* Citizen Identity Profile Card */}
                      <View style={styles.demoCard}>
                        {photoUri ? (
                          <Image
                            source={{ uri: photoUri }}
                            style={styles.demoPhoto}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.demoPhoto, styles.demoPhotoFallback]}>
                            <User size={28} color={colors.primary} />
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.demoLabel}>VERIFIED CITIZEN RECORD</Text>
                          <Text style={styles.demoName} numberOfLines={2}>
                            {resultModal.fullName || demo.fullName || "Verified Citizen"}
                          </Text>
                          <View style={styles.demoBadgeRow}>
                            <View style={styles.ninPill}>
                              <Text style={styles.ninPillText}>NIN: {maskedNin}</Text>
                            </View>
                            <View style={styles.formatPill}>
                              <Text style={styles.formatPillText}>{resultModal.slipLabel || "NIN Slip"}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Rich Demographics Grid (Only non-empty fields) */}
                      {detailFields.length > 0 && (
                        <View style={styles.resultGrid}>
                          {detailFields.map((field, idx) => (
                            <View
                              key={idx}
                              style={[
                                styles.resultGridItem,
                                field.fullWidth && styles.resultGridItemFull,
                              ]}
                            >
                              <Text style={styles.resultGridLabel}>{field.label}</Text>
                              <Text
                                style={[
                                  styles.resultGridValue,
                                  field.isMono && styles.resultGridValueMono,
                                ]}
                                numberOfLines={field.fullWidth ? 3 : 1}
                              >
                                {field.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}

                <View style={styles.successBanner}>
                  <Text style={styles.successBannerText}>
                    Your {resultModal.slipLabel || "NIN Slip"} has been generated successfully. You can download or share it right away.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.resultActions}>
                <TouchableOpacity
                  style={[styles.downloadBtn, isDownloading && { opacity: 0.7 }]}
                  onPress={() => handleDownloadPdf()}
                  disabled={isDownloading}
                  activeOpacity={0.88}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Download size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.downloadBtnText}>
                    {isDownloading ? "Preparing PDF..." : "Download PDF Slip"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeResultBtn}
                  onPress={() =>
                    setResultModal({ visible: false, slipLabel: "", identifier: "" })
                  }
                >
                  <Text style={styles.closeResultBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Custom Branded Alert Modal */}
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

        {/* BrandLoader */}
        <BrandLoader
          visible={isGenerating}
          message="Connecting to NIMC verification gateway..."
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  historyNavPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 63, 122, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 63, 122, 0.2)",
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  /* Segmented Control */
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: colors.text,
    fontWeight: "800",
  },

  /* Error Box */
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: colors.error,
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
  viewExampleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewExampleText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },
  unavailableBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unavailableBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.error,
  },
  formatPriceWrap: {
    marginLeft: 8,
  },
  formatPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  formatPriceDisabled: {
    color: colors.textMuted,
  },

  /* Consent Checkbox */
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  checkboxBox: {
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
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  /* Submit Button */
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  /* History Section */
  historySection: {
    marginTop: 8,
  },
  historyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  historyIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  historySub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyDownloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Lightbox Modal */
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  lightboxCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  lightboxTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  lightboxCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImageWrap: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  lightboxImage: {
    width: "100%",
    height: "100%",
  },

  /* Result Modal */
  resultBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  demoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    marginBottom: 14,
  },
  demoPhoto: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  demoName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  demoLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  demoPhotoFallback: {
    backgroundColor: "rgba(255, 63, 122, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  demoBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ninPill: {
    backgroundColor: "rgba(255, 63, 122, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ninPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  formatPill: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  formatPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  resultGridItem: {
    width: "48.5%",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 9,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  resultGridItemFull: {
    width: "100%",
  },
  resultGridLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  resultGridValue: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  resultGridValueMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 0.3,
  },
  demoDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  successBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
    lineHeight: 18,
  },
  resultActions: {
    gap: 10,
  },
  downloadBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  closeResultBtn: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeResultBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  /* Centered Loading & Offline States */
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
});
