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
  FileText,
  Clock,
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
import { downloadAndSharePdf } from "../../lib/pdf";
import { parseDemographics, NormalizedDemographics } from "../../lib/demographics";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface BvnSlipFormat {
  id: "bvn_standard" | "bvn_premium";
  label: string;
  badge: string;
  imageSource: any;
  serviceKey: string;
}

const BVN_FORMATS: BvnSlipFormat[] = [
  {
    id: "bvn_standard",
    label: "Standard BVN Slip",
    badge: "Standard Layout",
    imageSource: require("../../assets/examples/bvn_regular.png"),
    serviceKey: "BVN_STANDARD",
  },
  {
    id: "bvn_premium",
    label: "Premium BVN Card Slip",
    badge: "Card / Lamination Ready",
    imageSource: require("../../assets/examples/bvn_premium.png"),
    serviceKey: "BVN_PREMIUM",
  },
];

export default function BvnSlipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, wallet, refreshWallet, refreshProfile } = useAuth();

  // Auto-refresh wallet when screen focuses
  useFocusEffect(
    useCallback(() => {
      refreshWallet().catch(() => {});
    }, [refreshWallet])
  );

  const [bvnInput, setBvnInput] = useState("");
  const [selectedFormatId, setSelectedFormatId] = useState<"bvn_standard" | "bvn_premium">("bvn_standard");
  const [ndpaConsent, setNdpaConsent] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Specimen Preview Lightbox
  const [lightbox, setLightbox] = useState<{
    visible: boolean;
    imageSource: any;
    label: string;
  }>({
    visible: false,
    imageSource: null,
    label: "",
  });

  // Custom Branded Alert Modal State (Replaces native Alert.alert)
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

  // Result Modal
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    pdfBase64?: string;
    pdfUrl?: string;
    userData?: any;
    demographics?: NormalizedDemographics;
    slipLabel?: string;
    identifier?: string;
  }>({ visible: false });

  // Fetch Live BVN Status & Pricing
  const {
    data: statusData,
    isLoading: isStatusLoading,
    isError: isStatusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["bvnSlipStatus"],
    queryFn: async () => {
      const res = await api.get("/api/bvn/status");
      if (!res || !res.success) {
        throw new Error(res?.message || "Failed to load BVN services");
      }
      return res;
    },
    staleTime: 60000,
    retry: 1,
  });

  // Fetch Past BVN Slips History
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["bvnSlipsHistory"],
    queryFn: async () => {
      try {
        return await api.get("/api/bvn/history");
      } catch {
        return null;
      }
    },
  });

  const pricingMap = statusData?.pricing || {};
  const selectedOption =
    BVN_FORMATS.find((o) => o.id === selectedFormatId) || BVN_FORMATS[0];
  const pInfo = pricingMap[selectedOption?.serviceKey];
  const currentPrice = pInfo?.price;
  const isAvailable = Boolean(pInfo?.isActive);

  const walletBalance = wallet?.balance ?? user?.wallet?.balance ?? 0;

  const cleanBvn = bvnInput.trim();
  const isInputValid = cleanBvn.length === 11 && /^\d{11}$/.test(cleanBvn);
  const canSubmit =
    isInputValid &&
    ndpaConsent &&
    isAvailable &&
    typeof currentPrice === "number" &&
    currentPrice > 0 &&
    !isGenerating &&
    !isStatusLoading;

  const handleGenerate = async () => {
    setErrorMessage(null);

    if (!isInputValid) {
      setErrorMessage("Please enter a valid 11-digit Bank Verification Number (BVN).");
      return;
    }

    if (!ndpaConsent) {
      setErrorMessage("Please accept the NDPA 2023 statutory consent to proceed.");
      return;
    }

    if (!isAvailable || typeof currentPrice !== "number" || currentPrice <= 0) {
      setErrorMessage(`${selectedOption.label} is temporarily unavailable.`);
      return;
    }

    if (walletBalance < currentPrice) {
      Keyboard.dismiss();
      setAlertConfig({
        visible: true,
        type: "insufficient_balance",
        title: "Insufficient Balance",
        message: `This BVN slip requires ₦${currentPrice.toLocaleString()}, but your available balance is ₦${walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}. Would you like to fund your wallet?`,
        confirmText: "Fund Wallet",
        cancelText: "Maybe Later",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          router.push("/wallet/fund" as any);
        },
        onCancel: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    Keyboard.dismiss();
    setIsGenerating(true);

    try {
      const res = await api.post("/api/bvn/verify", {
        bvn: cleanBvn,
        slipType: selectedFormatId,
        attestationsAccepted: true,
        attestationAccepted: true,
        consentAccepted: true,
      });

      setIsGenerating(false);

      if (!res?.success || (!res?.pdfBase64 && !res?.pdfUrl)) {
        setErrorMessage(res?.message || "Failed to generate BVN slip. Please verify the BVN and try again.");
        return;
      }

      const parsedDemo = parseDemographics(res.userData || res, res.fullName);

      setResultModal({
        visible: true,
        pdfBase64: res.pdfBase64,
        pdfUrl: res.pdfUrl,
        userData: res.userData,
        demographics: parsedDemo,
        slipLabel: selectedOption.label,
        identifier: cleanBvn,
      });

      refreshWallet().catch(() => {});
      refreshProfile();
      refetchHistory();
    } catch (err: any) {
      setIsGenerating(false);
      setErrorMessage(err.message || "Unable to complete request. Please check your network connection.");
    }
  };

  const handleDownloadPdf = async () => {
    const source = resultModal.pdfBase64 || resultModal.pdfUrl;
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

    const filename = `BVN_Slip_${resultModal.identifier || "document"}_${Date.now()}.pdf`;
    const res = await downloadAndSharePdf({
      source,
      filename,
      dialogTitle: "Download BVN Slip",
    });

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
  };  const formatRecentSlipDate = (item: any) => {
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
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>BVN Verification Slips</Text>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/services/slip-history", params: { type: "BVN" } } as any)}
            style={styles.historyNavPill}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Clock size={13} color="#0284C7" style={{ marginRight: 5 }} />
            <Text style={styles.historyNavPillText}>History</Text>
          </TouchableOpacity>
        </View>

        {isStatusLoading ? (
          <View style={styles.centerContainer}>
            <BrandLoader inline visible message="Loading BVN services..." />
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
        {errorMessage ? (
          <View style={styles.errorBox}>
            <AlertCircle size={18} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>11-Digit Bank Verification Number (BVN)</Text>
            <Text style={styles.inputCounter}>{bvnInput.length}/11</Text>
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              keyboardType="number-pad"
              maxLength={11}
              value={bvnInput}
              onChangeText={(val) => {
                setBvnInput(val.replace(/\D/g, ""));
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter 11-digit BVN"
              placeholderTextColor={colors.textMuted}
            />
            {bvnInput.length === 11 ? (
              <CheckCircle2 size={20} color={colors.success} style={{ marginLeft: 8 }} />
            ) : null}
          </View>
        </View>

        {/* Formats */}
        <View style={styles.formatSection}>
          <View style={styles.formatHeaderRow}>
            <Text style={styles.sectionLabel}>Select Slip Format</Text>
            <TouchableOpacity
              style={styles.walletBalanceChip}
              onPress={() => router.push("/wallet/fund" as any)}
              activeOpacity={0.7}
            >
              <Wallet size={13} color="#0284C7" style={{ marginRight: 5 }} />
              <Text style={styles.walletBalanceChipText}>
                ₦{(wallet?.balance ?? user?.wallet?.balance ?? 0).toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formatsList}>
            {BVN_FORMATS.map((opt) => {
              const isSelected = selectedFormatId === opt.id;
              const formatPInfo = pricingMap[opt.serviceKey];
              const formatPrice = formatPInfo?.price;
              const formatAvailable = Boolean(formatPInfo?.isActive);

              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.formatCard,
                    isSelected && styles.formatCardSelected,
                    !formatAvailable && styles.formatCardDisabled,
                  ]}
                  onPress={() => {
                    if (formatAvailable) setSelectedFormatId(opt.id);
                  }}
                  activeOpacity={formatAvailable ? 0.75 : 1}
                >
                  <View style={styles.formatCardLeft}>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                        !formatAvailable && styles.radioCircleDisabled,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>

                    <View style={styles.formatInfo}>
                      <View style={styles.formatTitleRow}>
                        <Text
                          style={[
                            styles.formatTitle,
                            !formatAvailable && { color: colors.textMuted },
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
                        >
                          <Eye size={12} color={colors.primary} style={{ marginRight: 4 }} />
                          <Text style={styles.viewExampleText}>View Example</Text>
                        </TouchableOpacity>

                        {!formatAvailable ? (
                          <View style={styles.unavailableBadge}>
                            <Text style={styles.unavailableBadgeText}>Unavailable</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.formatPriceWrap}>
                    <Text
                      style={[
                        styles.formatPrice,
                        !formatAvailable && styles.formatPriceDisabled,
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

        {/* Single Statutory NDPA Consent */}
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
            {ndpaConsent ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
          <Text style={styles.consentText}>
            I confirm that I am the owner of this BVN or have lawful authorization to retrieve this financial record in accordance with the{" "}
            <Text style={{ fontWeight: "800", color: colors.text }}>
              Nigeria Data Protection Act (NDPA) 2023
            </Text>{" "}
            and LoraBiz Terms.
          </Text>
        </TouchableOpacity>

        {/* Generate Button */}
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

        {/* History */}
        {historyList.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={styles.sectionLabel}>Recent BVN Slips</Text>
            <View style={styles.historyCard}>
              {historyList.slice(0, 5).map((item, idx) => (
                <TouchableOpacity
                  key={item.id || idx}
                  style={[
                    styles.historyItem,
                    idx === Math.min(historyList.length, 5) - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/services/slip-history",
                      params: {
                        type: "BVN",
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
                      {item.fullName || item.bvn || "BVN Slip"}
                    </Text>
                    <Text style={styles.historySub}>
                      {item.slipType || "Standard"} • {formatRecentSlipDate(item)}
                    </Text>
                  </View>
                  <View style={styles.historyStatusBadge}>
                    <Text style={styles.historyStatusText}>
                      {item.status || "SUCCESS"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
      )}

      {/* BrandLoader */}
      <BrandLoader
        visible={isGenerating}
        message="Retrieving verified NIBSS BVN record..."
      />

      {/* Custom Luxury Alert Modal */}
      <CustomAlertModal {...alertConfig} />

      {/* Specimen Lightbox */}
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
                onPress={() => setLightbox({ visible: false, imageSource: null, label: "" })}
                style={styles.lightboxCloseBtn}
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

      {/* Result Modal */}
      <Modal
        visible={resultModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setResultModal({ visible: false })}
      >
        <View style={styles.resultBackdrop}>
          <View style={[styles.resultCard, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 34 : 24) }]}>
            <View style={styles.resultHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CheckCircle2 size={20} color={colors.success} style={{ marginRight: 8 }} />
                <Text style={styles.resultTitle}>BVN Record Verified</Text>
              </View>
              <TouchableOpacity
                onPress={() => setResultModal({ visible: false })}
                style={styles.lightboxCloseBtn}
              >
                <X size={18} color={colors.text} />
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
                  : null;
                const cleanId = resultModal.identifier || demo.bvn || "";
                const maskedBvn = cleanId.length >= 6 ? `${cleanId.slice(0, 3)}*****${cleanId.slice(-3)}` : cleanId || "Verified";

                const detailFields: { label: string; value?: string; fullWidth?: boolean; isMono?: boolean }[] = [
                  { label: "DATE OF BIRTH", value: demo.dob },
                  { label: "GENDER", value: demo.gender },
                  { label: "PHONE NUMBER", value: demo.phone, isMono: true },
                  { label: "EMAIL", value: demo.email },
                  { label: "STATE OF ORIGIN", value: demo.stateOfOrigin },
                  { label: "LGA OF ORIGIN", value: demo.lgaOfOrigin },
                  { label: "NATIONALITY", value: demo.nationality },
                  { label: "TITLE", value: demo.title },
                  { label: "RELIGION", value: demo.religion },
                  { label: "HEIGHT", value: demo.height },
                  { label: "WEIGHT", value: demo.weight },
                  { label: "STATE OF RESIDENCE", value: demo.stateOfResidence },
                  { label: "LGA OF RESIDENCE", value: demo.lgaOfResidence },
                  { label: "REGISTRATION DATE", value: demo.registrationDate },
                  { label: "RESIDENTIAL ADDRESS", value: demo.residentialAddress || demo.address, fullWidth: true },
                ].filter((item) => {
                  if (!item.value) return false;
                  const s = String(item.value).trim();
                  return s !== "" && s.toUpperCase() !== "N/A" && s.toUpperCase() !== "NULL" && s.toUpperCase() !== "UNDEFINED";
                });

                return (
                  <View style={{ marginBottom: 12 }}>
                    {/* Identity Profile Header */}
                    <View style={styles.demoCard}>
                      {photoUri ? (
                        <Image
                          source={{ uri: photoUri }}
                          style={styles.demoPhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.demoPhoto, styles.demoPhotoFallback]}>
                          <User size={28} color="#0284C7" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.demoLabel}>VERIFIED ACCOUNT HOLDER</Text>
                        <Text style={styles.demoName} numberOfLines={2}>
                          {demo.fullName || "Verified Bank Customer"}
                        </Text>
                        <View style={styles.demoBadgeRow}>
                          <View style={styles.bvnPill}>
                            <Text style={styles.bvnPillText}>BVN: {maskedBvn}</Text>
                          </View>
                          <View style={styles.formatPill}>
                            <Text style={styles.formatPillText}>{resultModal.slipLabel || "BVN Slip"}</Text>
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
                  Your {resultModal.slipLabel || "BVN Slip"} PDF has been generated and is ready to download.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.resultActions}>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={handleDownloadPdf}
                activeOpacity={0.85}
              >
                <Download size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.downloadBtnText}>Download PDF Slip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeResultBtn}
                onPress={() => setResultModal({ visible: false })}
                activeOpacity={0.8}
              >
                <Text style={styles.closeResultBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </Modal>
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
    backgroundColor: "rgba(2, 132, 199, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.2)",
  },
  historyNavPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
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
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
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
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  formatSection: {
    marginBottom: 16,
  },
  formatHeaderRow: {
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
    letterSpacing: 0.6,
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
    gap: 8,
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
    backgroundColor: "rgba(200, 45, 117, 0.03)",
  },
  formatCardDisabled: {
    opacity: 0.5,
    backgroundColor: "#F1F5F9",
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
    borderColor: "rgba(0, 0, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioCircleDisabled: {
    borderColor: "rgba(0, 0, 0, 0.1)",
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
    gap: 8,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewExampleText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  unavailableBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unavailableBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
  },
  formatPriceWrap: {
    paddingLeft: 8,
  },
  formatPrice: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
  },
  formatPriceDisabled: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0, 0, 0, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  historySection: {
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
  },
  historyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
  historyStatusBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.success,
  },
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
    backgroundColor: "#F0F9FF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.15)",
    marginBottom: 10,
  },
  demoPhoto: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  demoPhotoFallback: {
    backgroundColor: "rgba(2, 132, 199, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  demoLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  demoName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 18,
  },
  demoBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  bvnPill: {
    backgroundColor: "rgba(2, 132, 199, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bvnPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0284C7",
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
