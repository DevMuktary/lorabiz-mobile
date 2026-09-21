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
  Platform,
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
  FileText,
  ExternalLink,
  Wallet,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

interface YearRecord {
  id: string;
  year: number;
  isPenaltyExempt: boolean;
  penaltyAmount: number | string;
  acknowledgementLetterUrl?: string | null;
  status: string;
  approvedAt?: string | null;
}

export interface AnnualReturnRecord {
  id: string;
  trackingId: string;
  userId: string;
  companyType: "BUSINESS_NAME" | "LLC";
  companyName: string;
  registrationNumber: string;
  filingYears?: string | null;
  documentType: string;
  documentUrl: string;
  designeeFullName: string;
  designeeRole: string;
  designeeSignatureUrl: string;
  status: "PENDING" | "PROCESSING" | "APPROVED" | "QUERIED" | "REJECTED";
  queryReason?: string | null;
  rejectionReason?: string | null;
  acknowledgementLetterUrl?: string | null;
  totalPenalty: number | string;
  totalYears: number;
  amountPaid: number | string;
  transactionRef?: string | null;
  yearRecords?: YearRecord[];
  createdAt: string;
  updatedAt: string;
}

type FilterStatus = "ALL" | "PENDING" | "PROCESSING" | "APPROVED" | "QUERIED" | "REJECTED";

