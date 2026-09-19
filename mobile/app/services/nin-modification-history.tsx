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
  MapPin,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

export interface ModificationRecord {
  id: string;
  trackingId: string;
  type: "CHANGE_OF_NAME" | "CHANGE_OF_PHONE" | "CHANGE_OF_ADDRESS";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";
  nin: string;
  ninMasked?: string;
  currentPhone?: string | null;
  newFirstName?: string | null;
  newLastName?: string | null;
  newMiddleName?: string | null;
  currentFullName?: string | null;
  newPhoneNumber?: string | null;
  newAddress?: string | null;
  newState?: string | null;
  newLga?: string | null;
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

const TYPE_CONFIG: Record<string, { label: string; icon: any }> = {
  CHANGE_OF_NAME: { label: "Change of Name", icon: User },
  CHANGE_OF_PHONE: { label: "Change of Phone", icon: Phone },
  CHANGE_OF_ADDRESS: { label: "Change of Address", icon: MapPin },
};

type FilterTab = "ALL" | "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";

export default function NinModificationHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [records, setRecords] = useState<ModificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Details Modal
  const [selectedRecord, setSelectedRecord] = useState<ModificationRecord | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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
      const data = await api.get("/api/nin/modification/history");
      if (data && data.success) {
        setRecords(data.requests || []);
      } else {
        setErrorMsg(data?.message || "Failed to load modification history.");
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

  // Extract human-readable applicant name from record
  const getApplicantName = (item: ModificationRecord): string => {
    if (item.type === "CHANGE_OF_NAME") {
      const parts = [item.newFirstName, item.newMiddleName, item.newLastName].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(" ");
      }
    }
    if (item.currentFullName && item.currentFullName.trim()) {
      return item.currentFullName.trim();
    }
    if (item.newFirstName || item.newLastName) {
      return [item.newFirstName, item.newLastName].filter(Boolean).join(" ");
    }
    return "N/A";
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
        const matchNin = (rec.nin || "").includes(q);
        const matchType = (rec.type || "").toLowerCase().includes(q);
        const matchApplicant = applicantName.includes(q);
        return matchTracking || matchNin || matchType || matchApplicant;
      }
      return true;
    });
  }, [records, activeFilter, searchQuery]);

  const handleCopyTracking = (trackingId: string) => {
    setCopiedId(trackingId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadSlip = async (url: string, trackingId: string) => {
    if (!url) return;
    setIsDownloading(true);
    try {
      const filename = `NIN_Modification_${trackingId}_${Date.now()}.pdf`;
      const res = await downloadAndSharePdf({
        source: url,
        filename,
        dialogTitle: `NIN Modification Slip - ${trackingId}`,
      });
      setIsDownloading(false);

      if (!res.success) {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Download Failed",
          message: res.error || "Unable to download modification slip.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch {
      setIsDownloading(false);
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

  const renderStatusBadge = (status: ModificationRecord["status"]) => {
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
      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modification Orders</Text>
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
          <BrandLoader inline visible message="Loading orders..." />
        </View>
      ) : errorMsg && records.length === 0 ? (
        /* Full-Screen Offline / Error State */
        <View style={styles.centerContainer}>
          <View style={styles.offlineIconBox}>
            <WifiOff size={38} color="#94A3B8" />
          </View>
          <Text style={styles.offlineTitle}>No Internet Connection</Text>
          <Text style={styles.offlineSubtitle}>
            Unable to connect to LoraBiz servers. Please check your network and try again.
          </Text>
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
          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search applicant name, NIN, or tracking ID..."
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
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => setActiveFilter(tab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                      {tab === "ALL" ? "All Orders" : tab}
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
              { paddingBottom: Math.max(insets.bottom, 16) + 24 },
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
                <Text style={styles.emptyTitle}>No Modification Orders</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery || activeFilter !== "ALL"
                    ? "No modification orders match your current search or filter."
                    : "You haven't submitted any NIN modification requests yet."}
                </Text>
                {!searchQuery && activeFilter === "ALL" ? (
                  <TouchableOpacity
                    style={styles.newRequestBtn}
                    onPress={() => router.push("/services/nin-modification" as any)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.newRequestBtnText}>Submit New Modification</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const typeCfg = TYPE_CONFIG[item.type] || { label: item.type, icon: FileText };
              const IconComp = typeCfg.icon;

              return (
                <TouchableOpacity
                  style={styles.orderCard}
                  onPress={() => setSelectedRecord(item)}
                  activeOpacity={0.8}
                >
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <TouchableOpacity
                      style={styles.trackingPill}
                      onPress={() => handleCopyTracking(item.trackingId)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.trackingText}>{item.trackingId}</Text>
                      {copiedId === item.trackingId ? (
                        <Check size={11} color={colors.success} style={{ marginLeft: 4 }} />
                      ) : (
                        <Copy size={11} color={colors.primary} style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                    {renderStatusBadge(item.status)}
                  </View>

                  {/* Card Body */}
                  <View style={styles.cardBody}>
                    <View style={styles.typeRow}>
                      <View style={styles.typeIconWrap}>
                        <IconComp size={15} color={colors.primary} />
                      </View>
                      <Text style={styles.typeTitle}>{typeCfg.label}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Applicant:</Text>
                      <Text style={[styles.detailValue, styles.applicantNameText]} numberOfLines={1}>
                        {getApplicantName(item)}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Target NIN:</Text>
                      <Text style={[styles.detailValue, styles.fontMono]}>
                        {item.ninMasked || item.nin}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount Paid:</Text>
                      <Text style={[styles.detailValue, { color: colors.primary }]}>
                        ₦{item.amountPaid.toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Submitted On:</Text>
                      <Text style={styles.detailValue}>{formatDate(item.createdAt)}</Text>
                    </View>

                    {item.adminNotes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesLabel}>NIMC Officer Note:</Text>
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

                  {/* Action Link */}
                  {item.status === "COMPLETED" && item.slipUrl ? (
                    <TouchableOpacity
                      style={styles.downloadSlipBtn}
                      onPress={() => handleDownloadSlip(item.slipUrl!, item.trackingId)}
                      activeOpacity={0.8}
                    >
                      <Download size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.downloadSlipBtnText}>Download Slip</Text>
                    </TouchableOpacity>
                  ) : null}
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.modalStatusRow}>
                  <Text style={styles.modalTrackingId}>{selectedRecord.trackingId}</Text>
                  {renderStatusBadge(selectedRecord.status)}
                </View>

                <View style={styles.modalSummaryBox}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Service Type</Text>
                    <Text style={styles.summaryItemValue}>
                      {TYPE_CONFIG[selectedRecord.type]?.label || selectedRecord.type}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Applicant</Text>
                    <Text style={[styles.summaryItemValue, { fontWeight: "700" }]}>
                      {getApplicantName(selectedRecord)}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>NIN</Text>
                    <Text style={[styles.summaryItemValue, styles.fontMono]}>
                      {selectedRecord.nin}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  {/* Specific Fields */}
                  {selectedRecord.type === "CHANGE_OF_NAME" ? (
                    <>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>New First Name</Text>
                        <Text style={styles.summaryItemValue}>{selectedRecord.newFirstName || "—"}</Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>New Surname</Text>
                        <Text style={styles.summaryItemValue}>{selectedRecord.newLastName || "—"}</Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                      {selectedRecord.newMiddleName ? (
                        <>
                          <View style={styles.summaryItem}>
                            <Text style={styles.summaryItemLabel}>New Middle Name</Text>
                            <Text style={styles.summaryItemValue}>{selectedRecord.newMiddleName}</Text>
                          </View>
                          <View style={styles.summaryItemDivider} />
                        </>
                      ) : null}
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>Registered Mobile</Text>
                        <Text style={[styles.summaryItemValue, styles.fontMono]}>
                          {selectedRecord.currentPhone || "—"}
                        </Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                    </>
                  ) : null}

                  {selectedRecord.type === "CHANGE_OF_PHONE" ? (
                    <>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>Full Name on NIN</Text>
                        <Text style={styles.summaryItemValue}>{selectedRecord.currentFullName || "—"}</Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>New Mobile Number</Text>
                        <Text style={[styles.summaryItemValue, styles.fontMono, { color: colors.primary }]}>
                          {selectedRecord.newPhoneNumber || "—"}
                        </Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                    </>
                  ) : null}

                  {selectedRecord.type === "CHANGE_OF_ADDRESS" ? (
                    <>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>Registered Name</Text>
                        <Text style={styles.summaryItemValue}>{selectedRecord.currentFullName || "—"}</Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>Registered Phone</Text>
                        <Text style={[styles.summaryItemValue, styles.fontMono]}>
                          {selectedRecord.currentPhone || "—"}
                        </Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>New Address</Text>
                        <Text style={styles.summaryItemValue}>{selectedRecord.newAddress || "—"}</Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryItemLabel}>State & LGA</Text>
                        <Text style={styles.summaryItemValue}>
                          {selectedRecord.newState} • {selectedRecord.newLga}
                        </Text>
                      </View>
                      <View style={styles.summaryItemDivider} />
                    </>
                  ) : null}

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Amount Charged</Text>
                    <Text style={[styles.summaryItemValue, { color: colors.primary }]}>
                      ₦{selectedRecord.amountPaid.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Transaction Ref</Text>
                    <Text style={[styles.summaryItemValue, styles.fontMono, { fontSize: 11 }]}>
                      {selectedRecord.transactionRef}
                    </Text>
                  </View>
                  <View style={styles.summaryItemDivider} />

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Created Date</Text>
                    <Text style={styles.summaryItemValue}>{formatDate(selectedRecord.createdAt)}</Text>
                  </View>
                </View>

                {selectedRecord.adminNotes ? (
                  <View style={styles.modalNoteCard}>
                    <Text style={styles.modalNoteCardTitle}>Admin Review Notes</Text>
                    <Text style={styles.modalNoteCardText}>{selectedRecord.adminNotes}</Text>
                  </View>
                ) : null}

                {selectedRecord.rejectionReason ? (
                  <View style={styles.modalRejectionCard}>
                    <Text style={styles.modalRejectionCardTitle}>Rejection Reason</Text>
                    <Text style={styles.modalRejectionCardText}>{selectedRecord.rejectionReason}</Text>
                  </View>
                ) : null}

                {selectedRecord.status === "COMPLETED" && selectedRecord.slipUrl ? (
                  <TouchableOpacity
                    style={styles.modalDownloadBtn}
                    onPress={() => handleDownloadSlip(selectedRecord.slipUrl!, selectedRecord.trackingId)}
                    activeOpacity={0.88}
                  >
                    <Download size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.modalDownloadBtnText}>Download Modification Slip (PDF)</Text>
                  </TouchableOpacity>
                ) : null}
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

  /* Search */
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },

  /* List Content */
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
  },
  trackingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trackingText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  statusBadgeProcessing: {
    backgroundColor: "rgba(2, 132, 199, 0.12)",
  },
  statusBadgeCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  statusBadgeRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  statusTextPending: { color: "#D97706" },
  statusTextProcessing: { color: "#0284C7" },
  statusTextCompleted: { color: "#059669" },
  statusTextRejected: { color: "#DC2626" },

  cardBody: {
    gap: 5,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  typeIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  typeTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.text,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
  },
  applicantNameText: {
    fontWeight: "800",
    color: colors.text,
    fontSize: 13,
    maxWidth: "65%",
    textAlign: "right",
  },
  notesBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  rejectionBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 2,
  },
  rejectionText: {
    fontSize: 11.5,
    color: "#991B1B",
  },
  downloadSlipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  downloadSlipBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* Empty State */
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 28,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  newRequestBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  newRequestBtnText: {
    fontSize: 13,
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

  /* Details Modal */
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
  modalScroll: {
    marginBottom: 10,
  },
  modalStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTrackingId: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    marginBottom: 14,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryItemDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginVertical: 4,
  },
  summaryItemLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryItemValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
  },
  modalNoteCard: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  modalNoteCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  modalNoteCardText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  modalRejectionCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  modalRejectionCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 4,
  },
  modalRejectionCardText: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 16,
  },
  modalDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  modalDownloadBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
