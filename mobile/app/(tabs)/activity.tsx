import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  TextInput,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Copy,
  Check,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Clock,
} from "lucide-react-native";
import { colors } from "../../constants/theme";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

type TxTypeFilter = "ALL" | "PAYMENT" | "DEPOSIT";

type CategoryFilter = "ALL" | "SLIPS" | "CORPORATE" | "UTILITIES" | "WALLET";

interface Transaction {
  id: string;
  reference: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  serviceCategory?: string;
  balanceAfter?: number;
  balanceBefore?: number;
  createdAt: string;
}

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string }[] = [
  { id: "ALL", label: "All Services" },
  { id: "SLIPS", label: "Slips & Identity (NIN & BVN)" },
  { id: "CORPORATE", label: "Corporate & Tax (CAC, TIN, SCUML)" },
  { id: "UTILITIES", label: "Utilities (Airtime, Data, Bills)" },
  { id: "WALLET", label: "Wallet Deposits & Funding" },
];

const DISPUTE_REASONS = [
  "Debited but service not delivered",
  "Double debit on wallet balance",
  "Incorrect amount debited",
  "Payment gateway delayed / pending",
  "Other transaction issue",
];

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeNotes, setDisputeNotes] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeFeedback, setDisputeFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Copy feedback state
  const [copiedRef, setCopiedRef] = useState(false);

  // Fetch paginated transactions from API
  const {
    data: txData,
    refetch: refetchTx,
    isFetching: isTxFetching,
  } = useQuery({
    queryKey: ["mobileAllTransactions", page, typeFilter, categoryFilter, searchQuery],
    queryFn: async () => {
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          type: typeFilter,
          category: categoryFilter,
          search: searchQuery,
        });
        return await api.get(`/api/user/transactions?${queryParams.toString()}`);
      } catch {
        return null;
      }
    },
  });

  const transactions: Transaction[] = txData?.transactions || [];
  const pagination = txData?.pagination || {
    page: 1,
    limit: 15,
    total: transactions.length,
    totalPages: 1,
    hasMore: false,
  };

  const handleCopyRef = (refText: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(refText);
      }
    } catch {
      // fallback
    }
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleOpenDispute = (tx: Transaction) => {
    setDisputeFeedback(null);
    setDisputeNotes("");
    setDisputeReason(DISPUTE_REASONS[0]);
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!selectedTx) return;

    setIsSubmittingDispute(true);
    setDisputeFeedback(null);

    try {
      const res: any = await api.post("/api/user/transactions/dispute", {
        transactionId: selectedTx.id,
        issueType: disputeReason,
        notes: disputeNotes.trim(),
      });

      if (res?.success) {
        setDisputeFeedback({
          type: "success",
          message: res.message || "Dispute submitted. Our review team will investigate within 1 – 24 working hours.",
        });
        refetchTx();
      } else {
        setDisputeFeedback({
          type: "error",
          message: res?.message || "Unable to submit dispute at this time.",
        });
      }
    } catch (err: any) {
      setDisputeFeedback({
        type: "error",
        message: err?.message || "Network error. Please try again.",
      });
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === "CREDIT" || item.type === "DEPOSIT";
    const isSuccess = item.status === "SUCCESS";
    const isPending = item.status === "PENDING";
    const isReversed = item.status === "REVERSED";

    const formattedDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Recent";

    const formattedTime = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString("en-NG", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    return (
      <TouchableOpacity
        style={styles.txCard}
        onPress={() => setSelectedTx(item)}
        activeOpacity={0.7}
      >
        <View style={styles.txCardLeft}>
          <View
            style={[
              styles.txIconWrap,
              {
                backgroundColor: isCredit
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(239, 68, 68, 0.08)",
              },
            ]}
          >
            {isCredit ? (
              <ArrowDownLeft size={18} color={colors.success} />
            ) : (
              <ArrowUpRight size={18} color="#EF4444" />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.txDesc} numberOfLines={1}>
              {item.description || (isCredit ? "Wallet Deposit" : "Service Order")}
            </Text>
            <View style={styles.txMetaRow}>
              <Text style={styles.txDate}>
                {formattedDate} {formattedTime ? `• ${formattedTime}` : ""}
              </Text>
              {item.serviceCategory ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.serviceCategory}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.txRef}>Ref: {item.reference}</Text>
          </View>
        </View>

        <View style={styles.txCardRight}>
          <Text
            style={[
              styles.txAmount,
              { color: isCredit ? colors.success : colors.text },
            ]}
          >
            {isCredit ? "+" : "-"}₦
            {Number(item.amount || 0).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
            })}
          </Text>

          <View style={styles.statusRow}>
            {isSuccess ? (
              <CheckCircle2 size={12} color={colors.success} style={{ marginRight: 3 }} />
            ) : isPending ? (
              <Clock3 size={12} color={colors.warning} style={{ marginRight: 3 }} />
            ) : isReversed ? (
              <RotateCw size={12} color="#8B5CF6" style={{ marginRight: 3 }} />
            ) : (
              <AlertCircle size={12} color={colors.error} style={{ marginRight: 3 }} />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: isSuccess
                    ? colors.success
                    : isPending
                    ? colors.warning
                    : isReversed
                    ? "#8B5CF6"
                    : colors.error,
                },
              ]}
            >
              {item.status || "SUCCESS"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const currentCategoryLabel =
    CATEGORY_OPTIONS.find((c) => c.id === categoryFilter)?.label.split(" (")[0] ||
    "All Services";

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 1. Calm, Centered Standard Top Bar with Back Button */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Transactions</Text>
          <Text style={styles.headerSubtitle}>History & Order Records</Text>
        </View>

        <TouchableOpacity
          onPress={() => refetchTx()}
          style={styles.refreshBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <RotateCw size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 2. Search & Filter Controls */}
      <View style={styles.filterSection}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search description, reference, or amount..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(txt) => {
              setSearchQuery(txt);
              setPage(1);
            }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Controls Row */}
        <View style={styles.controlsRow}>
          {/* Type Filter Pills */}
          <View style={styles.typeFilterGroup}>
            {(["ALL", "PAYMENT", "DEPOSIT"] as TxTypeFilter[]).map((type) => {
              const label =
                type === "ALL"
                  ? "All"
                  : type === "PAYMENT"
                  ? "Payments"
                  : "Deposits";
              const isActive = typeFilter === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typePill, isActive && styles.typePillActive]}
                  onPress={() => {
                    setTypeFilter(type);
                    setPage(1);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.typePillText, isActive && styles.typePillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category Dropdown Pill */}
          <TouchableOpacity
            style={styles.categoryDropdownBtn}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.8}
          >
            <Layers size={13} color={categoryFilter !== "ALL" ? colors.primary : colors.textSecondary} style={{ marginRight: 4 }} />
            <Text
              style={[
                styles.categoryDropdownText,
                categoryFilter !== "ALL" && { color: colors.primary, fontWeight: "700" },
              ]}
              numberOfLines={1}
            >
              {currentCategoryLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Paginated Transactions List with Calibrated Bottom Space */}
      <FlatList
        data={transactions}
        keyExtractor={(item, index) => item.id || item.reference || String(index)}
        renderItem={renderTransactionItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 24 }, // Calibrated bottom padding removes excessive void
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isTxFetching}
            onRefresh={refetchTx}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          transactions.length > 0 ? (
            <View style={styles.paginationBar}>
              <TouchableOpacity
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isTxFetching}
              >
                <ChevronLeft size={16} color={page <= 1 ? colors.textMuted : colors.text} />
                <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>

              <Text style={styles.pageInfoText}>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </Text>

              <TouchableOpacity
                style={[styles.pageBtn, page >= pagination.totalPages && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages || isTxFetching}
              >
                <Text style={[styles.pageBtnText, page >= pagination.totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                <ChevronRight size={16} color={page >= pagination.totalPages ? colors.textMuted : colors.text} />
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isTxFetching ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Clock size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Transactions Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || categoryFilter !== "ALL" || typeFilter !== "ALL"
                  ? "No records matched your selected search or filter criteria."
                  : "Your wallet transactions and service payments will appear here."}
              </Text>
            </View>
          ) : (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )
        }
      />

      {/* =================================================================== */}
      {/* 4. CATEGORY SELECTOR MODAL                                          */}
      {/* =================================================================== */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.categoryModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Filter by Service</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {CATEGORY_OPTIONS.map((opt) => {
              const isSelected = categoryFilter === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.categoryOptionItem, isSelected && styles.categoryOptionItemActive]}
                  onPress={() => {
                    setCategoryFilter(opt.id);
                    setPage(1);
                    setShowCategoryModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryOptionText, isSelected && styles.categoryOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {isSelected && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =================================================================== */}
      {/* 5. FULL TRANSACTION DETAILS MODAL                                   */}
      {/* =================================================================== */}
      <Modal
        visible={!!selectedTx}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalCard}>
            {selectedTx && (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Receipt size={18} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.modalTitle}>Transaction Details</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedTx(null)}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {/* Big Amount Card */}
                  <View style={styles.amountBanner}>
                    <Text
                      style={[
                        styles.bannerAmount,
                        {
                          color:
                            selectedTx.type === "CREDIT" || selectedTx.type === "DEPOSIT"
                              ? colors.success
                              : colors.text,
                        },
                      ]}
                    >
                      {selectedTx.type === "CREDIT" || selectedTx.type === "DEPOSIT" ? "+" : "-"}₦
                      {Number(selectedTx.amount || 0).toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{selectedTx.status}</Text>
                    </View>
                  </View>

                  {/* Detail Rows */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{selectedTx.description}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Service</Text>
                    <Text style={styles.detailValue}>{selectedTx.serviceCategory || "General Wallet"}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedTx.createdAt).toLocaleString("en-NG", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reference</Text>
                    <TouchableOpacity
                      style={styles.refCopyRow}
                      onPress={() => handleCopyRef(selectedTx.reference)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.refText}>{selectedTx.reference}</Text>
                      {copiedRef ? (
                        <Check size={14} color={colors.success} style={{ marginLeft: 6 }} />
                      ) : (
                        <Copy size={14} color={colors.textMuted} style={{ marginLeft: 6 }} />
                      )}
                    </TouchableOpacity>
                  </View>

                  {selectedTx.balanceBefore !== undefined && selectedTx.balanceAfter !== undefined && (
                    <View style={styles.balanceSummaryBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.balanceSubText}>Balance Before</Text>
                        <Text style={styles.balanceValText}>
                          ₦{Number(selectedTx.balanceBefore).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={styles.balanceSubText}>Balance After</Text>
                        <Text style={styles.balanceValText}>
                          ₦{Number(selectedTx.balanceAfter).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Dispute Action Button */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.disputeTriggerBtn}
                    onPress={() => handleOpenDispute(selectedTx)}
                    activeOpacity={0.8}
                  >
                    <ShieldAlert size={16} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.disputeTriggerText}>Report a Dispute</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* 6. DISPUTE REPORTING MODAL                                          */}
      {/* =================================================================== */}
      <Modal
        visible={showDisputeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.disputeModalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ShieldAlert size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.modalTitle}>Report Transaction Dispute</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDisputeModal(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {disputeFeedback ? (
                <View style={styles.disputeFeedbackBox}>
                  {disputeFeedback.type === "success" ? (
                    <CheckCircle2 size={36} color={colors.success} style={{ marginBottom: 12 }} />
                  ) : (
                    <AlertCircle size={36} color={colors.error} style={{ marginBottom: 12 }} />
                  )}
                  <Text style={styles.disputeFeedbackTitle}>
                    {disputeFeedback.type === "success" ? "Dispute Submitted" : "Submission Failed"}
                  </Text>
                  <Text style={styles.disputeFeedbackMsg}>{disputeFeedback.message}</Text>
                  <TouchableOpacity
                    style={styles.feedbackCloseBtn}
                    onPress={() => {
                      setShowDisputeModal(false);
                      setDisputeFeedback(null);
                    }}
                  >
                    <Text style={styles.feedbackCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.disputeSubtext}>
                    Reference:{" "}
                    <Text style={{ fontWeight: "700", color: colors.text }}>
                      {selectedTx?.reference}
                    </Text>
                  </Text>

                  <Text style={styles.fieldLabel}>Select Issue Type</Text>
                  {DISPUTE_REASONS.map((reason) => {
                    const isSelected = disputeReason === reason;
                    return (
                      <TouchableOpacity
                        key={reason}
                        style={[styles.reasonOption, isSelected && styles.reasonOptionActive]}
                        onPress={() => setDisputeReason(reason)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioDotOuter, isSelected && styles.radioDotOuterActive]}>
                          {isSelected && <View style={styles.radioDotInner} />}
                        </View>
                        <Text style={[styles.reasonText, isSelected && styles.reasonTextActive]}>
                          {reason}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Additional Notes (Optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Provide any additional details..."
                    placeholderTextColor={colors.textMuted}
                    value={disputeNotes}
                    onChangeText={setDisputeNotes}
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.disputeTurnaroundNotice}>
                    Our review team will investigate and follow up within 1 – 24 working hours.
                  </Text>

                  <TouchableOpacity
                    style={[styles.submitDisputeBtn, isSubmittingDispute && styles.submitDisputeBtnDisabled]}
                    onPress={handleSubmitDispute}
                    disabled={isSubmittingDispute}
                    activeOpacity={0.8}
                  >
                    {isSubmittingDispute ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitDisputeBtnText}>Submit Dispute</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  /* Calm, Centered Standard Top Bar */
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
  headerTitleWrap: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },

  /* Filter Section */
  filterSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  typeFilterGroup: {
    flexDirection: "row",
    gap: 6,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  typePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  typePillTextActive: {
    color: "#FFFFFF",
  },
  categoryDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 140,
  },
  categoryDropdownText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  /* List & Cards */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  txCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  txCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  txDesc: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  txDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  categoryBadge: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.primary,
  },
  txRef: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  txCardRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  /* Pagination Bar */
  paginationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 4,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  pageBtnTextDisabled: {
    color: colors.textMuted,
  },
  pageInfoText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  /* Empty & Loading */
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
    maxWidth: 280,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: "center",
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  categoryModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  categoryOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  categoryOptionItemActive: {
    backgroundColor: "rgba(200, 45, 117, 0.06)",
  },
  categoryOptionText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  categoryOptionTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },

  /* Details Modal */
  detailsModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  amountBanner: {
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 16,
  },
  bannerAmount: {
    fontSize: 24,
    fontWeight: "900",
  },
  statusPill: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700",
    maxWidth: 200,
    textAlign: "right",
  },
  refCopyRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  refText: {
    fontSize: 11,
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  balanceSummaryBox: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  balanceSubText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  balanceValText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  modalActions: {
    marginTop: 18,
  },
  disputeTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  disputeTriggerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },

  /* Dispute Modal */
  disputeModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    maxHeight: "85%",
  },
  disputeSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  reasonOptionActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.04)",
  },
  radioDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioDotOuterActive: {
    borderColor: colors.primary,
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  reasonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    flex: 1,
  },
  reasonTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: colors.text,
    textAlignVertical: "top",
    minHeight: 64,
  },
  disputeTurnaroundNotice: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 16,
    fontStyle: "italic",
  },
  submitDisputeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisputeBtnDisabled: {
    opacity: 0.6,
  },
  submitDisputeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  disputeFeedbackBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  disputeFeedbackTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  disputeFeedbackMsg: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  feedbackCloseBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  feedbackCloseBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
