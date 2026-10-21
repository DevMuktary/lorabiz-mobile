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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  RotateCw,
  Search,
  CheckCircle2,
  Clock3,
  AlertCircle,
  X,
  ShieldAlert,
  MessageSquare,
  ChevronRight,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";

type DisputeStatusFilter = "ALL" | "PENDING" | "RESOLVED" | "REJECTED";

interface DisputeItem {
  id: string;
  reference: string;
  transactionId: string | null;
  amount: number;
  type: string;
  serviceCategory: string;
  description: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  issueType: string;
  notes: string;
  adminResponse: string | null;
  messageCount: number;
  latestMessage: {
    sender: "USER" | "SUPPORT";
    text: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function DisputesOverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [statusFilter, setStatusFilter] = useState<DisputeStatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch all disputes with fallback to transactions ledger
  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["allUserDisputes", statusFilter, searchQuery],
    queryFn: async () => {
      let rawDisputes: DisputeItem[] = [];

      // 1. Try dedicated dispute endpoint first
      try {
        const queryParams = new URLSearchParams();
        if (statusFilter !== "ALL") queryParams.append("status", statusFilter);
        if (searchQuery.trim()) queryParams.append("search", searchQuery.trim());
        const res = await api.get(`/api/user/transactions/dispute?${queryParams.toString()}`);
        if (res?.success && Array.isArray(res?.disputes) && res.disputes.length > 0) {
          rawDisputes = res.disputes;
        }
      } catch {}

      // 2. If no disputes found from dedicated endpoint, fetch from transactions endpoint (active in production)
      if (rawDisputes.length === 0) {
        try {
          const txRes = await api.get("/api/user/transactions?limit=100");
          const txList = txRes?.transactions || [];
          const disputedTx = txList.filter((t: any) => !!t.dispute);

          rawDisputes = disputedTx.map((t: any) => {
            const d = t.dispute;
            return {
              id: d.id || `disp_${t.id}`,
              reference: t.reference,
              transactionId: t.id,
              amount: Number(t.amount || 0),
              type: t.type || "DEBIT",
              serviceCategory: t.serviceCategory || "SERVICE",
              description: t.description || "Transaction Dispute",
              status: (d.status || "PENDING") as "PENDING" | "RESOLVED" | "REJECTED",
              issueType: d.issueType || "Transaction Issue",
              notes: d.notes || "",
              adminResponse: d.adminResponse || null,
              messageCount: d.messages ? d.messages.length : (d.adminResponse ? 2 : 1),
              latestMessage: d.adminResponse
                ? {
                    sender: "SUPPORT" as const,
                    text: d.adminResponse,
                    createdAt: d.createdAt || t.createdAt,
                  }
                : d.notes
                ? {
                    sender: "USER" as const,
                    text: d.notes,
                    createdAt: d.createdAt || t.createdAt,
                  }
                : null,
              createdAt: d.createdAt || t.createdAt,
              updatedAt: d.createdAt || t.createdAt,
            };
          });
        } catch (err) {
          console.error("Failed to fallback fetch transactions for disputes:", err);
        }
      }

      // Compute status counts across all discovered disputes
      const counts = {
        all: rawDisputes.length,
        pending: rawDisputes.filter((d) => d.status === "PENDING").length,
        resolved: rawDisputes.filter((d) => d.status === "RESOLVED").length,
        rejected: rawDisputes.filter((d) => d.status === "REJECTED").length,
      };

      // Filter locally by status
      let filtered = rawDisputes;
      if (statusFilter !== "ALL") {
        filtered = filtered.filter((d) => d.status === statusFilter);
      }

      // Filter locally by search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(
          (d) =>
            d.reference.toLowerCase().includes(q) ||
            d.issueType.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.notes.toLowerCase().includes(q)
        );
      }

