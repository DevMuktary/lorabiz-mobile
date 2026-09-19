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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock3,
} from "lucide-react-native";
import { colors } from "../../constants/theme";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

type TxFilter = "ALL" | "DEPOSIT" | "PAYMENT";

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

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [txFilter, setTxFilter] = useState<TxFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Transactions Query
  const {
    data: txData,
    refetch: refetchTx,
    isFetching: isTxFetching,
  } = useQuery({
    queryKey: ["mobileAllTransactions"],
    queryFn: async () => {
      try {
        return await api.get("/api/user/transactions?limit=50");
      } catch {
        return null;
      }
    },
  });

  const transactions: Transaction[] = txData?.transactions || [];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isDeposit = tx.type === "DEPOSIT" || tx.type === "CREDIT";
      const isDebit = tx.type === "PAYMENT" || tx.type === "DEBIT";

      const matchesFilter =
        txFilter === "ALL"
          ? true
          : txFilter === "DEPOSIT"
          ? isDeposit
          : isDebit;

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        tx.description?.toLowerCase().includes(query) ||
        tx.reference?.toLowerCase().includes(query) ||
        tx.amount?.toString().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [transactions, txFilter, searchQuery]);

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === "CREDIT" || item.type === "DEPOSIT";
    const isSuccess = item.status === "SUCCESS";
    const isPending = item.status === "PENDING";

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
      <View style={styles.txCard}>
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
              {item.description || (isCredit ? "Wallet Funding" : "Service Payment")}
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
                    : colors.error,
                },
              ]}
            >
              {item.status || "SUCCESS"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Text style={styles.headerSubtitle}>
          Complete wallet credits, debits, and order records
        </Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by description, reference, or amount..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(["ALL", "PAYMENT", "DEPOSIT"] as TxFilter[]).map((type) => {
            const label =
              type === "ALL"
                ? "All Transactions"
                : type === "PAYMENT"
                ? "Payments"
                : "Deposits";
            const isActive = txFilter === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterPill, isActive && styles.activeFilterPill]}
                onPress={() => setTxFilter(type)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isActive && styles.activeFilterPillText,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item, index) => item.id || item.reference || String(index)}
        renderItem={renderTransactionItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 72 },
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
        ListEmptyComponent={
          !isTxFetching ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Clock size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Transactions Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "No transactions matched your search query."
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  activeFilterPill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  activeFilterPillText: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 10,
  },
  txCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    color: colors.primaryLight,
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
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
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
});
