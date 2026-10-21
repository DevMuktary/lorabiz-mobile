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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  RotateCw,
  Search,
  CheckCircle2,
  ShieldAlert,
  AlertCircle,
  Clock3,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Filter,
  Calendar,
  Check,
} from "lucide-react-native";
import { colors as defaultColors } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export type SpecificServiceKey =
  | "ALL"
  | "NIN_SLIP"
  | "NIN_VALIDATION"
  | "NIN_IPE"
  | "NIN_MODIFICATION"
  | "NIN_PERSONALIZATION"
  | "BVN_SLIP"
  | "BVN_RETRIEVAL"
  | "BVN_MODIFICATION"
  | "BUSINESS_NAME"
  | "LLC"
  | "ANNUAL_RETURNS"
  | "TAX_ID"
  | "SCUML"
  | "AIRTIME"
  | "MOBILE_DATA"
  | "WALLET_FUNDING";

export type DatePresetKey =
  | "ALL"
  | "TODAY"
  | "7DAYS"
  | "THIS_MONTH"
  | "30DAYS"
  | "CUSTOM";

interface DisputeInfo {
  id: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  issueType: string;
  notes?: string;
  adminResponse?: string | null;
  createdAt: string;
}

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
  dispute?: DisputeInfo | null;
}

const INDIVIDUAL_SERVICES: { id: SpecificServiceKey; label: string }[] = [
  { id: "ALL", label: "All Services" },
  { id: "NIN_SLIP", label: "NIN Slip" },
  { id: "NIN_VALIDATION", label: "NIN Validation" },
  { id: "NIN_IPE", label: "NIN IPE Clearance" },
  { id: "NIN_MODIFICATION", label: "NIN Modification" },
  { id: "NIN_PERSONALIZATION", label: "NIN Personalization" },
  { id: "BVN_SLIP", label: "BVN Slip" },
  { id: "BVN_RETRIEVAL", label: "BVN Retrieval" },
  { id: "BVN_MODIFICATION", label: "BVN Modification" },
  { id: "BUSINESS_NAME", label: "Business Name (CAC)" },
  { id: "LLC", label: "Company (LLC)" },
  { id: "ANNUAL_RETURNS", label: "Annual Returns" },
  { id: "TAX_ID", label: "Tax ID (TIN)" },
  { id: "SCUML", label: "SCUML" },
  { id: "AIRTIME", label: "Airtime" },
  { id: "MOBILE_DATA", label: "Mobile Data" },
  { id: "WALLET_FUNDING", label: "Wallet Funding" },
];

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Filter states
  const [selectedService, setSelectedService] = useState<SpecificServiceKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Date Range state
  const [datePreset, setDatePreset] = useState<DatePresetKey>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateModal, setShowDateModal] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Service Dropdown Modal
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  // Helper for applying date presets
  const applyPreset = (preset: DatePresetKey) => {
    setDatePreset(preset);
    setPage(1);

    const now = new Date();
    const toYMD = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "TODAY") {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7DAYS") {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (preset === "THIS_MONTH") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(first));
      setEndDate(toYMD(now));
    } else if (preset === "30DAYS") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    }
  };

  const applyCustomDateRange = () => {
    if (customStart || customEnd) {
      setStartDate(customStart.trim());
      setEndDate(customEnd.trim());
      setDatePreset("CUSTOM");
      setPage(1);
    }
    setShowDateModal(false);
  };

  const clearDateFilter = () => {
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setCustomStart("");
    setCustomEnd("");
    setPage(1);
  };

  // Fetch paginated transactions from API
  const {
    data: txData,
    refetch: refetchTx,
    isFetching: isTxFetching,
  } = useQuery({
    queryKey: ["mobileAllTransactions", page, selectedService, searchQuery, startDate, endDate],
    queryFn: async () => {
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          category: selectedService,
          search: searchQuery,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
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

  const selectedServiceObj = INDIVIDUAL_SERVICES.find((s) => s.id === selectedService);

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === "CREDIT" || item.type === "DEPOSIT";
    const isSuccess = item.status === "SUCCESS";
    const isPending = item.status === "PENDING";
    const isReversed = item.status === "REVERSED";
    const hasDispute = !!item.dispute;

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
        style={[styles.txCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
        onPress={() =>
          router.push({
            pathname: "/wallet/transaction/[id]",
            params: { id: item.id },
          })
        }
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
            <Text style={[styles.txDesc, { color: colors.text }]} numberOfLines={1}>
              {item.description || (isCredit ? "Wallet Funding" : "Service Order")}
            </Text>
            <View style={styles.txMetaRow}>
              <Text style={[styles.txDate, { color: colors.textMuted }]}>
                {formattedDate} {formattedTime ? `• ${formattedTime}` : ""}
              </Text>
              {hasDispute && (
                <View style={styles.disputePillBadge}>
                  <Text style={styles.disputePillBadgeText}>
                    {item.dispute?.status === "RESOLVED" ? "Resolved" : "Disputed"}
                  </Text>
                </View>
              )}
            </View>
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* 1. Calm, Centered Standard Top Bar with Back Button */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 16) + 4,
            backgroundColor: colors.surface,
            borderBottomColor: colors.surfaceBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Transactions</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>History & Order Records</Text>
        </View>

        <TouchableOpacity
          onPress={() => refetchTx()}
          style={[
            styles.refreshBtn,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <RotateCw size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Dispute Cases Access Banner */}
      <TouchableOpacity
        style={styles.disputesShortcutBanner}
        onPress={() => router.push("/wallet/disputes")}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View style={styles.disputesShortcutIconWrap}>
            <ShieldAlert size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.disputesShortcutTitle, { color: colors.text }]}>
              Have an issue with a transaction?
            </Text>
            <Text style={[styles.disputesShortcutSub, { color: colors.textSecondary }]}>
              View all dispute cases & inquiry status
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={[styles.disputesShortcutLink, { color: colors.primary }]}>
            All Cases
          </Text>
          <ChevronRight size={14} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* 2. Filters Section: Search & Service Dropdown */}
      <View style={styles.filterSection}>
        {/* Search Input */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
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

        {/* Row with Service Trigger & Date Trigger */}
        <View style={styles.triggerRow}>
          <TouchableOpacity
            style={[styles.serviceDropdownTrigger, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
            onPress={() => setShowServiceDropdown(true)}
            activeOpacity={0.8}
          >
            <Filter size={14} color={selectedService !== "ALL" ? colors.primary : colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.dropdownTriggerLabel, { color: colors.text }]} numberOfLines={1}>
              {selectedServiceObj?.label || "All Services"}
            </Text>
            <ChevronDown size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dateTrigger,
              { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
              (startDate || endDate) && styles.dateTriggerActive,
            ]}
            onPress={() => setShowDateModal(true)}
            activeOpacity={0.8}
          >
            <Calendar size={14} color={startDate || endDate ? colors.primary : colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.dateTriggerText, { color: colors.text }, (startDate || endDate) && styles.dateTriggerTextActive]} numberOfLines={1}>
              {datePreset === "TODAY"
                ? "Today"
                : datePreset === "7DAYS"
                ? "Last 7 Days"
                : datePreset === "THIS_MONTH"
                ? "This Month"
                : datePreset === "30DAYS"
                ? "Last 30 Days"
                : startDate && endDate
                ? `${startDate} – ${endDate}`
                : "Date Range"}
            </Text>
            <ChevronDown size={14} color={startDate || endDate ? colors.primary : colors.textSecondary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>


        {/* Quick Date Pills Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datePillsScroll}
        >
          <TouchableOpacity
            style={[styles.datePill, datePreset === "ALL" && styles.datePillActive]}
            onPress={() => applyPreset("ALL")}
            activeOpacity={0.75}
          >
            <Text style={[styles.datePillText, datePreset === "ALL" && styles.datePillTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, datePreset === "TODAY" && styles.datePillActive]}
            onPress={() => applyPreset("TODAY")}
            activeOpacity={0.75}
          >
            <Text style={[styles.datePillText, datePreset === "TODAY" && styles.datePillTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, datePreset === "7DAYS" && styles.datePillActive]}
            onPress={() => applyPreset("7DAYS")}
            activeOpacity={0.75}
          >
            <Text style={[styles.datePillText, datePreset === "7DAYS" && styles.datePillTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, datePreset === "THIS_MONTH" && styles.datePillActive]}
            onPress={() => applyPreset("THIS_MONTH")}
            activeOpacity={0.75}
          >
            <Text style={[styles.datePillText, datePreset === "THIS_MONTH" && styles.datePillTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.datePill, datePreset === "30DAYS" && styles.datePillActive]}
            onPress={() => applyPreset("30DAYS")}
            activeOpacity={0.75}
          >
            <Text style={[styles.datePillText, datePreset === "30DAYS" && styles.datePillTextActive]}>
              30 Days
            </Text>
          </TouchableOpacity>

          {(startDate || endDate) && (
            <TouchableOpacity
              style={styles.clearDatePill}
              onPress={clearDateFilter}
              activeOpacity={0.75}
            >
              <X size={12} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.clearDateText}>Clear Date</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* 3. Paginated Transactions List */}
      <FlatList
        data={transactions}
        keyExtractor={(item, index) => item.id || item.reference || String(index)}
        renderItem={renderTransactionItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 24 },
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
                {searchQuery || selectedService !== "ALL" || startDate || endDate
                  ? "No transactions matched your search or selected filter criteria."
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
      {/* 4. INDIVIDUAL SERVICE DROPDOWN MODAL                                */}
      {/* =================================================================== */}
      <Modal
        visible={showServiceDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServiceDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowServiceDropdown(false)}
        >
          <View style={styles.dropdownModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Filter by Service</Text>
              <TouchableOpacity onPress={() => setShowServiceDropdown(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {INDIVIDUAL_SERVICES.map((opt) => {
                const isSelected = selectedService === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.serviceOptionItem, isSelected && styles.serviceOptionItemActive]}
                    onPress={() => {
                      setSelectedService(opt.id);
                      setPage(1);
                      setShowServiceDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.serviceOptionText, isSelected && styles.serviceOptionTextActive]}>
                      {opt.label}
                    </Text>
                    {isSelected && <Check size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =================================================================== */}
      {/* 5. CUSTOM DATE RANGE MODAL                                          */}
      {/* =================================================================== */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.dateModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Calendar size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Select Date Range</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Quick Presets inside Modal */}
            <Text style={styles.dateModalSectionLabel}>Quick Range</Text>
            <View style={styles.dateModalPresetsGrid}>
              <TouchableOpacity
                style={[styles.modalPresetBtn, datePreset === "TODAY" && styles.modalPresetBtnActive]}
                onPress={() => {
                  applyPreset("TODAY");
                  setShowDateModal(false);
                }}
              >
                <Text style={[styles.modalPresetText, datePreset === "TODAY" && styles.modalPresetTextActive]}>
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPresetBtn, datePreset === "7DAYS" && styles.modalPresetBtnActive]}
                onPress={() => {
                  applyPreset("7DAYS");
                  setShowDateModal(false);
                }}
              >
                <Text style={[styles.modalPresetText, datePreset === "7DAYS" && styles.modalPresetTextActive]}>
                  Last 7 Days
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPresetBtn, datePreset === "THIS_MONTH" && styles.modalPresetBtnActive]}
                onPress={() => {
                  applyPreset("THIS_MONTH");
                  setShowDateModal(false);
                }}
              >
                <Text style={[styles.modalPresetText, datePreset === "THIS_MONTH" && styles.modalPresetTextActive]}>
                  This Month
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPresetBtn, datePreset === "30DAYS" && styles.modalPresetBtnActive]}
                onPress={() => {
                  applyPreset("30DAYS");
                  setShowDateModal(false);
                }}
              >
                <Text style={[styles.modalPresetText, datePreset === "30DAYS" && styles.modalPresetTextActive]}>
                  Last 30 Days
                </Text>
              </TouchableOpacity>
            </View>

            {/* Custom Input Fields */}
            <Text style={[styles.dateModalSectionLabel, { marginTop: 14 }]}>Custom Date (YYYY-MM-DD)</Text>
            <View style={styles.dateInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateFieldLabel}>Start Date</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="2026-01-01"
                  placeholderTextColor={colors.textMuted}
                  value={customStart}
                  onChangeText={setCustomStart}
                  maxLength={10}
                />
              </View>

              <Text style={{ alignSelf: "center", marginTop: 14, color: colors.textMuted, fontWeight: "700" }}>
                —
              </Text>

              <View style={{ flex: 1 }}>
                <Text style={styles.dateFieldLabel}>End Date</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="2026-12-31"
                  placeholderTextColor={colors.textMuted}
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  maxLength={10}
                />
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.dateModalActionsRow}>
              <TouchableOpacity
                style={styles.dateResetBtn}
                onPress={() => {
                  clearDateFilter();
                  setShowDateModal(false);
                }}
              >
                <Text style={styles.dateResetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateApplyBtn}
                onPress={applyCustomDateRange}
              >
                <Text style={styles.dateApplyBtnText}>Apply Range</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Calm, Centered Standard Top Bar */
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  disputesShortcutBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: isDark ? "rgba(200, 45, 117, 0.12)" : "rgba(200, 45, 117, 0.06)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? "rgba(200, 45, 117, 0.22)" : "rgba(200, 45, 117, 0.12)",
  },
  disputesShortcutIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(200, 45, 117, 0.25)" : "rgba(200, 45, 117, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  disputesShortcutTitle: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  disputesShortcutSub: {
    fontSize: 11,
    marginTop: 1,
  },
  disputesShortcutLink: {
    fontSize: 11.5,
    fontWeight: "700",
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
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    paddingVertical: 0,
  },
  triggerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  serviceDropdownTrigger: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  dropdownTriggerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  dateTrigger: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  dateTriggerActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.05)",
  },
  dateTriggerText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    flex: 1,
  },
  dateTriggerTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  datePillsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  datePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  datePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  datePillTextActive: {
    color: "#FFFFFF",
  },
  clearDatePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  clearDateText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
  },

  /* Transaction Item Card */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  txCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
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
    marginTop: 2,
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
    color: colors.primaryLight,
  },
  disputePillBadge: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  disputePillBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#475569",
  },
  txRef: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 1,
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
    marginTop: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  /* Pagination */
  paginationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 4,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
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
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "#FDF2F8",
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
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 260,
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
  dropdownModalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 18,
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
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  serviceOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 3,
  },
  serviceOptionItemActive: {
    backgroundColor: "rgba(200, 45, 117, 0.06)",
  },
  serviceOptionText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  serviceOptionTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },

  /* Date Modal */
  dateModalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  dateModalSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  dateModalPresetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modalPresetBtn: {
    flexBasis: "48%",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalPresetBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalPresetText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  modalPresetTextActive: {
    color: "#FFFFFF",
  },
  dateInputsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  dateFieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 12,
    color: colors.text,
  },
  dateModalActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 18,
  },
  dateResetBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  dateResetBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  dateApplyBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  dateApplyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