      return {
        disputes: filtered,
        counts,
      };
    },
  });

  const disputes = data?.disputes || [];
  const counts = data?.counts || { all: 0, pending: 0, resolved: 0, rejected: 0 };

  const handleCopy = (refText: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(refText);
      }
    } catch {}
    setCopiedId(refText);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderDisputeCard = ({ item }: { item: DisputeItem }) => {
    const isPending = item.status === "PENDING";
    const isResolved = item.status === "RESOLVED";
    const isRejected = item.status === "REJECTED";

    const formattedDate = new Date(item.createdAt).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return (
      <View style={styles.card}>
        {/* Top Header of Card */}
        <View style={styles.cardHeader}>
          <View style={styles.refRow}>
            <Text style={styles.refLabel}>REF:</Text>
            <Text style={styles.refValue} numberOfLines={1}>
              {item.reference}
            </Text>
            <TouchableOpacity
              onPress={() => handleCopy(item.reference)}
              style={styles.copyBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {copiedId === item.reference ? (
                <Check size={12} color={colors.primary} />
              ) : (
                <Copy size={12} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isResolved
                ? styles.badgeResolved
                : isPending
                ? styles.badgePending
                : styles.badgeRejected,
            ]}
          >
            {isResolved ? (
              <CheckCircle2 size={12} color={colors.success} style={{ marginRight: 4 }} />
            ) : isPending ? (
              <Clock3 size={12} color={colors.warning} style={{ marginRight: 4 }} />
            ) : (
              <AlertCircle size={12} color={colors.error} style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: isResolved
                    ? colors.success
                    : isPending
                    ? colors.warning
                    : colors.error,
                },
              ]}
            >
              {isResolved ? "RESOLVED" : isPending ? "UNDER REVIEW" : "REJECTED"}
            </Text>
          </View>
        </View>

        {/* Issue Type & Amount */}
        <View style={styles.middleRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.issueTypeText} numberOfLines={1}>
              {item.issueType}
            </Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>

          <Text style={styles.amountText}>
            ₦{Number(item.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Latest message snippet */}
        {item.latestMessage ? (
          <View style={styles.snippetBox}>
            <View style={styles.snippetHeader}>
              <MessageSquare size={13} color={item.latestMessage.sender === "SUPPORT" ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={styles.snippetSender}>
                {item.latestMessage.sender === "SUPPORT" ? "Compliance Officer" : "Your Note"}:
              </Text>
            </View>
            <Text style={styles.snippetText} numberOfLines={2}>
              {item.latestMessage.text}
            </Text>
          </View>
        ) : item.notes ? (
          <View style={styles.snippetBox}>
            <Text style={styles.snippetText} numberOfLines={2}>
              "{item.notes}"
            </Text>
          </View>
        ) : null}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.openCaseBtn}
          onPress={() =>
            router.push({
              pathname: "/wallet/transaction/dispute/[id]",
              params: { id: item.transactionId || item.reference },
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.openCaseBtnText}>Open Case & Messages</Text>
          <ChevronRight size={15} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/activity");
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Dispute Cases</Text>
          <Text style={styles.headerSubtitle}>Inquiries & Issue Resolutions</Text>
        </View>

        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.refreshBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <RotateCw size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Turnaround Guarantee Pill */}
      <View style={styles.turnaroundBar}>
        <ShieldAlert size={14} color={colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.turnaroundText}>
          Investigation Turnaround: <Text style={{ fontWeight: "700", color: colors.primary }}>1 – 48 Working Hours</Text>
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsRow}>
        {(
          [
            { id: "ALL", label: "All", count: counts.all },
            { id: "PENDING", label: "Review", count: counts.pending },
            { id: "RESOLVED", label: "Resolved", count: counts.resolved },
            { id: "REJECTED", label: "Closed", count: counts.rejected },
          ] as const
        ).map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              onPress={() => setStatusFilter(tab.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dispute reference or issue..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading dispute records...</Text>
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          renderItem={renderDisputeCard}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: Math.max(insets.bottom, 24) + 20 },
            disputes.length === 0 && { flex: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <ShieldCheck size={36} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Disputes Found</Text>
              <Text style={styles.emptyDesc}>
                {searchQuery
                  ? "No cases matched your search query."
                  : statusFilter !== "ALL"
                  ? `You have no ${statusFilter.toLowerCase()} disputes on record.`
                  : "All your transactions and services are in good standing with zero open disputes."}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.replace("/(tabs)/activity")}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionText}>View Transaction History</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
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
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
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
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
    },
    turnaroundBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(200, 45, 117, 0.10)" : "rgba(200, 45, 117, 0.06)",
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "rgba(200, 45, 117, 0.18)" : "rgba(200, 45, 117, 0.12)",
    },
    turnaroundText: {
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    filterTabsRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: colors.surface,
    },
    tabPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 5,
    },
    tabPillActive: {
      backgroundColor: isDark ? "rgba(200, 45, 117, 0.20)" : "rgba(200, 45, 117, 0.10)",
      borderColor: colors.primary,
    },
    tabLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: "800",
    },
    tabBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.08)",
    },
    tabBadgeActive: {
      backgroundColor: colors.primary,
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textMuted,
    },
    tabBadgeTextActive: {
      color: "#FFFFFF",
    },
    searchSection: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface,
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
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      color: colors.text,
      paddingVertical: 0,
    },
    listContainer: {
      padding: 16,
      gap: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 14,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder,
    },
    refRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 8,
    },
    refLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      marginRight: 4,
    },
    refValue: {
      fontSize: 11.5,
      fontWeight: "700",
      color: colors.text,
      maxWidth: 160,
    },
    copyBtn: {
      padding: 4,
      marginLeft: 4,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      borderWidth: 1,
    },
    badgePending: {
      backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FFFBEB",
      borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
    },
    badgeResolved: {
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5",
      borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "#A7F3D0",
    },
    badgeRejected: {
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
      borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
    },
    statusText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    middleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    issueTypeText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    dateText: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    amountText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
    },
    snippetBox: {
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
    },
    snippetHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 3,
    },
    snippetSender: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    snippetText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    openCaseBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder,
    },
    openCaseBtnText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: colors.primary,
    },
    centerLoading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 10,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 64,
      paddingHorizontal: 24,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "rgba(200, 45, 117, 0.08)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(200, 45, 117, 0.3)" : "rgba(200, 45, 117, 0.2)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 6,
    },
    emptyDesc: {
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 18,
      maxWidth: 280,
      marginBottom: 20,
    },
    emptyActionBtn: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    emptyActionText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: colors.primary,
    },
  });
