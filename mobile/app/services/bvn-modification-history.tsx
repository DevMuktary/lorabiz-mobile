import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Download,
  Copy,
  Check,
  RotateCw,
  WifiOff,
  User,
  Phone,
  Calendar,
  Building,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

export interface BvnModificationRecord {
  id: string;
  trackingId: string;
  type: string;
  modificationCategory?: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";
  enrollingBank?: string | null;
  nin?: string | null;
  bvn: string;
  currentFullName: string;
  oldFirstName?: string | null;
  oldLastName?: string | null;
  oldMiddleName?: string | null;
  modifyName: boolean;
  modifyPhone: boolean;
  modifyDob: boolean;
  newFirstName?: string | null;
  newLastName?: string | null;
  newMiddleName?: string | null;
  currentPhone?: string | null;
  newPhone?: string | null;
  currentDob?: string | null;
  newDob?: string | null;
  yearsDifference?: number | null;
  surchargeApplied?: boolean;
  surchargeAmount?: number | null;
  documentUrls?: string[];
  adminNotes?: string | null;
  rejectionReason?: string | null;
  slipUrl?: string | null;
  amountPaid: number;
  refundAmount?: number | null;
  isRefunded?: boolean;
  transactionRef: string;
  createdAt: string;
  updatedAt?: string;
}

const ENROLLING_BANK_LABELS: Record<string, string> = {
  AGENCY_BVN: "Agency BVN",
  ENTERPRISE: "Enterprise Bank",
  AGRICULTURAL_BANK: "Agricultural Bank",
  NIBSS_IMPORT: "NIBSS IMPORT",
  HERITAGE_BANK: "Heritage Bank",
  MICROFINANCE_BANK: "Microfinance Bank",
};

const CATEGORY_LABELS: Record<string, string> = {
  CHANGE_OF_NAME: "Change of Name",
  CHANGE_OF_DOB: "Change of Date of Birth (DOB)",
  CHANGE_OF_PHONE: "Change of Phone Number",
  CHANGE_OF_NAME_PHONE: "Change of Name & Phone",
  CHANGE_OF_DOB_PHONE: "Change of DOB & Phone",
  CHANGE_OF_NAME_DOB: "Change of Name & DOB",
  CHANGE_OF_ALL: "Change of Name, DOB & Phone",
};

type FilterTab = "ALL" | "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";

