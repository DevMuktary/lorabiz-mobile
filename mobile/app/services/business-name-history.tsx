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
  Alert,
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
  Trash2,
  Edit3,
  ChevronRight,
  ShieldAlert,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

export interface ProprietorRecord {
  id: string;
  surname: string;
  firstName: string;
  otherName?: string | null;
  email?: string | null;
  phone: string;
  gender: string;
  dob: string;
  state: string;
  lga: string;
  city: string;
  streetNo?: string | null;
  serviceAddress: string;
  ninUrl?: string | null;
  passportUrl?: string | null;
  signatureUrl?: string | null;
}

export interface BusinessNameRecord {
  id: string;
  trackingId?: string | null;
  userId: string;
  proposedName: string;
  altName1?: string | null;
  altName2?: string | null;
  ownershipType?: string | null;
  entityType: string;
  category: string;
  specificNature: string;
  status: "UNSUBMITTED" | "PENDING" | "QUERIED" | "APPROVED" | "FAILED";
  queryReason?: string | null;
  queryStatus?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  certificateUrl?: string | null;
  statusReportUrl?: string | null;
  companyEmail?: string | null;
  companyState?: string | null;
  companyCity?: string | null;
  companyStreetNo?: string | null;
  companyAddress?: string | null;
  commencementDate?: string | null;
  createdAt: string;
  updatedAt: string;
  proprietors?: ProprietorRecord[];
  _appType?: string;
}

type FilterStatus = "ALL" | "DRAFTS" | "PENDING" | "APPROVED" | "QUERIED";