export default function AnnualReturnsHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<AnnualReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  // Expanded cards for year-by-year view
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Modals
  const [detailModalItem, setDetailModalItem] = useState<AnnualReturnRecord | null>(null);
  const [failedModalItem, setFailedModalItem] = useState<AnnualReturnRecord | null>(null);
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
      const res = await api.get<any>("/api/cac/annual-returns");
      if (res && res.success && Array.isArray(res.history)) {
        setHistory(res.history);
      } else if (Array.isArray(res)) {
        setHistory(res);
      }
    } catch (err: any) {
      console.warn("Error fetching Annual Returns history:", err);
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

  const toggleExpanded = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadYearLetter = async (item: AnnualReturnRecord, yearRecord: YearRecord) => {
    if (!yearRecord.acknowledgementLetterUrl) return;

    setDownloadingId(`${item.id}-${yearRecord.year}`);
    try {
      const safeName = item.companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `Annual_Returns_${safeName}_${yearRecord.year}.pdf`;

      const result = await downloadAndSharePdf({
        source: yearRecord.acknowledgementLetterUrl,
        filename,
        dialogTitle: `Save Annual Returns ${yearRecord.year}`,
        mimeType: "application/pdf",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to download letter.");
      }
    } catch (e: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Failed",
        message: e.message || "Unable to download acknowledgement letter.",
        confirmText: "Close",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadLegacyLetter = async (item: AnnualReturnRecord) => {
    if (!item.acknowledgementLetterUrl) return;

    setDownloadingId(item.id);
    try {
      const safeName = item.companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `Annual_Returns_${safeName}.pdf`;

      const result = await downloadAndSharePdf({
        source: item.acknowledgementLetterUrl,
        filename,
        dialogTitle: "Save Annual Returns Letter",
        mimeType: "application/pdf",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to download letter.");
      }
    } catch (e: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Failed",
        message: e.message || "Unable to download acknowledgement letter.",
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
        item.registrationNumber,
        item.trackingId,
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
      approved: history.filter((h) => h.status === "APPROVED").length,
      queried: history.filter((h) => h.status === "QUERIED").length,
      rejected: history.filter((h) => h.status === "REJECTED").length,
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

  const getTypeName = (type: string) => {
    if (type === "LLC") return "Company (LLC)";
    return "Business Name";
  };

  const getTypeIcon = (type: string) => {
    if (type === "LLC") return <Building2 size={14} color={colors.primary} />;
    return <Store size={14} color="#059669" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <View style={styles.statusPending}>
            <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
            <Text style={styles.statusPendingText}>Pending</Text>
          </View>
        );
      case "PROCESSING":
        return (
          <View style={styles.statusProcessing}>
            <ActivityIndicator size="small" color="#2563EB" style={{ transform: [{ scale: 0.7 }], marginRight: 2 }} />
            <Text style={styles.statusProcessingText}>Processing</Text>
          </View>
        );
      case "APPROVED":
        return (
          <View style={styles.statusApproved}>
            <CheckCircle2 size={12} color="#059669" style={{ marginRight: 4 }} />
            <Text style={styles.statusApprovedText}>Approved</Text>
          </View>
        );
      case "QUERIED":
        return (
          <View style={styles.statusQueried}>
            <AlertCircle size={12} color="#D97706" style={{ marginRight: 4 }} />
            <Text style={styles.statusQueriedText}>Queried</Text>
          </View>
        );
      case "REJECTED":
        return (
          <View style={styles.statusRejected}>
            <AlertCircle size={12} color="#DC2626" style={{ marginRight: 4 }} />
            <Text style={styles.statusRejectedText}>Rejected</Text>
          </View>
        );
      default:
        return null;
    }
  };

  // Compute the filing years display from yearRecords or filingYears
  const getFilingYearsDisplay = (item: AnnualReturnRecord) => {
    if (item.yearRecords && item.yearRecords.length > 0) {
      return item.yearRecords.map((yr) => yr.year).join(", ");
    }
    return item.filingYears || "N/A";
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Annual Returns History</Text>
          <View style={{ width: 36 }} />
        </View>
        <BrandLoader message="Loading filing records..." />
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
        <Text style={styles.topBarTitle}>Annual Returns History</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/annual-returns" as any)}
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
                    source={require("../../assets/cac.png")}
                    style={styles.bannerLogo}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.bannerTextCol}>
                  <Text style={styles.bannerTitle}>CAC Annual Returns Records</Text>
                  <Text style={styles.bannerSubtitle}>
                    Real-time status tracking for your Corporate Affairs Commission annual return filings
                  </Text>
                </View>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, tracking ID..."
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

            {/* Filter Pills */}
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
                style={[styles.filterPill, statusFilter === "APPROVED" && styles.filterPillActive]}
                onPress={() => setStatusFilter("APPROVED")}
              >
                <CheckCircle2 size={12} color={statusFilter === "APPROVED" ? "#FFFFFF" : "#059669"} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "APPROVED" && styles.filterPillTextActive,
                  ]}
                >
                  Approved ({stats.approved})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, statusFilter === "QUERIED" && styles.filterPillActive]}
                onPress={() => setStatusFilter("QUERIED")}
              >
                <AlertCircle size={12} color={statusFilter === "QUERIED" ? "#FFFFFF" : "#D97706"} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "QUERIED" && styles.filterPillTextActive,
                  ]}
                >
                  Queried ({stats.queried})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, statusFilter === "REJECTED" && styles.filterPillActive]}
                onPress={() => setStatusFilter("REJECTED")}
              >
                <AlertCircle size={12} color={statusFilter === "REJECTED" ? "#FFFFFF" : "#DC2626"} style={{ marginRight: 4 }} />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === "REJECTED" && styles.filterPillTextActive,
                  ]}
                >
                  Rejected ({stats.rejected})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <FileText size={48} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Filings Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "No filings matched your search query."
                : statusFilter !== "ALL"
                ? `You have no ${statusFilter.toLowerCase()} annual returns filings.`
                : "You haven't submitted any CAC Annual Returns filings yet."}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push("/services/annual-returns" as any)}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>File Annual Returns</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedCards.has(item.id);
          const hasYearRecords = item.yearRecords && item.yearRecords.length > 0;
          const isApproved = item.status === "APPROVED";
          const isRejected = item.status === "REJECTED";
          const isQueried = item.status === "QUERIED";

          return (
            <View style={styles.recordCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.companyName} numberOfLines={1}>
                    {item.companyName}
                  </Text>
                  <View style={styles.typeBadgeRow}>
                    {getTypeIcon(item.companyType)}
                    <Text style={styles.typeBadgeText}>{getTypeName(item.companyType)}</Text>
                    <Text style={styles.regNumText}>• {item.registrationNumber}</Text>
                  </View>
                </View>
                {getStatusBadge(item.status)}
              </View>

              {/* Tracking & Years */}
              <View style={styles.trackingRow}>
                <View style={styles.trackingPill}>
                  <Text style={styles.trackingPillText}>{item.trackingId}</Text>
                </View>
                <View style={styles.yearsPill}>
                  <Calendar size={10} color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.yearsPillText}>{getFilingYearsDisplay(item)}</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* Date, Penalty, Fee Row */}
              <View style={styles.cardMetaRow}>
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.feeText}>
                    ₦{Number(item.amountPaid || 0).toLocaleString()}
                  </Text>
                  {Number(item.totalPenalty || 0) > 0 && (
                    <Text style={styles.penaltyTag}>
                      incl. ₦{Number(item.totalPenalty).toLocaleString()} penalty
                    </Text>
                  )}
                </View>
              </View>

              {/* Queried / Rejected Reason Inline */}
              {isQueried && item.queryReason && (
                <View style={styles.queryReasonBox}>
                  <AlertCircle size={14} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.queryReasonText} numberOfLines={3}>
                    {item.queryReason}
                  </Text>
                </View>
              )}

              {isRejected && item.rejectionReason && (
                <View style={styles.rejectedReasonBox}>
                  <AlertCircle size={14} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.rejectedReasonText} numberOfLines={3}>
                    {item.rejectionReason}
                  </Text>
                </View>
              )}

              {/* Year-by-Year Expandable Section */}
              {hasYearRecords && (
                <>
                  <TouchableOpacity
                    style={styles.expandToggle}
                    onPress={() => toggleExpanded(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.expandToggleText}>
                      Year-by-Year Breakdown ({item.yearRecords!.length})
                    </Text>
                    {isExpanded ? (
                      <ChevronUp size={16} color={colors.primary} />
                    ) : (
                      <ChevronDown size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.yearRecordsContainer}>
                      {item.yearRecords!.map((yr) => {
                        const yrApproved = yr.status === "APPROVED";
                        const isYrDownloading = downloadingId === `${item.id}-${yr.year}`;

                        return (
                          <View key={yr.id} style={styles.yearRecordRow}>
                            <View style={styles.yearRecordLeft}>
                              <Text style={styles.yearRecordYear}>{yr.year}</Text>
                              <View style={{ marginLeft: 10 }}>
                                {yrApproved ? (
                                  <View style={styles.yearStatusApproved}>
                                    <CheckCircle2 size={10} color="#059669" style={{ marginRight: 3 }} />
                                    <Text style={styles.yearStatusApprovedText}>Approved</Text>
                                  </View>
                                ) : (
                                  <View style={styles.yearStatusPending}>
                                    <Clock size={10} color="#D97706" style={{ marginRight: 3 }} />
                                    <Text style={styles.yearStatusPendingText}>Pending</Text>
                                  </View>
                                )}
                                {!yr.isPenaltyExempt && Number(yr.penaltyAmount) > 0 && (
                                  <Text style={styles.yearPenaltyText}>
                                    +₦{Number(yr.penaltyAmount).toLocaleString()} penalty
                                  </Text>
                                )}
                              </View>
                            </View>
                            {yr.acknowledgementLetterUrl ? (
                              <TouchableOpacity
                                style={styles.yearDownloadBtn}
                                onPress={() => handleDownloadYearLetter(item, yr)}
                                disabled={isYrDownloading}
                                activeOpacity={0.85}
                              >
                                {isYrDownloading ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" style={{ transform: [{ scale: 0.7 }] }} />
                                ) : (
                                  <Download size={12} color="#FFFFFF" />
                                )}
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* Action Buttons */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.viewDocsBtn}
                  onPress={() => setDetailModalItem(item)}
                  activeOpacity={0.7}
                >
                  <FileText size={14} color={colors.text} style={{ marginRight: 5 }} />
                  <Text style={styles.viewDocsBtnText}>Details</Text>
                </TouchableOpacity>

                {/* Legacy single-year download */}
                {isApproved && item.acknowledgementLetterUrl && !hasYearRecords ? (
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => handleDownloadLegacyLetter(item)}
                    disabled={downloadingId === item.id}
                    activeOpacity={0.85}
                  >
                    {downloadingId === item.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Download size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                        <Text style={styles.downloadBtnText}>Download</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : isRejected ? (
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

      {/* Detail Bottom Sheet Modal */}
      <Modal
        visible={!!detailModalItem}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {detailModalItem?.companyName}
                  </Text>
                  <Text style={styles.modalSubtitle}>Filing Details & Documents</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailModalItem(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Info Summary */}
              <View style={styles.detailSummaryBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tracking ID</Text>
                  <Text style={styles.detailValue}>{detailModalItem?.trackingId}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entity Type</Text>
                  <Text style={styles.detailValue}>{getTypeName(detailModalItem?.companyType || "")}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reg Number</Text>
                  <Text style={styles.detailValue}>{detailModalItem?.registrationNumber}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Filing Year(s)</Text>
                  <Text style={styles.detailValue}>{detailModalItem ? getFilingYearsDisplay(detailModalItem) : "N/A"}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Officer</Text>
                  <Text style={styles.detailValue}>
                    {detailModalItem?.designeeFullName} ({detailModalItem?.designeeRole})
                  </Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount Paid</Text>
                  <Text style={[styles.detailValue, { fontWeight: "800", color: colors.primary }]}>
                    ₦{Number(detailModalItem?.amountPaid || 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Submitted Documents */}
              <Text style={styles.docsModalSectionTitle}>Submitted Documents</Text>
              <View style={styles.docsListContainer}>
                <View style={styles.docItemRow}>
                  <View style={styles.docItemLeft}>
                    <FileText size={18} color={colors.primary} style={{ marginRight: 10 }} />
                    <View>
                      <Text style={styles.docItemTitle}>
                        {detailModalItem?.documentType === "STATUS_REPORT" ? "Status Report" : "CAC Certificate"}
                      </Text>
                      <Text style={styles.docItemMeta}>Verification document</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.openFileBtn}
                    onPress={() => handleOpenFile(detailModalItem?.documentUrl)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.openFileBtnText}>Open</Text>
                    <ExternalLink size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>

                {detailModalItem?.designeeSignatureUrl ? (
                  <View style={styles.docItemRow}>
                    <View style={styles.docItemLeft}>
                      <FileText size={18} color={colors.primary} style={{ marginRight: 10 }} />
                      <View>
                        <Text style={styles.docItemTitle}>Officer Signature</Text>
                        <Text style={styles.docItemMeta}>Authorizing signature</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.openFileBtn}
                      onPress={() => handleOpenFile(detailModalItem?.designeeSignatureUrl)}
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
                onPress={() => setDetailModalItem(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
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
                <Text style={styles.modalTitle}>Filing Rejected</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFailedModalItem(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.failedBox}>
              <Text style={styles.failedReasonLabel}>Reason for Rejection:</Text>
              <Text style={styles.failedReasonText}>
                {failedModalItem?.rejectionReason ||
                  "The filing was not accepted. Please contact support for details."}
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
  regNumText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    marginLeft: 6,
  },
  trackingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  trackingPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackingPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  yearsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  yearsPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
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
  statusApproved: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusApprovedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  statusQueried: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  statusQueriedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  statusRejected: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusRejectedText: {
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  feeText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  penaltyTag: {
    fontSize: 9,
    fontWeight: "600",
    color: "#D97706",
    marginTop: 1,
  },
  queryReasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 12,
  },
  queryReasonText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 15,
  },
  rejectedReasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 12,
  },
  rejectedReasonText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#991B1B",
    lineHeight: 15,
  },
  expandToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(200, 45, 117, 0.04)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.12)",
    marginBottom: 8,
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  yearRecordsContainer: {
    gap: 6,
    marginBottom: 12,
  },
  yearRecordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  yearRecordLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  yearRecordYear: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    minWidth: 40,
  },
  yearStatusApproved: {
    flexDirection: "row",
    alignItems: "center",
  },
  yearStatusApprovedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  yearStatusPending: {
    flexDirection: "row",
    alignItems: "center",
  },
  yearStatusPendingText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
  },
  yearPenaltyText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#D97706",
    marginTop: 1,
  },
  yearDownloadBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
  detailSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    maxWidth: "55%",
    textAlign: "right",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 8,
  },
  docsModalSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
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