export default function BvnModificationHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [records, setRecords] = useState<BvnModificationRecord[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    rejected: number;
  }>({ total: 0, pending: 0, processing: 0, completed: 0, rejected: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Details Modal
  const [selectedRecord, setSelectedRecord] = useState<BvnModificationRecord | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Custom Branded Alert Modal State
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

  const loadHistory = async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await api.get("/api/bvn/modification/history");
      if (data && data.success) {
        setRecords(data.requests || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        setErrorMsg(data?.message || "Failed to load BVN modification history.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to connect to server. Please check your network.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const getApplicantName = (item: BvnModificationRecord): string => {
    const newParts = [item.newFirstName, item.newMiddleName, item.newLastName].filter(Boolean);
    if (newParts.length > 0) return newParts.join(" ");

    const oldParts = [item.oldFirstName, item.oldMiddleName, item.oldLastName].filter(Boolean);
    if (oldParts.length > 0) return oldParts.join(" ");

    if (item.currentFullName && item.currentFullName.trim()) {
      return item.currentFullName.trim();
    }
    return "N/A";
  };

  const getOldNameOnBvn = (item: BvnModificationRecord): string => {
    const oldParts = [item.oldFirstName, item.oldMiddleName, item.oldLastName].filter(Boolean);
    if (oldParts.length > 0) return oldParts.join(" ");
    if (item.currentFullName && item.currentFullName.trim()) {
      return item.currentFullName.trim();
    }
    return "N/A";
  };

  const getCategoryLabel = (item: BvnModificationRecord): string => {
    const key = item.modificationCategory || item.type;
    return CATEGORY_LABELS[key] || key.replace(/_/g, " ");
  };

  const getBankName = (bankKey?: string | null): string => {
    if (!bankKey) return "Enrolled Bank";
    return ENROLLING_BANK_LABELS[bankKey] || bankKey;
  };

  const maskIdentifier = (val?: string | null): string => {
    if (!val || val.length < 6) return val || "—";
    return `${val.slice(0, 3)}•••••${val.slice(-3)}`;
  };

  // Filter and search
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (activeFilter !== "ALL" && rec.status !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const applicantName = getApplicantName(rec).toLowerCase();
        const matchTracking = rec.trackingId.toLowerCase().includes(q);
        const matchBvn = (rec.bvn || "").includes(q);
        const matchNin = (rec.nin || "").includes(q);
        const matchBank = (rec.enrollingBank || "").toLowerCase().includes(q);
        const matchCategory = getCategoryLabel(rec).toLowerCase().includes(q);
        const matchApplicant = applicantName.includes(q);
        return matchTracking || matchBvn || matchNin || matchBank || matchCategory || matchApplicant;
      }
      return true;
    });
  }, [records, activeFilter, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadSlip = async (url: string, trackingId: string) => {
    if (!url) return;
    setDownloadingId(trackingId);
    try {
      const lowerUrl = url.toLowerCase();
      const ext = lowerUrl.includes(".png")
        ? "png"
        : lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")
        ? "jpg"
        : "pdf";
      const filename = `BVN_Modification_${trackingId}_${Date.now()}.${ext}`;

      const res = await downloadAndSharePdf({
        source: url,
        filename,
        dialogTitle: `BVN Modification Slip - ${trackingId}`,
      });
      setDownloadingId(null);

      if (!res.success) {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Download Failed",
          message: res.error || "Unable to download BVN modification slip.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setDownloadingId(null);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Error",
        message: err?.message || "An error occurred while saving the modification slip.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderStatusBadge = (status: BvnModificationRecord["status"]) => {
    if (status === "COMPLETED") {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeCompleted]}>
          <CheckCircle2 size={11} color="#059669" style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, styles.statusTextCompleted]}>COMPLETED</Text>
        </View>
      );
    }
    if (status === "REJECTED") {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeRejected]}>
          <AlertCircle size={11} color="#DC2626" style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, styles.statusTextRejected]}>REJECTED</Text>
        </View>
      );
    }
    if (status === "PROCESSING") {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeProcessing]}>
          <RotateCw size={11} color="#0284C7" style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, styles.statusTextProcessing]}>PROCESSING</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.statusBadgePending]}>
        <Clock size={11} color="#D97706" style={{ marginRight: 4 }} />
        <Text style={[styles.statusBadgeText, styles.statusTextPending]}>PENDING</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Top Navigation Bar */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BVN Orders</Text>
        <TouchableOpacity
          onPress={() => loadHistory(true)}
          style={styles.refreshBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RotateCw size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <BrandLoader inline visible message="Loading BVN orders..." />
        </View>
      ) : errorMsg && records.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.offlineIconBox}>
            <WifiOff size={38} color="#94A3B8" />
          </View>
          <Text style={styles.offlineTitle}>Unable to Load Orders</Text>
          <Text style={styles.offlineSubtitle}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadHistory()}
            activeOpacity={0.88}
          >
            <RotateCw size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Header Banner */}
          <View style={styles.bannerWrap}>
            <View style={styles.bannerCard}>
              <View style={styles.bannerHeader}>
                <View style={styles.badgeAgency}>
                  <Text style={styles.badgeAgencyText}>NIBSS BVN SERVICE</Text>
                </View>
                <View style={styles.turnaroundPill}>
                  <Clock size={11} color="#1E3A8A" style={{ marginRight: 4 }} />
                  <Text style={styles.turnaroundPillText}>72 Hours – 7 Working Days</Text>
                </View>
              </View>
              <Text style={styles.bannerTitle}>BVN Modification History</Text>
              <Text style={styles.bannerSubtitle}>
                Track submitted modifications, verify enrolling bank status, and download approved slips or snapshots.
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tracking ID, BVN, NIN, or name..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <X size={15} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterPillsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
              {(["ALL", "PENDING", "PROCESSING", "COMPLETED", "REJECTED"] as FilterTab[]).map((tab) => {
                const isActive = activeFilter === tab;
                const count =
                  tab === "ALL"
                    ? records.length
                    : tab === "PENDING"
                    ? stats.pending
                    : tab === "PROCESSING"
                    ? stats.processing
                    : tab === "COMPLETED"
                    ? stats.completed
                    : stats.rejected;

                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => setActiveFilter(tab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                      {tab === "ALL" ? "All Orders" : tab} {count > 0 ? `(${count})` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Orders List */}
          <FlatList
            data={filteredRecords}
            keyExtractor={(item) => item.id || item.trackingId}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 32 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadHistory(true)}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconBox}>
                  <FileText size={32} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No BVN Modification Orders</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery || activeFilter !== "ALL"
                    ? "No orders match your current search or filter."
                    : "You haven't submitted any BVN modification requests yet."}
                </Text>
                {!searchQuery && activeFilter === "ALL" ? (
                  <TouchableOpacity
                    style={styles.newRequestBtn}
                    onPress={() => router.push("/services/bvn-modification" as any)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.newRequestBtnText}>Submit New BVN Modification</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const isItemDownloading = downloadingId === item.trackingId;

              return (
                <TouchableOpacity
                  style={styles.orderCard}
                  onPress={() => setSelectedRecord(item)}
                  activeOpacity={0.85}
                >
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.enrollingBankBadge}>
                      <Building size={11} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.enrollingBankBadgeText} numberOfLines={1}>
                        {getBankName(item.enrollingBank)}
                      </Text>
                    </View>
                    {renderStatusBadge(item.status)}
                  </View>

                  {/* Tracking ID Row */}
                  <View style={styles.trackingRow}>
                    <TouchableOpacity
                      style={styles.trackingPill}
                      onPress={() => handleCopy(item.trackingId, item.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.trackingText}>{item.trackingId}</Text>
                      {copiedId === item.id ? (
                        <Check size={11} color={colors.success} style={{ marginLeft: 4 }} />
                      ) : (
                        <Copy size={11} color={colors.primary} style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                  </View>

                  {/* Category Title */}
                  <View style={styles.categoryWrap}>
                    <Text style={styles.categoryTitle}>{getCategoryLabel(item)}</Text>
                  </View>

                  {/* Card Body Details */}
                  <View style={styles.cardBody}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Applicant:</Text>
                      <Text style={[styles.detailValue, styles.applicantNameText]} numberOfLines={1}>
                        {getApplicantName(item)}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Target BVN:</Text>
                      <Text style={[styles.detailValue, styles.fontMono]}>
                        {maskIdentifier(item.bvn)}
                      </Text>
                    </View>

                    {item.nin ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Linked NIN:</Text>
                        <Text style={[styles.detailValue, styles.fontMono]}>
                          {maskIdentifier(item.nin)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount Paid:</Text>
                      <Text style={[styles.detailValue, { color: colors.primary, fontWeight: "700" }]}>
                        ₦{item.amountPaid.toLocaleString()}
                      </Text>
                    </View>

                    {item.adminNotes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesLabel}>Verification Note:</Text>
                        <Text style={styles.notesText} numberOfLines={2}>
                          {item.adminNotes}
                        </Text>
                      </View>
                    ) : null}

                    {item.rejectionReason ? (
                      <View style={styles.rejectionBox}>
                        <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                        <Text style={styles.rejectionText} numberOfLines={2}>
                          {item.rejectionReason}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.viewDetailsBtn}
                      onPress={() => setSelectedRecord(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.viewDetailsBtnText}>View Full Details</Text>
                      <ChevronRight size={13} color={colors.primary} />
                    </TouchableOpacity>

                    {item.status === "COMPLETED" && item.slipUrl ? (
                      <TouchableOpacity
                        style={styles.downloadSlipBtn}
                        onPress={() => handleDownloadSlip(item.slipUrl!, item.trackingId)}
                        activeOpacity={0.85}
                        disabled={isItemDownloading}
                      >
                        {isItemDownloading ? (
                          <BrandLoader inline visible message="" size={13} />
                        ) : (
                          <>
                            <Download size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                            <Text style={styles.downloadSlipBtnText}>Download Slip</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Inspection Details Modal */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Modification Breakdown</Text>
                <Text style={styles.modalSubtitle}>Submitted Request & Verification Status</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedRecord(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Status & Tracking Bar */}
                <View style={styles.modalStatusRow}>
                  <TouchableOpacity
                    style={styles.modalTrackingPill}
                    onPress={() => handleCopy(selectedRecord.trackingId, "modal-track")}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalTrackingId}>{selectedRecord.trackingId}</Text>
                    {copiedId === "modal-track" ? (
                      <Check size={12} color={colors.success} style={{ marginLeft: 4 }} />
                    ) : (
                      <Copy size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                    )}
                  </TouchableOpacity>
                  {renderStatusBadge(selectedRecord.status)}
                </View>

                {/* Status Guidance Alert */}
                {selectedRecord.status === "PENDING" && (
                  <View style={[styles.statusAlertBox, styles.statusAlertPending]}>
                    <Clock size={16} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusAlertTitle}>Queued for Verification</Text>
                      <Text style={styles.statusAlertText}>
                        Your modification has been received and queued with NIBSS. Turnaround window is 72 Hours – 7 Working Days.
                      </Text>
                    </View>
                  </View>
                )}

                {selectedRecord.status === "PROCESSING" && (
                  <View style={[styles.statusAlertBox, styles.statusAlertProcessing]}>
                    <RotateCw size={16} color="#0284C7" style={{ marginRight: 8, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusAlertTitle}>NIBSS Processing Underway</Text>
                      <Text style={styles.statusAlertText}>
                        Biometric registration records are being updated with the enrolling bank.
                      </Text>
                    </View>
                  </View>
                )}

                {selectedRecord.status === "COMPLETED" && (
                  <View style={[styles.statusAlertBox, styles.statusAlertCompleted]}>
                    <CheckCircle2 size={16} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusAlertTitle}>Modification Approved & Applied</Text>
                      <Text style={styles.statusAlertText}>
                        BVN biometric records have been successfully updated on the central register. Download your verified slip below.
                      </Text>
                    </View>
                  </View>
                )}

                {selectedRecord.status === "REJECTED" && (
                  <View style={[styles.statusAlertBox, styles.statusAlertRejected]}>
                    <AlertCircle size={16} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusAlertTitle}>Request Rejected</Text>
                      <Text style={styles.statusAlertText}>
                        {selectedRecord.rejectionReason || "Could not be processed due to verification constraints."}
                      </Text>
                      {selectedRecord.isRefunded && (
                        <Text style={[styles.statusAlertText, { marginTop: 4, fontWeight: "700", color: "#B91C1C" }]}>
                          Refunded: ₦{(selectedRecord.refundAmount || selectedRecord.amountPaid).toLocaleString()} returned to wallet.
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Enrolling Bank & Service Details */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Registration Overview</Text>
                </View>

                <View style={styles.modalSummaryBox}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Applicant Name (on BVN)</Text>
                    <Text style={[styles.summaryItemValue, { fontWeight: "800", color: colors.text }]}>
                      {getOldNameOnBvn(selectedRecord)}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  {(selectedRecord.modifyName || selectedRecord.newFirstName || selectedRecord.newLastName) && (
                    <>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>Requested New Name</Text>
                        <Text style={[styles.summaryItemValue, { fontWeight: "800", color: "#059669" }]}>
                          {[selectedRecord.newFirstName, selectedRecord.newMiddleName, selectedRecord.newLastName].filter(Boolean).join(" ")}
                        </Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                    </>
                  )}

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Service Category</Text>
                    <Text style={[styles.summaryItemValue, { fontWeight: "700" }]}>
                      {getCategoryLabel(selectedRecord)}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Enrolling Bank</Text>
                    <View style={styles.bankTag}>
                      <Building size={11} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.bankTagText}>
                        {getBankName(selectedRecord.enrollingBank)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>BVN Number</Text>
                    <TouchableOpacity
                      onPress={() => handleCopy(selectedRecord.bvn, "modal-bvn")}
                      style={styles.inlineCopyRow}
                    >
                      <Text style={[styles.summaryItemValue, styles.fontMono]}>
                        {selectedRecord.bvn}
                      </Text>
                      <Copy size={11} color={colors.textMuted} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  {selectedRecord.nin ? (
                    <>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>Linked NIN</Text>
                        <TouchableOpacity
                          onPress={() => handleCopy(selectedRecord.nin!, "modal-nin")}
                          style={styles.inlineCopyRow}
                        >
                          <Text style={[styles.summaryItemValue, styles.fontMono]}>
                            {selectedRecord.nin}
                          </Text>
                          <Copy size={11} color={colors.textMuted} style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.summaryItemDivider} />
                    </>
                  ) : null}

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Submitted At</Text>
                    <Text style={styles.summaryItemValue}>{formatDate(selectedRecord.createdAt)}</Text>
                  </View>
                </View>

                {/* Before & After Comparison Table */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Submitted Changes Comparison</Text>
                </View>

                <View style={styles.comparisonContainer}>
                  {/* Name Changes if modified */}
                  {(selectedRecord.modifyName || selectedRecord.newFirstName || selectedRecord.newLastName) && (
                    <View style={styles.comparisonBlock}>
                      <View style={styles.comparisonBlockHeader}>
                        <User size={13} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.comparisonBlockTitle}>Full Name Modification</Text>
                      </View>
                      <View style={styles.comparisonGrid}>
                        <View style={styles.comparisonColOld}>
                          <Text style={styles.comparisonColTagOld}>OLD ON RECORD</Text>
                          <Text style={styles.comparisonOldText}>
                            {[selectedRecord.oldFirstName, selectedRecord.oldMiddleName, selectedRecord.oldLastName].filter(Boolean).join(" ") ||
                              selectedRecord.currentFullName ||
                              "—"}
                          </Text>
                        </View>
                        <View style={styles.comparisonColNew}>
                          <Text style={styles.comparisonColTagNew}>REQUESTED NEW</Text>
                          <Text style={styles.comparisonNewText}>
                            {[selectedRecord.newFirstName, selectedRecord.newMiddleName, selectedRecord.newLastName].filter(Boolean).join(" ") ||
                              "—"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Name displayed when not modified */}
                  {!selectedRecord.modifyName && !selectedRecord.newFirstName && !selectedRecord.newLastName && (
                    <View style={styles.comparisonBlock}>
                      <View style={styles.comparisonBlockHeader}>
                        <User size={13} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.comparisonBlockTitle}>Applicant Name on BVN</Text>
                      </View>
                      <View style={{ padding: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                          {getOldNameOnBvn(selectedRecord)}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                          Name on BVN record remains unchanged for this request.
                        </Text>
                      </View>
                    </View>
                  )}


                  {/* Phone Changes */}
                  {(selectedRecord.modifyPhone || selectedRecord.newPhone) && (
                    <View style={styles.comparisonBlock}>
                      <View style={styles.comparisonBlockHeader}>
                        <Phone size={13} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.comparisonBlockTitle}>Phone Number Modification</Text>
                      </View>
                      <View style={styles.comparisonGrid}>
                        <View style={styles.comparisonColOld}>
                          <Text style={styles.comparisonColTagOld}>OLD ON RECORD</Text>
                          <Text style={[styles.comparisonOldText, styles.fontMono]}>
                            {selectedRecord.currentPhone || "Not Provided"}
                          </Text>
                        </View>
                        <View style={styles.comparisonColNew}>
                          <Text style={styles.comparisonColTagNew}>REQUESTED NEW</Text>
                          <Text style={[styles.comparisonNewText, styles.fontMono]}>
                            {selectedRecord.newPhone || "—"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Date of Birth Changes */}
                  {(selectedRecord.modifyDob || selectedRecord.newDob) && (
                    <View style={styles.comparisonBlock}>
                      <View style={styles.comparisonBlockHeader}>
                        <Calendar size={13} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.comparisonBlockTitle}>Date of Birth (DOB) Modification</Text>
                      </View>
                      <View style={styles.comparisonGrid}>
                        <View style={styles.comparisonColOld}>
                          <Text style={styles.comparisonColTagOld}>OLD ON RECORD</Text>
                          <Text style={[styles.comparisonOldText, styles.fontMono]}>
                            {selectedRecord.currentDob || "Not Provided"}
                          </Text>
                        </View>
                        <View style={styles.comparisonColNew}>
                          <Text style={styles.comparisonColTagNew}>REQUESTED NEW</Text>
                          <Text style={[styles.comparisonNewText, styles.fontMono]}>
                            {selectedRecord.newDob || "—"}
                          </Text>
                        </View>
                      </View>
                      {selectedRecord.yearsDifference != null && (
                        <View style={styles.yearsDiffRow}>
                          <Info size={11} color="#475569" style={{ marginRight: 4 }} />
                          <Text style={styles.yearsDiffText}>
                            Age difference: {Math.abs(selectedRecord.yearsDifference).toFixed(1)} years
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Admin Notes */}
                {selectedRecord.adminNotes ? (
                  <View style={styles.modalNoteCard}>
                    <Text style={styles.modalNoteCardTitle}>Admin Review Notes</Text>
                    <Text style={styles.modalNoteCardText}>{selectedRecord.adminNotes}</Text>
                  </View>
                ) : null}

                {/* Verified Slip / Snapshot Download Box */}
                {selectedRecord.slipUrl ? (
                  <View style={styles.slipDownloadCard}>
                    <View style={styles.slipDownloadHeader}>
                      <View style={styles.slipIconBox}>
                        <FileText size={18} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.slipCardTitle}>Verified BVN Slip / Snapshot</Text>
                        <Text style={styles.slipCardSubtitle}>
                          Verified modification proof generated and approved.
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.modalDownloadBtn}
                      onPress={() => handleDownloadSlip(selectedRecord.slipUrl!, selectedRecord.trackingId)}
                      activeOpacity={0.88}
                      disabled={downloadingId === selectedRecord.trackingId}
                    >
                      {downloadingId === selectedRecord.trackingId ? (
                        <BrandLoader inline visible message="Downloading..." size={16} />
                      ) : (
                        <>
                          <Download size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.modalDownloadBtnText}>Download & Share Slip / Snapshot</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Transaction & Billing Box */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Billing & Reference</Text>
                </View>

                <View style={[styles.modalSummaryBox, { marginBottom: 30 }]}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Amount Charged</Text>
                    <Text style={[styles.summaryItemValue, { color: colors.primary, fontWeight: "700" }]}>
                      ₦{selectedRecord.amountPaid.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Transaction Ref</Text>
                    <TouchableOpacity
                      onPress={() => handleCopy(selectedRecord.transactionRef, "modal-ref")}
                      style={styles.inlineCopyRow}
                    >
                      <Text style={[styles.summaryItemValue, styles.fontMono, { fontSize: 11 }]}>
                        {selectedRecord.transactionRef}
                      </Text>
                      <Copy size={11} color={colors.textMuted} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Alert Modal */}
      <CustomAlertModal {...alertConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
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
  refreshBtn: {
    padding: 6,
    borderRadius: 10,
  },

  /* Banner Card */
  bannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  bannerCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  badgeAgency: {
    backgroundColor: "rgba(10, 49, 97, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAgencyText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.4,
  },
  turnaroundPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  turnaroundPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1E3A8A",
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 16,
  },

  /* Search */
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },

  /* Filter Pills */
  filterPillsRow: {
    paddingBottom: 8,
  },
  filterPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },

  /* List & Cards */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.07)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  enrollingBankBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10, 49, 97, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    maxWidth: "65%",
  },
  enrollingBankBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.primary,
  },
  trackingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  trackingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackingText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
    color: colors.text,
  },
  dateText: {
    fontSize: 10.5,
    color: colors.textMuted,
  },
  categoryWrap: {
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.text,
  },
  cardBody: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    gap: 5,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  applicantNameText: {
    maxWidth: "65%",
  },
  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  notesBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#3B82F6",
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1E40AF",
    marginBottom: 1,
  },
  notesText: {
    fontSize: 11,
    color: "#1E3A8A",
    lineHeight: 14,
  },
  rejectionBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#DC2626",
  },
  rejectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 1,
  },
  rejectionText: {
    fontSize: 11,
    color: "#B91C1C",
    lineHeight: 14,
  },

  /* Card Actions */
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    gap: 8,
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginRight: 2,
  },
  downloadSlipBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 8,
  },
  downloadSlipBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Status Badges */
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  statusBadgeCompleted: {
    backgroundColor: "#ECFDF5",
  },
  statusTextCompleted: {
    color: "#059669",
  },
  statusBadgeProcessing: {
    backgroundColor: "#F0F9FF",
  },
  statusTextProcessing: {
    color: "#0284C7",
  },
  statusBadgePending: {
    backgroundColor: "#FFFBEB",
  },
  statusTextPending: {
    color: "#D97706",
  },
  statusBadgeRejected: {
    backgroundColor: "#FEF2F2",
  },
  statusTextRejected: {
    color: "#DC2626",
  },

  /* Empty State */
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  newRequestBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newRequestBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Offline Center Container */
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  offlineIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  offlineSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Details Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modalStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTrackingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modalTrackingId: {
    fontSize: 12.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
    color: colors.text,
  },

  /* Status Alerts */
  statusAlertBox: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusAlertPending: {
    backgroundColor: "#FFFBEB",
    borderLeftWidth: 4,
    borderLeftColor: "#D97706",
  },
  statusAlertProcessing: {
    backgroundColor: "#F0F9FF",
    borderLeftWidth: 4,
    borderLeftColor: "#0284C7",
  },
  statusAlertCompleted: {
    backgroundColor: "#ECFDF5",
    borderLeftWidth: 4,
    borderLeftColor: "#059669",
  },
  statusAlertRejected: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
  },
  statusAlertTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  statusAlertText: {
    fontSize: 11.5,
    color: "#475569",
    lineHeight: 16,
  },

  sectionHeader: {
    marginBottom: 8,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  modalSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summaryItemLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryItemValue: {
    fontSize: 12.5,
    color: colors.text,
  },
  summaryItemDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  bankTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bankTagText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.primary,
  },
  inlineCopyRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  /* Comparison Section */
  comparisonContainer: {
    gap: 10,
    marginBottom: 14,
  },
  comparisonBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  comparisonBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  comparisonBlockTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.text,
  },
  comparisonGrid: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
  },
  comparisonColOld: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  comparisonColTagOld: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  comparisonOldText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  comparisonColNew: {
    flex: 1,
    backgroundColor: "#F0FDF4",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  comparisonColTagNew: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#16A34A",
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  comparisonNewText: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "700",
  },
  yearsDiffRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  yearsDiffText: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "500",
  },

  modalNoteCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    marginBottom: 14,
  },
  modalNoteCardTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#0369A1",
    marginBottom: 3,
  },
  modalNoteCardText: {
    fontSize: 12,
    color: "#0C4A6E",
    lineHeight: 16,
  },

  /* Slip / Snapshot Download Card */
  slipDownloadCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 16,
  },
  slipDownloadHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  slipIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  slipCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#15803D",
  },
  slipCardSubtitle: {
    fontSize: 11,
    color: "#166534",
    marginTop: 1,
  },
  modalDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalDownloadBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
