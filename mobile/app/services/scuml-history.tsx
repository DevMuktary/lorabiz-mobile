import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Modal,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowLeft,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  X,
  Plus,
  Download,
  Building2,
  Store,
  Globe,
  FileText,
  ExternalLink,
  ShieldCheck,
  Wallet,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

export interface ScumlRecord {
  id: string;
  userId: string;
  type: "BUSINESS_NAME" | "LLC" | "NGO";
  companyName: string;
  certificateUrl: string;
  statusReportUrl: string;
  memorandumUrl?: string | null;
  constitutionUrl?: string | null;
  finalCertificateUrl?: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  failureReason?: string | null;
  amountPaid: number | string;
  transactionRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

type FilterStatus = "ALL" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function ScumlHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<ScumlRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  // Modals
  const [docsModalItem, setDocsModalItem] = useState<ScumlRecord | null>(null);
  const [failedModalItem, setFailedModalItem] = useState<ScumlRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get<any>("/api/scuml");
      if (res && res.success && Array.isArray(res.history)) {
        setHistory(res.history);
      } else if (Array.isArray(res)) {
        setHistory(res);
      }
    } catch (err: any) {
      console.warn("Error fetching SCUML history:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const handleDownload = async (item: ScumlRecord) => {
    if (!item.finalCertificateUrl) return;

    setDownloadingId(item.id);
    try {
      const safeName = item.companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `SCUML_Certificate_${safeName}.pdf`;

      const result = await downloadAndSharePdf({
        source: item.finalCertificateUrl,
        filename,
        dialogTitle: "Save / Share SCUML Certificate",
        mimeType: "application/pdf",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to download certificate.");
      }
    } catch (e: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Failed",
        message: e.message || "Unable to download certificate. Please try again.",
        confirmText: "Close",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenFile = async (url?: string | null) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.warn("Could not open file URL:", err);
    }
  };

  const filteredData = useMemo(() => {
    return history.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;

      if (!matchesStatus) return false;
      if (!q) return true;

      const targetText = [
        item.companyName,
        item.type,
        item.transactionRef,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return targetText.includes(q);
    });
  }, [history, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      all: history.length,
      pending: history.filter((h) => h.status === "PENDING").length,
      processing: history.filter((h) => h.status === "PROCESSING").length,
      completed: history.filter((h) => h.status === "COMPLETED").length,
      failed: history.filter((h) => h.status === "FAILED").length,
    };
  }, [history]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === "LLC") return <Building2 size={14} color={colors.primary} />;
    if (type === "NGO") return <Globe size={14} color="#8B5CF6" />;
    return <Store size={14} color="#059669" />;
  };

  const getTypeName = (type: string) => {
    if (type === "LLC") return "Company (LLC)";
    if (type === "NGO") return "NGO / Trustees";
    return "Business Name";
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>SCUML History</Text>
          <View style={{ width: 36 }} />
        </View>
        <BrandLoader message="Loading SCUML records..." />
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
        <Text style={styles.topBarTitle}>SCUML History</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/scuml" as any)}
          style={styles.newAppBtn}
          activeOpacity={0.7}
        >
          <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newAppBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Branded Header Banner */}
            <View style={styles.bannerCard}>
              <View style={styles.bannerRow}>
                <View style={styles.bannerLogoBox}>
                  <Image
                    source={require("../../assets/scuml.png")}
                    style={styles.bannerLogo}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.bannerTextCol}>
                  <Text style={styles.bannerTitle}>EFCC / SCUML Compliance Records</Text>
                  <Text style={styles.bannerSubtitle}>
                    Real-time status tracking for Special Control Unit Against Money Laundering certifications
                  </Text>
                </View>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by company name..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Pills with Embedded Counts */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
            >
              <TouchableOpacity
                style={[styles.filterPill, statusFilter === "ALL" && styles.filterPillActive]}
                onPress={() => setStatusFilter("ALL")}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "ALL" && styles.filterPillTextActive,
                  ]}
                >
                  All ({stats.all})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, statusFilter === "PENDING" && styles.filterPillActive]}
                onPress={() => setStatusFilter("PENDING")}
              >
                <Clock size={12} color={statusFilter === "PENDING" ? "#FFFFFF" : "#D97706"} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "PENDING" && styles.filterPillTextActive,
                  ]}
                >
                  Pending ({stats.pending})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, statusFilter === "PROCESSING" && styles.filterPillActive]}
                onPress={() => setStatusFilter("PROCESSING")}
              >
                <RotateCw size={12} color={statusFilter === "PROCESSING" ? "#FFFFFF" : "#2563EB"} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "PROCESSING" && styles.filterPillTextActive,
                  ]}
                >
                  Processing ({stats.processing})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, statusFilter === "COMPLETED" && styles.filterPillActive]}
                onPress={() => setStatusFilter("COMPLETED")}
              >
                <CheckCircle2 size={12} color={statusFilter === "COMPLETED" ? "#FFFFFF" : "#059669"} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "COMPLETED" && styles.filterPillTextActive,
                  ]}
                >
                  Completed ({stats.completed})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, statusFilter === "FAILED" && styles.filterPillActive]}
                onPress={() => setStatusFilter("FAILED")}
              >
                <AlertCircle size={12} color={statusFilter === "FAILED" ? "#FFFFFF" : "#DC2626"} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "FAILED" && styles.filterPillTextActive,
                  ]}
                >
                  Failed ({stats.failed})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <FileText size={48} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Applications Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "No applications matched your search query."
                : statusFilter !== "ALL"
                ? `You have no ${statusFilter.toLowerCase()} SCUML applications.`
                : "You haven't submitted any SCUML registration applications yet."}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push("/services/scuml" as any)}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>Start New Application</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isPending = item.status === "PENDING";
          const isProcessing = item.status === "PROCESSING";
          const isCompleted = item.status === "COMPLETED";
          const isFailed = item.status === "FAILED";
          const isDownloading = downloadingId === item.id;

          return (
            <View style={styles.recordCard}>
              {/* Card Header: Entity Name & Type Badge */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.companyName} numberOfLines={1}>
                    {item.companyName}
                  </Text>
                  <View style={styles.typeBadgeRow}>
                    {getTypeIcon(item.type)}
                    <Text style={styles.typeBadgeText}>{getTypeName(item.type)}</Text>
                  </View>
                </View>

                {/* Status Badge */}
                {isPending && (
                  <View style={styles.statusPending}>
                    <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
                    <Text style={styles.statusPendingText}>Pending</Text>
                  </View>
                )}
                {isProcessing && (
                  <View style={styles.statusProcessing}>
                    <ActivityIndicator size="small" color="#2563EB" style={{ transform: [{ scale: 0.7 }], marginRight: 2 }} />
                    <Text style={styles.statusProcessingText}>Processing</Text>
                  </View>
                )}
                {isCompleted && (
                  <View style={styles.statusCompleted}>
                    <CheckCircle2 size={12} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.statusCompletedText}>Completed</Text>
                  </View>
                )}
                {isFailed && (
                  <View style={styles.statusFailed}>
                    <AlertCircle size={12} color="#DC2626" style={{ marginRight: 4 }} />
                    <Text style={styles.statusFailedText}>Failed</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardDivider} />

              {/* Date & Fee Row */}
              <View style={styles.cardMetaRow}>
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                <Text style={styles.feeText}>
                  ₦{Number(item.amountPaid || 0).toLocaleString()}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.viewDocsBtn}
                  onPress={() => setDocsModalItem(item)}
                  activeOpacity={0.7}
                >
                  <FileText size={14} color={colors.text} style={{ marginRight: 5 }} />
                  <Text style={styles.viewDocsBtnText}>Submitted Docs</Text>
                </TouchableOpacity>

                {isCompleted && item.finalCertificateUrl ? (
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => handleDownload(item)}
                    disabled={isDownloading}
                    activeOpacity={0.85}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Download size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                        <Text style={styles.downloadBtnText}>Download</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : isFailed ? (
                  <TouchableOpacity
                    style={styles.viewReasonBtn}
                    onPress={() => setFailedModalItem(item)}
                    activeOpacity={0.7}
                  >
                    <AlertCircle size={14} color="#DC2626" style={{ marginRight: 5 }} />
                    <Text style={styles.viewReasonBtnText}>View Reason</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {/* 1. Submitted Documents Bottom Sheet Modal */}
      <Modal
        visible={!!docsModalItem}
        transparent
        animationType="slide"
        onRequestClose={() => setDocsModalItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {docsModalItem?.companyName}
                </Text>
                <Text style={styles.modalSubtitle}>Submitted Verification Files</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDocsModalItem(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.docsListContainer}>
              {/* CAC Certificate */}
              <View style={styles.docItemRow}>
                <View style={styles.docItemLeft}>
                  <FileText size={18} color={colors.primary} style={{ marginRight: 10 }} />
                  <View>
                    <Text style={styles.docItemTitle}>CAC Certificate</Text>
                    <Text style={styles.docItemMeta}>Incorporation proof</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.openFileBtn}
                  onPress={() => handleOpenFile(docsModalItem?.certificateUrl)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.openFileBtnText}>Open</Text>
                  <ExternalLink size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>

              {/* Status Report */}
              <View style={styles.docItemRow}>
                <View style={styles.docItemLeft}>
                  <FileText size={18} color={colors.primary} style={{ marginRight: 10 }} />
                  <View>
                    <Text style={styles.docItemTitle}>Status Report</Text>
                    <Text style={styles.docItemMeta}>CAC status report</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.openFileBtn}
                  onPress={() => handleOpenFile(docsModalItem?.statusReportUrl)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.openFileBtnText}>Open</Text>
                  <ExternalLink size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>

              {/* LLC MEMART */}
              {docsModalItem?.memorandumUrl ? (
                <View style={styles.docItemRow}>
                  <View style={styles.docItemLeft}>
                    <FileText size={18} color={colors.primary} style={{ marginRight: 10 }} />
                    <View>
                      <Text style={styles.docItemTitle}>MEMART</Text>
                      <Text style={styles.docItemMeta}>Memorandum & Articles</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.openFileBtn}
                    onPress={() => handleOpenFile(docsModalItem?.memorandumUrl)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.openFileBtnText}>Open</Text>
                    <ExternalLink size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* NGO Constitution */}
              {docsModalItem?.constitutionUrl ? (
                <View style={styles.docItemRow}>
                  <View style={styles.docItemLeft}>
                    <FileText size={18} color={colors.primary} style={{ marginRight: 10 }} />
                    <View>
                      <Text style={styles.docItemTitle}>Constitution</Text>
                      <Text style={styles.docItemMeta}>Incorporated trustees constitution</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.openFileBtn}
                    onPress={() => handleOpenFile(docsModalItem?.constitutionUrl)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.openFileBtnText}>Open</Text>
                    <ExternalLink size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setDocsModalItem(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Rejection & Refund Bottom Sheet Modal */}
      <Modal
        visible={!!failedModalItem}
        transparent
        animationType="slide"
        onRequestClose={() => setFailedModalItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <AlertCircle size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Application Rejected</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFailedModalItem(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.failedBox}>
              <Text style={styles.failedReasonLabel}>Compliance Desk Note:</Text>
              <Text style={styles.failedReasonText}>
                {failedModalItem?.failureReason ||
                  "The uploaded documents did not pass SCUML AML compliance validation or were illegible."}
              </Text>
            </View>

            <View style={styles.refundNoticeBox}>
              <Wallet size={16} color="#059669" style={{ marginRight: 8 }} />
              <Text style={styles.refundNoticeText}>
                A full refund of ₦{Number(failedModalItem?.amountPaid || 0).toLocaleString()} has been credited back to your Lorabiz wallet.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setFailedModalItem(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
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
  newAppBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newAppBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
  },
  bannerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bannerLogo: {
    width: 32,
    height: 32,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterScrollContent: {
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  recordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  companyName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  typeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    marginLeft: 4,
  },
  statusPending: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPendingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  statusProcessing: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusProcessingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  statusCompleted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCompletedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  statusFailed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusFailedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  feeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  viewDocsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 8,
  },
  viewDocsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  viewReasonBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingVertical: 8,
  },
  viewReasonBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 16,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  docsListContainer: {
    gap: 10,
    marginBottom: 16,
  },
  docItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  docItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  docItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  docItemMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  openFileBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  openFileBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  failedBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 12,
  },
  failedReasonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  failedReasonText: {
    fontSize: 13,
    color: "#7F1D1D",
    lineHeight: 18,
    fontWeight: "600",
  },
  refundNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 16,
  },
  refundNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    fontWeight: "600",
    lineHeight: 16,
  },
  modalCloseBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
});
