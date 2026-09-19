import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StatusBar,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCw,
  X,
  Plus,
  ShieldCheck,
  Download,
  FileText,
  User,
  Phone,
  Wallet,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

export interface BvnRetrievalRecord {
  id: string;
  trackingId: string;
  fullName: string;
  phone: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  retrievedBvn?: string | null;
  slipUrl?: string | null;
  failureReason?: string | null;
  adminNotes?: string | null;
  amountPaid: number;
  refundAmount?: number | null;
  isRefunded?: boolean;
  transactionRef: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

type FilterTab = "ALL" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function BvnRetrievalHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [records, setRecords] = useState<BvnRetrievalRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");

  // Selected Record for Details Modal
  const [activeModalRecord, setActiveModalRecord] = useState<BvnRetrievalRecord | null>(null);

  // Copy tracking / feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Custom Alert Modal
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

  const fetchHistory = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.get<{
        success: boolean;
        history?: BvnRetrievalRecord[];
      }>("/api/bvn/retrieval");

      if (res && res.success && Array.isArray(res.history)) {
        setRecords(res.history);
      }
    } catch (err: any) {
      console.error("Failed to fetch BVN Retrieval history:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCopy = (text: string, id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadSlip = async (slipUrl: string, bvn: string, id: string) => {
    setDownloadingId(id);
    try {
      const filename = `BVN_Slip_${bvn || id}.pdf`;
      const res = await downloadAndSharePdf({
        source: slipUrl,
        filename,
        dialogTitle: "Download BVN Slip",
      });
      if (!res.success) {
        setAlertConfig({
          visible: true,
          type: "error",
          title: "Download Failed",
          message: "Unable to download BVN slip. Please verify your internet connection.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Error",
        message: err?.message || "An error occurred while saving the slip.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    return {
      all: records.length,
      pending: records.filter((r) => r.status === "PENDING").length,
      processing: records.filter((r) => r.status === "PROCESSING").length,
      completed: records.filter((r) => r.status === "COMPLETED").length,
      failed: records.filter((r) => r.status === "FAILED").length,
    };
  }, [records]);

  // Filter and search
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.fullName?.toLowerCase().includes(query) ||
        item.phone?.toLowerCase().includes(query) ||
        item.trackingId?.toLowerCase().includes(query) ||
        item.transactionRef?.toLowerCase().includes(query) ||
        (item.retrievedBvn && item.retrievedBvn.toLowerCase().includes(query));

      const matchesStatus = activeFilter === "ALL" || item.status === activeFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, activeFilter]);

  const renderStatusBadge = (status: BvnRetrievalRecord["status"]) => {
    switch (status) {
      case "COMPLETED":
        return (
          <View style={[styles.statusBadge, styles.statusBadgeCompleted]}>
            <CheckCircle2 size={11} color="#059669" style={{ marginRight: 4 }} />
            <Text style={styles.statusTextCompleted}>COMPLETED</Text>
          </View>
        );
      case "PROCESSING":
        return (
          <View style={[styles.statusBadge, styles.statusBadgeProcessing]}>
            <Clock size={11} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={styles.statusTextProcessing}>PROCESSING</Text>
          </View>
        );
      case "PENDING":
        return (
          <View style={[styles.statusBadge, styles.statusBadgePending]}>
            <Clock size={11} color="#D97706" style={{ marginRight: 4 }} />
            <Text style={styles.statusTextPending}>PENDING</Text>
          </View>
        );
      case "FAILED":
        return (
          <View style={[styles.statusBadge, styles.statusBadgeFailed]}>
            <AlertCircle size={11} color="#DC2626" style={{ marginRight: 4 }} />
            <Text style={styles.statusTextFailed}>FAILED</Text>
          </View>
        );
    }
  };

  const renderItem = ({ item }: { item: BvnRetrievalRecord }) => {
    const formattedDate = new Date(item.createdAt).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => setActiveModalRecord(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTrackingWrap}>
            <Text style={styles.cardTrackingLabel}>TRACKING ID</Text>
            <Text style={styles.cardTrackingVal}>{item.trackingId}</Text>
          </View>
          {renderStatusBadge(item.status)}
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBody}>
          <View style={styles.cardInfoRow}>
            <User size={13} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.cardName} numberOfLines={1}>
              {item.fullName}
            </Text>
          </View>

          <View style={[styles.cardInfoRow, { marginTop: 4 }]}>
            <Phone size={13} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.cardPhone}>{item.phone}</Text>
          </View>

          {/* Resolved BVN Preview on Card */}
          {item.status === "COMPLETED" && item.retrievedBvn ? (
            <View style={styles.resolvedBvnCardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resolvedBvnLabel}>RETRIEVED BVN</Text>
                <Text style={styles.resolvedBvnValue}>{item.retrievedBvn}</Text>
              </View>

              <TouchableOpacity
                style={styles.cardCopyBtn}
                onPress={() => handleCopy(item.retrievedBvn!, item.id)}
                activeOpacity={0.7}
              >
                {copiedId === item.id ? (
                  <Check size={14} color="#059669" />
                ) : (
                  <Copy size={14} color={colors.primary} />
                )}
                <Text style={styles.cardCopyBtnText}>
                  {copiedId === item.id ? "Copied" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>{formattedDate}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {item.status === "COMPLETED" && item.slipUrl ? (
              <TouchableOpacity
                style={styles.quickSlipBtn}
                onPress={() =>
                  handleDownloadSlip(item.slipUrl!, item.retrievedBvn || item.trackingId, item.id)
                }
                disabled={downloadingId === item.id}
                activeOpacity={0.8}
              >
                {downloadingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Download size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.quickSlipBtnText}>Slip</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => setActiveModalRecord(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewBtnText}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>BVN Retrieval History</Text>
          <Text style={styles.headerSubtitle}>Track your BVN recovery requests</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/services/bvn-retrieval" as any)}
          style={styles.newBtn}
          activeOpacity={0.85}
        >
          <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBox}>
          <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name, phone, tracking ID..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {(["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"] as FilterTab[]).map((tab) => {
            const count =
              tab === "ALL"
                ? stats.all
                : tab === "PENDING"
                ? stats.pending
                : tab === "PROCESSING"
                ? stats.processing
                : tab === "COMPLETED"
                ? stats.completed
                : stats.failed;

            const isActive = activeFilter === tab;

            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveFilter(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                  {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <BrandLoader inline visible message="Loading retrieval records..." />
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <ShieldCheck size={36} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? "No Matching Records" : "No Retrieval Requests Yet"}
          </Text>
          <Text style={styles.emptySub}>
            {searchQuery
              ? `No requests match "${searchQuery}". Try a different name or tracking ID.`
              : "You have not submitted any BVN retrieval requests yet."}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push("/services/bvn-retrieval" as any)}
              activeOpacity={0.88}
            >
              <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>Retrieve a BVN Now</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchHistory(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Record Details Modal */}
      {activeModalRecord && (
        <Modal
          visible={Boolean(activeModalRecord)}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModalRecord(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Retrieval Details</Text>
                  <Text style={styles.modalSub}>Tracking: {activeModalRecord.trackingId}</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveModalRecord(null)}>
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                {/* Status Callout Box */}
                <View style={styles.modalStatusBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={styles.modalStatusLabel}>CURRENT STATUS</Text>
                    {renderStatusBadge(activeModalRecord.status)}
                  </View>
                  <Text style={styles.modalStatusDesc}>
                    {activeModalRecord.status === "COMPLETED"
                      ? "Your BVN has been successfully retrieved from NIBSS central database."
                      : activeModalRecord.status === "PROCESSING"
                      ? "Your request is actively being processed by a NIBSS operator."
                      : activeModalRecord.status === "PENDING"
                      ? "Your request is queued and awaiting operator verification."
                      : "Your retrieval could not be completed. The fee has been refunded to your wallet."}
                  </Text>
                </View>

                {/* Resolved BVN Highlight Card (When COMPLETED) */}
                {activeModalRecord.status === "COMPLETED" && activeModalRecord.retrievedBvn && (
                  <View style={styles.bvnHighlightBox}>
                    <Text style={styles.bvnHighlightLabel}>OFFICIAL 11-DIGIT BVN</Text>
                    <Text style={styles.bvnHighlightNumber}>{activeModalRecord.retrievedBvn}</Text>

                    <TouchableOpacity
                      style={styles.bvnCopyButton}
                      onPress={() => handleCopy(activeModalRecord.retrievedBvn!, "modal-bvn")}
                      activeOpacity={0.8}
                    >
                      {copiedId === "modal-bvn" ? (
                        <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      ) : (
                        <Copy size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      )}
                      <Text style={styles.bvnCopyButtonText}>
                        {copiedId === "modal-bvn" ? "Copied to Clipboard!" : "Copy BVN"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Download Slip Action (When slipUrl exists) */}
                {activeModalRecord.slipUrl ? (
                  <View style={styles.slipDownloadBox}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slipDownloadTitle}>Digital BVN Verification Slip</Text>
                      <Text style={styles.slipDownloadSub}>
                        Official PDF slip / snapshot available for download.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.slipDownloadBtn}
                      onPress={() =>
                        handleDownloadSlip(
                          activeModalRecord.slipUrl!,
                          activeModalRecord.retrievedBvn || activeModalRecord.trackingId,
                          activeModalRecord.id
                        )
                      }
                      disabled={downloadingId === activeModalRecord.id}
                      activeOpacity={0.88}
                    >
                      {downloadingId === activeModalRecord.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Download size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.slipDownloadBtnText}>Download & Share</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Failure Reason (When FAILED) */}
                {activeModalRecord.status === "FAILED" && (
                  <View style={styles.failureBox}>
                    <AlertCircle size={18} color="#DC2626" style={{ marginRight: 8, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.failureTitle}>Retrieval Failed</Text>
                      <Text style={styles.failureText}>
                        {activeModalRecord.failureReason ||
                          "No BVN record was found matching the provided name and phone number."}
                      </Text>
                      <Text style={styles.refundText}>
                        100% Refund: The service fee has been automatically credited back to your wallet.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Breakdown Details */}
                <View style={styles.breakdownBox}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Full Legal Name</Text>
                    <Text style={[styles.breakdownVal, { fontWeight: "700" }]}>
                      {activeModalRecord.fullName}
                    </Text>
                  </View>

                  <View style={styles.breakdownDivider} />

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Linked Phone</Text>
                    <Text style={[styles.breakdownVal, { fontWeight: "700" }]}>
                      {activeModalRecord.phone}
                    </Text>
                  </View>

                  <View style={styles.breakdownDivider} />

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Transaction Ref</Text>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                      onPress={() => handleCopy(activeModalRecord.transactionRef, "modal-ref")}
                    >
                      <Text style={[styles.breakdownVal, styles.fontMono]}>
                        {activeModalRecord.transactionRef}
                      </Text>
                      <Copy size={12} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.breakdownDivider} />

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Amount Paid</Text>
                    <Text style={[styles.breakdownVal, { color: "#059669", fontWeight: "800" }]}>
                      ₦{Number(activeModalRecord.amountPaid).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.breakdownDivider} />

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Submitted</Text>
                    <Text style={styles.breakdownVal}>
                      {new Date(activeModalRecord.createdAt).toLocaleString("en-NG", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>

                {/* Admin Notes if any */}
                {activeModalRecord.adminNotes ? (
                  <View style={styles.adminNotesBox}>
                    <Text style={styles.adminNotesLabel}>OPERATOR NOTES</Text>
                    <Text style={styles.adminNotesText}>{activeModalRecord.adminNotes}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setActiveModalRecord(null)}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Global Alert Modal */}
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
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  tabsWrap: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 10,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 18,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTrackingWrap: {
    flex: 1,
  },
  cardTrackingLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  cardTrackingVal: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  cardBody: {
    marginBottom: 10,
  },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  cardPhone: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  resolvedBvnCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  resolvedBvnLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#065F46",
    letterSpacing: 0.5,
  },
  resolvedBvnValue: {
    fontSize: 15,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#065F46",
    letterSpacing: 1.5,
  },
  cardCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  cardCopyBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  cardDate: {
    fontSize: 11,
    color: "#94A3B8",
  },
  quickSlipBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  quickSlipBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  viewBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  // Status Badges
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeCompleted: {
    backgroundColor: "#DCFCE7",
  },
  statusTextCompleted: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  statusBadgeProcessing: {
    backgroundColor: "#E0F2FE",
  },
  statusTextProcessing: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0369A1",
  },
  statusBadgePending: {
    backgroundColor: "#FEF3C7",
  },
  statusTextPending: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  statusBadgeFailed: {
    backgroundColor: "#FEE2E2",
  },
  statusTextFailed: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B91C1C",
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
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
    color: "#0F172A",
  },
  modalSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalStatusBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  modalStatusLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  modalStatusDesc: {
    fontSize: 11.5,
    color: "#475569",
    marginTop: 6,
    lineHeight: 16,
  },
  bvnHighlightBox: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  bvnHighlightLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#065F46",
    letterSpacing: 0.6,
  },
  bvnHighlightNumber: {
    fontSize: 24,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#065F46",
    letterSpacing: 3,
    marginVertical: 8,
  },
  bvnCopyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bvnCopyButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  slipDownloadBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  slipDownloadTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E3A8A",
  },
  slipDownloadSub: {
    fontSize: 11,
    color: "#3B82F6",
    marginTop: 2,
  },
  slipDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 10,
  },
  slipDownloadBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  failureBox: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  failureTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#DC2626",
  },
  failureText: {
    fontSize: 11.5,
    color: "#991B1B",
    marginTop: 2,
    lineHeight: 16,
  },
  refundText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    marginTop: 6,
  },
  breakdownBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  breakdownLabel: {
    fontSize: 11.5,
    color: "#64748B",
  },
  breakdownVal: {
    fontSize: 12,
    color: "#0F172A",
  },
  adminNotesBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  adminNotesLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  adminNotesText: {
    fontSize: 11.5,
    color: "#78350F",
    marginTop: 4,
    lineHeight: 16,
  },
  modalCloseBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
