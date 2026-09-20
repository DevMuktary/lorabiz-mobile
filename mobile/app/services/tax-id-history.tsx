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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
  Download,
  Building,
  User,
  FileText,
  ShieldAlert,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

export interface TaxIdRecord {
  id: string;
  type: "INDIVIDUAL" | "CORPORATE";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
  updatedAt: string;
  firstName?: string | null;
  lastName?: string | null;
  nin?: string | null;
  dob?: string | null;
  cacNumber?: string | null;
  corporateCategory?: string | null;
  taxIdNumber?: string | null;
  taxIdImageUrl?: string | null;
  failureReason?: string | null;
  amountPaid: number | string;
  transactionRef: string;
}

type FilterStatus = "ALL" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function TaxIdHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<TaxIdRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const fetchHistory = useCallback(async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.get<any>("/api/tax-id");
      if (res && res.success && Array.isArray(res.history)) {
        setHistory(res.history);
      } else if (Array.isArray(res)) {
        setHistory(res);
      }
    } catch (err: any) {
      console.warn("Error fetching Tax ID history:", err);
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

  const handleDownload = async (item: TaxIdRecord) => {
    if (!item.taxIdImageUrl) return;

    setDownloadingId(item.id);
    try {
      const filename = `Tax_ID_${item.taxIdNumber || item.transactionRef}.jpg`;
      const result = await downloadAndSharePdf({
        source: item.taxIdImageUrl,
        filename,
        dialogTitle: "Save / Share Tax ID Certificate",
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

  const filteredData = useMemo(() => {
    return history.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;

      if (!matchesStatus) return false;
      if (!q) return true;

      const targetText = [
        item.firstName,
        item.lastName,
        item.nin,
        item.cacNumber,
        item.corporateCategory,
        item.taxIdNumber,
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
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const renderStatusBadge = (status: TaxIdRecord["status"]) => {
    switch (status) {
      case "COMPLETED":
        return (
          <View style={[styles.badge, styles.badgeCompleted]}>
            <CheckCircle2 size={10} color="#059669" style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, styles.badgeTextCompleted]}>COMPLETED</Text>
          </View>
        );
      case "PROCESSING":
        return (
          <View style={[styles.badge, styles.badgeProcessing]}>
            <RotateCw size={10} color="#2563EB" style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, styles.badgeTextProcessing]}>PROCESSING</Text>
          </View>
        );
      case "FAILED":
        return (
          <View style={[styles.badge, styles.badgeFailed]}>
            <AlertCircle size={10} color="#DC2626" style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, styles.badgeTextFailed]}>FAILED</Text>
          </View>
        );
      case "PENDING":
      default:
        return (
          <View style={[styles.badge, styles.badgePending]}>
            <Clock size={10} color="#D97706" style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, styles.badgeTextPending]}>PENDING</Text>
          </View>
        );
    }
  };

  const renderCard = ({ item }: { item: TaxIdRecord }) => {
    const isCorp = item.type === "CORPORATE";
    const primaryName = isCorp
      ? item.cacNumber || "Corporate Entity"
      : [item.firstName, item.lastName].filter(Boolean).join(" ") || "Individual Applicant";

    const secondaryInfo = isCorp
      ? item.corporateCategory || "Business / LLC"
      : item.nin ? `NIN: ${item.nin}` : "Individual TIN";

    return (
      <View style={styles.card}>
        {/* Card Top Row */}
        <View style={styles.cardHeader}>
          <View style={styles.typeRow}>
            <View style={[styles.typeIconBox, isCorp ? styles.typeIconBoxCorp : styles.typeIconBoxInd]}>
              {isCorp ? (
                <Building size={12} color={colors.primary} />
              ) : (
                <User size={12} color="#0284C7" />
              )}
            </View>
            <Text style={styles.typeLabel}>{isCorp ? "CORPORATE" : "INDIVIDUAL"}</Text>
          </View>
          {renderStatusBadge(item.status)}
        </View>

        {/* Target Entity / Person */}
        <View style={styles.entityRow}>
          <Text style={styles.entityName} numberOfLines={1}>
            {primaryName}
          </Text>
          <Text style={styles.entitySub}>{secondaryInfo}</Text>
        </View>

        {/* Reference & Date Strip */}
        <View style={styles.metaRow}>
          <TouchableOpacity
            style={styles.refButton}
            onPress={() => handleCopy(item.transactionRef, `ref-${item.id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.refText}>{item.transactionRef}</Text>
            {copiedId === `ref-${item.id}` ? (
              <Check size={11} color="#059669" style={{ marginLeft: 4 }} />
            ) : (
              <Copy size={11} color="#94A3B8" style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* COMPLETED: Generated Tax ID Box */}
        {item.status === "COMPLETED" && (
          <View style={styles.resultBox}>
            <View style={styles.resultTopRow}>
              <Text style={styles.resultLabel}>Tax Identification Number (TIN)</Text>
              <TouchableOpacity
                onPress={() => item.taxIdNumber && handleCopy(item.taxIdNumber, `tin-${item.id}`)}
                style={styles.copyPill}
                activeOpacity={0.7}
              >
                {copiedId === `tin-${item.id}` ? (
                  <>
                    <Check size={11} color="#059669" style={{ marginRight: 3 }} />
                    <Text style={styles.copyPillTextCopied}>Copied</Text>
                  </>
                ) : (
                  <>
                    <Copy size={11} color={colors.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.copyPillText}>Copy TIN</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.tinNumberText} selectable>
              {item.taxIdNumber || "TIN Issued"}
            </Text>

            {/* Direct Certificate Download Button */}
            {item.taxIdImageUrl ? (
              <TouchableOpacity
                style={styles.directDownloadBtn}
                onPress={() => handleDownload(item)}
                disabled={downloadingId === item.id}
                activeOpacity={0.88}
              >
                {downloadingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Download size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.directDownloadBtnText}>Download Tax Certificate</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* FAILED: Failure Explanation */}
        {item.status === "FAILED" && (
          <View style={styles.failedBox}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
              <ShieldAlert size={12} color="#DC2626" style={{ marginRight: 4 }} />
              <Text style={styles.failedTitle}>Request Unsuccessful</Text>
            </View>
            <Text style={styles.failedText}>
              {item.failureReason || "Could not be processed due to verification constraints. Please check your details."}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Tax ID (TIN) History</Text>
          <View style={{ width: 36 }} />
        </View>
        <BrandLoader message="Loading Tax ID history..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Tax ID (TIN) History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Main Container */}
      <View style={{ flex: 1 }}>
        {/* Branded Header Banner (Matching other services) */}
        <View style={styles.bannerWrap}>
          <View style={styles.bannerCard}>
            <View style={styles.bannerHeader}>
              <View style={styles.badgeAgency}>
                <Text style={styles.badgeAgencyText}>NIGERIA REVENUE SERVICE</Text>
              </View>
              <View style={styles.turnaroundPill}>
                <Clock size={11} color="#475569" style={{ marginRight: 4 }} />
                <Text style={styles.turnaroundPillText}>Turnaround Time: 1 – 24 Working Hours</Text>
              </View>
            </View>
            <Text style={styles.bannerTitle}>Tax ID (TIN) Records</Text>
            <Text style={styles.bannerSubtitle}>
              Track submitted applications, copy generated Tax Identification Numbers, and download certificates.
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, CAC, or TIN..."
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

        {/* Filter Pills with Counts (No ugly metric boxes) */}
        <View style={styles.filterPillsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            {(["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"] as FilterStatus[]).map((tab) => {
              const isActive = statusFilter === tab;
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

              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setStatusFilter(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {tab === "ALL" ? "All Orders" : tab.charAt(0) + tab.slice(1).toLowerCase()}{" "}
                    {count > 0 ? `(${count})` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Orders FlatList */}
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 32 },
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <FileText size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Tax ID Requests Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== "ALL"
                  ? "No applications matched your search filters."
                  : "You haven't submitted any Tax ID (TIN) requests yet."}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/services/tax-id" as any)}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyBtnText}>Generate Tax ID</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

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
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  newBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  bannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bannerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badgeAgency: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badgeAgencyText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },
  turnaroundPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  turnaroundPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  filterPillsRow: {
    marginVertical: 10,
  },
  filterPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
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
    color: "#64748B",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  typeIconBoxInd: {
    backgroundColor: "#E0F2FE",
  },
  typeIconBoxCorp: {
    backgroundColor: "#EEF2FF",
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeCompleted: {
    backgroundColor: "#ECFDF5",
  },
  badgeProcessing: {
    backgroundColor: "#EFF6FF",
  },
  badgePending: {
    backgroundColor: "#FEF3C7",
  },
  badgeFailed: {
    backgroundColor: "#FEF2F2",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeTextCompleted: {
    color: "#059669",
  },
  badgeTextProcessing: {
    color: "#2563EB",
  },
  badgeTextPending: {
    color: "#D97706",
  },
  badgeTextFailed: {
    color: "#DC2626",
  },
  entityRow: {
    marginBottom: 8,
  },
  entityName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  entitySub: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  refButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  refText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  dateText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },
  resultBox: {
    marginTop: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  copyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  copyPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },
  copyPillTextCopied: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
  },
  tinNumberText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#15803D",
    letterSpacing: 1.5,
    marginVertical: 4,
  },
  directDownloadBtn: {
    height: 40,
    backgroundColor: "#15803D",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  directDownloadBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  failedBox: {
    marginTop: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  failedTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B91C1C",
  },
  failedText: {
    fontSize: 11,
    color: "#991B1B",
    lineHeight: 15,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