export default function BusinessNameHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<BusinessNameRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  // Modals & Actions
  const [detailModalItem, setDetailModalItem] = useState<BusinessNameRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  const fetchHistory = useCallback(async () => {
    try {
      // Query dashboard route for all user registrations
      const res = await api.get<any>("/api/dashboard?type=BUSINESS_NAME&limit=100");
      if (res?.tableData) {
        // Filter explicitly to business names
        const bizOnly = res.tableData.filter(
          (item: any) => item._appType === "BUSINESS_NAME" || item.ownershipType !== undefined
        );
        setHistory(bizOnly);
      }
    } catch {
      // Keep existing list if network drops
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

  // Delete Draft Handler
  const handleDeleteDraft = (item: BusinessNameRecord) => {
    setAlertConfig({
      visible: true,
      type: "warning",
      title: "Delete Draft?",
      message: `Are you sure you want to permanently delete the draft for "${item.proposedName}"? This action cannot be undone.`,
      confirmText: "Yes, Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        try {
          const res = await api.delete<any>(`/api/cac/delete?id=${item.id}`);
          if (res?.success) {
            setHistory((prev) => prev.filter((r) => r.id !== item.id));
          } else {
            Alert.alert("Error", res?.message || "Failed to delete draft.");
          }
        } catch {
          Alert.alert("Network Error", "Could not delete draft. Please try again.");
        }
      },
    });
  };

  // Download PDF Handler
  const handleDownload = async (url: string, filename: string, recordId: string) => {
    setDownloadingId(recordId);
    try {
      await downloadAndSharePdf({ source: url, filename });
    } catch (err: any) {
      Alert.alert("Download Notice", "Opening document in your browser...");
      await WebBrowser.openBrowserAsync(url);
    } finally {
      setDownloadingId(null);
    }
  };

  // Filtered List Computation
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Search matching
      const matchesSearch =
        !searchQuery.trim() ||
        item.proposedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.trackingId && item.trackingId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.registrationNumber && item.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Tab filtering
      if (statusFilter === "ALL") return true;
      if (statusFilter === "DRAFTS") return item.status === "UNSUBMITTED";
      if (statusFilter === "PENDING") return item.status === "PENDING";
      if (statusFilter === "APPROVED") return item.status === "APPROVED";
      if (statusFilter === "QUERIED") return item.status === "QUERIED";

      return true;
    });
  }, [history, searchQuery, statusFilter]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: history.length,
      drafts: history.filter((h) => h.status === "UNSUBMITTED").length,
      pending: history.filter((h) => h.status === "PENDING").length,
      approved: history.filter((h) => h.status === "APPROVED").length,
      queried: history.filter((h) => h.status === "QUERIED").length,
    };
  }, [history]);

  const renderItem = ({ item }: { item: BusinessNameRecord }) => {
    const isDraft = item.status === "UNSUBMITTED";
    const isPending = item.status === "PENDING";
    const isApproved = item.status === "APPROVED";
    const isQueried = item.status === "QUERIED";

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.iconBadge,
                isDraft && styles.iconBadgeDraft,
                isPending && styles.iconBadgePending,
                isApproved && styles.iconBadgeApproved,
                isQueried && styles.iconBadgeQueried,
              ]}
            >
              <Store
                size={18}
                color={
                  isApproved
                    ? "#10B981"
                    : isPending
                    ? colors.primary
                    : isQueried
                    ? "#EF4444"
                    : colors.textMuted
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName} numberOfLines={1}>
                {item.proposedName}
              </Text>
              <Text style={styles.trackingText}>
                {item.trackingId ? `REF: ${item.trackingId}` : `ID: ${item.id.substring(0, 8)}`}
              </Text>
            </View>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isDraft && styles.statusBadgeDraft,
              isPending && styles.statusBadgePending,
              isApproved && styles.statusBadgeApproved,
              isQueried && styles.statusBadgeQueried,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isDraft && styles.statusBadgeTextDraft,
                isPending && styles.statusBadgeTextPending,
                isApproved && styles.statusBadgeTextApproved,
                isQueried && styles.statusBadgeTextQueried,
              ]}
            >
              {isDraft ? "DRAFT" : isPending ? "IN PROGRESS" : isApproved ? "APPROVED" : "QUERIED"}
            </Text>
          </View>
        </View>

        {/* Card Body Info */}
        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Ownership:</Text>
            <Text style={styles.metaValue}>
              {item.ownershipType === "SOLE" ? "Sole Proprietor" : "Partnership"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Nature:</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {item.specificNature || item.category || "General"}
            </Text>
          </View>

          {isApproved && (
            <>
              {item.registrationNumber && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>BN Number:</Text>
                  <Text style={[styles.metaValue, { color: "#10B981", fontWeight: "800" }]}>
                    {item.registrationNumber}
                  </Text>
                </View>
              )}
              {item.taxId && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>TIN:</Text>
                  <Text style={[styles.metaValue, { fontWeight: "800" }]}>{item.taxId}</Text>
                </View>
              )}
            </>
          )}

          {isQueried && item.queryReason && (
            <View style={styles.queryReasonBox}>
              <ShieldAlert size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={styles.queryReasonTitle}>Query Notice from CAC:</Text>
                <Text style={styles.queryReasonText}>{item.queryReason}</Text>
              </View>
            </View>
          )}

          {isPending && (
            <View style={styles.turnaroundBox}>
              <Clock size={14} color={colors.primary} />
              <Text style={styles.turnaroundText}>Turnaround: 1 – 48 Working Hours</Text>
            </View>
          )}
        </View>

        {/* Card Footer Actions */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>
            {new Date(item.updatedAt || item.createdAt).toLocaleDateString("en-NG", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>

          <View style={styles.actionButtonsRow}>
            {/* DRAFT ACTIONS */}
            {isDraft && (
              <>
                <TouchableOpacity
                  style={styles.deleteDraftBtn}
                  onPress={() => handleDeleteDraft(item)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Trash2 size={15} color="#EF4444" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.continueDraftBtn}
                  onPress={() => router.push(`/services/business-name?draftId=${item.id}` as any)}
                >
                  <Edit3 size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.continueDraftBtnText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}

            {/* QUERIED ACTIONS */}
            {isQueried && (
              <TouchableOpacity
                style={[styles.continueDraftBtn, { backgroundColor: "#EF4444" }]}
                onPress={() => router.push(`/services/business-name?draftId=${item.id}` as any)}
              >
                <Edit3 size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.continueDraftBtnText}>Resolve Query</Text>
              </TouchableOpacity>
            )}

            {/* APPROVED ACTIONS */}
            {isApproved && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {item.certificateUrl && (
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    disabled={downloadingId === `${item.id}_cert`}
                    onPress={() =>
                      handleDownload(
                        item.certificateUrl!,
                        `${item.proposedName.replace(/\s+/g, "_")}_Certificate.pdf`,
                        `${item.id}_cert`
                      )
                    }
                  >
                    {downloadingId === `${item.id}_cert` ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Download size={13} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.downloadBtnText}>Certificate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {item.statusReportUrl && (
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    disabled={downloadingId === `${item.id}_report`}
                    onPress={() =>
                      handleDownload(
                        item.statusReportUrl!,
                        `${item.proposedName.replace(/\s+/g, "_")}_StatusReport.pdf`,
                        `${item.id}_report`
                      )
                    }
                  >
                    {downloadingId === `${item.id}_report` ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <FileText size={13} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.downloadBtnText}>Status Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* VIEW SUMMARY BUTTON */}
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => setDetailModalItem(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.detailsBtnText}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Fixed Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Business Name Filings</Text>

        <TouchableOpacity
          onPress={() => router.push("/services/business-name" as any)}
          style={styles.newRegBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={16} color="#FFFFFF" style={{ marginRight: 2 }} />
          <Text style={styles.newRegBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by business name or REF..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs Row */}
      <View style={styles.tabScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {[
            { key: "ALL", label: `All (${counts.all})` },
            { key: "DRAFTS", label: `Drafts (${counts.drafts})` },
            { key: "PENDING", label: `In Progress (${counts.pending})` },
            { key: "APPROVED", label: `Approved (${counts.approved})` },
            { key: "QUERIED", label: `Queried (${counts.queried})` },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setStatusFilter(tab.key as FilterStatus)}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Registrations List */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <BrandLoader message="Loading business registrations..." />
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Store size={48} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={styles.emptyStateTitle}>No Business Names Found</Text>
              <Text style={styles.emptyStateDesc}>
                {searchQuery
                  ? "No registration matches your search criteria."
                  : statusFilter === "DRAFTS"
                  ? "You have no saved drafts."
                  : "You have not submitted any CAC Business Name registrations yet."}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.push("/services/business-name" as any)}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyActionBtnText}>Register a Business Name</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ========================================================================= */}
      {/* STRUCTURED DETAIL MODAL                                                   */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(detailModalItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                  {detailModalItem?.proposedName}
                </Text>
                <Text style={styles.modalHeaderSub}>
                  {detailModalItem?.trackingId
                    ? `REF: ${detailModalItem.trackingId}`
                    : `ID: ${detailModalItem?.id.substring(0, 8)}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalItem(null)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator style={styles.modalScroll}>
              {/* Status Section */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>STATUS</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Application Status:</Text>
                  <Text style={[styles.modalValue, { fontWeight: "800", color: colors.primary }]}>
                    {detailModalItem?.status}
                  </Text>
                </View>
                {detailModalItem?.registrationNumber && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>BN Number:</Text>
                    <Text style={[styles.modalValue, { fontWeight: "800", color: "#10B981" }]}>
                      {detailModalItem.registrationNumber}
                    </Text>
                  </View>
                )}
                {detailModalItem?.taxId && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Tax ID (TIN):</Text>
                    <Text style={[styles.modalValue, { fontWeight: "800" }]}>{detailModalItem.taxId}</Text>
                  </View>
                )}
              </View>

              {/* Company Details */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>COMPANY DETAILS</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Category:</Text>
                  <Text style={styles.modalValue}>{detailModalItem?.category}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Nature of Business:</Text>
                  <Text style={styles.modalValue}>{detailModalItem?.specificNature}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Ownership Type:</Text>
                  <Text style={styles.modalValue}>
                    {detailModalItem?.ownershipType === "SOLE" ? "Sole Proprietorship" : "Partnership"}
                  </Text>
                </View>
                {detailModalItem?.companyEmail && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Company Email:</Text>
                    <Text style={styles.modalValue}>{detailModalItem.companyEmail}</Text>
                  </View>
                )}
                {detailModalItem?.commencementDate && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Commencement Date:</Text>
                    <Text style={styles.modalValue}>{detailModalItem.commencementDate}</Text>
                  </View>
                )}
                {detailModalItem?.companyAddress && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Principal Address:</Text>
                    <Text style={styles.modalValue}>{detailModalItem.companyAddress}</Text>
                  </View>
                )}
              </View>

              {/* Proprietors */}
              {detailModalItem?.proprietors && detailModalItem.proprietors.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>PROPRIETORS</Text>
                  {detailModalItem.proprietors.map((p, idx) => (
                    <View key={p.id} style={styles.propDetailCard}>
                      <Text style={styles.propDetailName}>
                        {idx + 1}. {p.surname} {p.firstName} {p.otherName}
                      </Text>
                      <Text style={styles.propDetailSub}>{p.email} • {p.phone}</Text>
                      <Text style={styles.propDetailSub}>{p.city}, {p.state}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Global Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  newRegBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newRegBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  searchBarContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  tabScrollContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeDraft: {
    backgroundColor: "#F3F4F6",
  },
  iconBadgePending: {
    backgroundColor: "#EFF6FF",
  },
  iconBadgeApproved: {
    backgroundColor: "#ECFDF5",
  },
  iconBadgeQueried: {
    backgroundColor: "#FEF2F2",
  },
  companyName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  trackingText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeDraft: {
    backgroundColor: "#F3F4F6",
  },
  statusBadgePending: {
    backgroundColor: "#DBEAFE",
  },
  statusBadgeApproved: {
    backgroundColor: "#D1FAE5",
  },
  statusBadgeQueried: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusBadgeTextDraft: {
    color: colors.textMuted,
  },
  statusBadgeTextPending: {
    color: "#1E40AF",
  },
  statusBadgeTextApproved: {
    color: "#065F46",
  },
  statusBadgeTextQueried: {
    color: "#991B1B",
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  turnaroundBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginTop: 6,
  },
  turnaroundText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  queryReasonBox: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  queryReasonTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#991B1B",
  },
  queryReasonText: {
    fontSize: 11,
    color: "#B91C1C",
    marginTop: 2,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  cardDate: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteDraftBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  continueDraftBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  continueDraftBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  downloadBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  detailsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  emptyStateDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 12,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  modalHeaderSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  modalValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  propDetailCard: {
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  propDetailName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  propDetailSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
