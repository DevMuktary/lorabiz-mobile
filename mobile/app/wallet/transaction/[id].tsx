import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock3,
  RotateCw,
  Copy,
  Check,
  Share2,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  ExternalLink,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../../constants/theme";
import { api } from "../../../lib/api";

export default function TransactionDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, reference } = useLocalSearchParams<{ id: string; reference?: string }>();
  const [copiedRef, setCopiedRef] = useState(false);
  const [showReceiptCard, setShowReceiptCard] = useState(true);

  // Fetch complete real-time transaction details
  const {
    data: txData,
    refetch,
    isFetching,
    isLoading,
  } = useQuery({
    queryKey: ["transactionDetail", id || reference],
    queryFn: async () => {
      const targetId = id || reference;
      if (!targetId) return null;
      try {
        const res = await api.get(`/api/user/transactions/${targetId}`);
        return res?.transaction || null;
      } catch {
        return null;
      }
    },
    enabled: !!(id || reference),
  });

  const tx = txData;

  const handleCopy = (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      }
    } catch {}
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleShareReceipt = async () => {
    if (!tx) return;
    const isCredit = tx.type === "CREDIT" || tx.type === "DEPOSIT";
    const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleString("en-NG") : "N/A";
    const receiptSummary = [
      "--- LORABIZ TRANSACTION RECEIPT ---",
      `Service: ${tx.description || (isCredit ? "Wallet Funding" : "Service Order")}`,
      `Amount: ${isCredit ? "+" : "-"}₦${Number(tx.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      `Status: ${tx.status || "SUCCESS"}`,
      `Reference: ${tx.reference}`,
      `Date: ${dateStr}`,
      `Balance Before: ₦${Number(tx.balanceBefore || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      `Balance After: ₦${Number(tx.balanceAfter || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      "----------------------------------",
      "Processed securely on Lorabiz Infrastructure",
    ].join("\n");

    try {
      await Share.share({
        message: receiptSummary,
        title: `Lorabiz Receipt - ${tx.reference}`,
      });
    } catch {}
  };

  const isCredit = tx?.type === "CREDIT" || tx?.type === "DEPOSIT";
  const isSuccess = tx?.status === "SUCCESS";
  const isPending = tx?.status === "PENDING";
  const isReversed = tx?.status === "REVERSED";
  const hasDispute = !!tx?.dispute;
  const isDisputePending = tx?.dispute?.status === "PENDING";

  const formattedDate = tx?.createdAt
    ? new Date(tx.createdAt).toLocaleDateString("en-NG", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent";

  const formattedTime = tx?.createdAt
    ? new Date(tx.createdAt).toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/activity");
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Transaction Details</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {tx?.reference ? `Ref: ${tx.reference}` : "Viewing Order Ledger"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShareReceipt}
          style={styles.shareHeaderBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
          disabled={!tx}
        >
          <Share2 size={18} color={tx ? colors.text : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading transaction...</Text>
        </View>
      ) : !tx ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={44} color={colors.error} />
          <Text style={styles.errorTitle}>Transaction Not Found</Text>
          <Text style={styles.errorDesc}>
            The requested transaction could not be loaded or may not exist on this account.
          </Text>
          <TouchableOpacity
            style={styles.errorActionBtn}
            onPress={() => router.replace("/(tabs)/activity")}
            activeOpacity={0.8}
          >
            <Text style={styles.errorActionText}>Return to Transactions</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[styles.scrollContainer, { paddingBottom: Math.max(insets.bottom, 24) + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Hero Status Card */}
          <View style={styles.heroCard}>
            <View
              style={[
                styles.heroIconCircle,
                {
                  backgroundColor: isCredit
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(239, 68, 68, 0.1)",
                },
              ]}
            >
              {isCredit ? (
                <ArrowDownLeft size={28} color={colors.success} />
              ) : (
                <ArrowUpRight size={28} color="#EF4444" />
              )}
            </View>

            <Text
              style={[
                styles.heroAmount,
                { color: isCredit ? colors.success : colors.text },
              ]}
            >
              {isCredit ? "+" : "-"}₦
              {Number(tx.amount || 0).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
              })}
            </Text>

            <Text style={styles.heroDesc} numberOfLines={2}>
              {tx.description || (isCredit ? "Wallet Funding" : "Service Payment")}
            </Text>

            {/* Status Pill */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isSuccess
                    ? "rgba(16, 185, 129, 0.1)"
                    : isPending
                    ? "rgba(245, 158, 11, 0.1)"
                    : isReversed
                    ? "rgba(139, 92, 246, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                },
              ]}
            >
              {isSuccess ? (
                <CheckCircle2 size={13} color={colors.success} style={{ marginRight: 5 }} />
              ) : isPending ? (
                <Clock3 size={13} color={colors.warning} style={{ marginRight: 5 }} />
              ) : isReversed ? (
                <RotateCw size={13} color="#8B5CF6" style={{ marginRight: 5 }} />
              ) : (
                <AlertCircle size={13} color={colors.error} style={{ marginRight: 5 }} />
              )}
              <Text
                style={[
                  styles.statusBadgeText,
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
                {tx.status || "SUCCESS"}
              </Text>
            </View>

            <Text style={styles.heroTimestamp}>
              {formattedDate} {formattedTime ? `at ${formattedTime}` : ""}
            </Text>
          </View>

          {/* ACTIVE DISPUTE CARD (if present) */}
          {hasDispute && (
            <View style={styles.disputeStatusCard}>
              <View style={styles.disputeHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <ShieldAlert size={18} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.disputeTitle}>Dispute Case</Text>
                </View>
                <View
                  style={[
                    styles.disputeStatusPill,
                    {
                      backgroundColor:
                        tx.dispute?.status === "RESOLVED"
                          ? "rgba(16, 185, 129, 0.12)"
                          : tx.dispute?.status === "REJECTED"
                          ? "rgba(239, 68, 68, 0.12)"
                          : "rgba(245, 158, 11, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.disputeStatusPillText,
                      {
                        color:
                          tx.dispute?.status === "RESOLVED"
                            ? colors.success
                            : tx.dispute?.status === "REJECTED"
                            ? colors.error
                            : "#D97706",
                      },
                    ]}
                  >
                    {tx.dispute?.status === "RESOLVED"
                      ? "RESOLVED"
                      : tx.dispute?.status === "REJECTED"
                      ? "CLOSED"
                      : "PENDING REVIEW"}
                  </Text>
                </View>
              </View>

              <View style={styles.disputeRow}>
                <Text style={styles.disputeLabel}>Reason:</Text>
                <Text style={styles.disputeValue}>{tx.dispute?.issueType}</Text>
              </View>

              {tx.dispute?.notes ? (
                <View style={styles.disputeNotesBox}>
                  <Text style={styles.disputeNotesLabel}>Your Note:</Text>
                  <Text style={styles.disputeNotesText}>{tx.dispute.notes}</Text>
                </View>
              ) : null}

              {tx.dispute?.adminResponse ? (
                <View style={styles.disputeAdminBox}>
                  <Text style={styles.disputeAdminLabel}>Resolution Response:</Text>
                  <Text style={styles.disputeAdminText}>{tx.dispute.adminResponse}</Text>
                </View>
              ) : null}

              <Text style={styles.disputeTurnaroundNotice}>
                {isDisputePending
                  ? "Our review team is actively investigating this report within 1 – 48 Working Hours."
                  : "Case recorded in audit logs."}
              </Text>
            </View>
          )}

          {/* Detailed Ledger Card */}
          <View style={styles.ledgerCard}>
            <Text style={styles.sectionHeaderTitle}>Transaction Information</Text>

            {/* Reference with Tap-to-Copy */}
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Reference</Text>
              <TouchableOpacity
                style={styles.copyPill}
                onPress={() => handleCopy(tx.reference)}
                activeOpacity={0.7}
              >
                <Text style={styles.copyPillText} numberOfLines={1}>
                  {tx.reference}
                </Text>
                {copiedRef ? (
                  <Check size={13} color={colors.success} style={{ marginLeft: 5 }} />
                ) : (
                  <Copy size={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
                )}
              </TouchableOpacity>
            </View>

            {/* Service Category */}
            {tx.serviceCategory ? (
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>Category</Text>
                <View style={styles.serviceCatPill}>
                  <Text style={styles.serviceCatText}>{tx.serviceCategory}</Text>
                </View>
              </View>
            ) : null}

            {/* Type */}
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Payment Flow</Text>
              <Text style={styles.ledgerValue}>
                {isCredit ? "Wallet Credit" : "Wallet Debit"}
              </Text>
            </View>

            {/* Balances Before & After */}
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Balance Before</Text>
              <Text style={styles.ledgerValue}>
                ₦{Number(tx.balanceBefore || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.ledgerRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.ledgerLabel}>Balance After</Text>
              <Text style={[styles.ledgerValue, { fontWeight: "800", color: colors.text }]}>
                ₦{Number(tx.balanceAfter || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* IN-APP DIGITAL RECEIPT CARD */}
          <View style={styles.receiptCard}>
            <View style={styles.receiptTop}>
              <Receipt size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.receiptHeaderTitle}>Digital Receipt</Text>
            </View>

            <View style={styles.receiptDashedLine} />

            <View style={styles.receiptLineRow}>
              <Text style={styles.receiptLineLabel}>Item / Description</Text>
              <Text style={styles.receiptLineVal} numberOfLines={1}>
                {tx.description || (isCredit ? "Deposit" : "Service Order")}
              </Text>
            </View>

            <View style={styles.receiptLineRow}>
              <Text style={styles.receiptLineLabel}>Channel</Text>
              <Text style={styles.receiptLineVal}>Lorabiz Secure Wallet</Text>
            </View>

            <View style={styles.receiptLineRow}>
              <Text style={styles.receiptLineLabel}>Date & Time</Text>
              <Text style={styles.receiptLineVal}>
                {formattedDate} {formattedTime}
              </Text>
            </View>

            <View style={styles.receiptLineRow}>
              <Text style={styles.receiptLineLabel}>Amount Paid</Text>
              <Text style={[styles.receiptLineVal, { fontWeight: "800", color: colors.text }]}>
                ₦{Number(tx.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.receiptDashedLine} />

            {/* Action Buttons */}
            <View style={styles.receiptActionsRow}>
              <TouchableOpacity
                style={styles.shareReceiptBtn}
                onPress={handleShareReceipt}
                activeOpacity={0.8}
              >
                <Share2 size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.shareReceiptText}>Share Receipt</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DISPUTE TRIGGER OR PENDING NOTICE */}
          <View style={styles.disputeActionSection}>
            {isDisputePending ? (
              <View style={styles.disputePendingBanner}>
                <Clock3 size={16} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={styles.disputePendingText}>
                  A dispute is pending review for this transaction. Multiple submissions are restricted until the existing case is resolved.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.openDisputePageBtn}
                onPress={() =>
                  router.push({
                    pathname: "/wallet/transaction/dispute/[id]",
                    params: { id: tx.id },
                  })
                }
                activeOpacity={0.85}
              >
                <ShieldAlert size={16} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.openDisputePageText}>
                  {hasDispute ? "View Dispute History" : "Dispute This Transaction"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Legal Note */}
          <Text style={styles.complianceNote}>
            All financial activities and service orders are logged for verification and auditing in compliance with standard regulations.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  shareHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 14,
  },
  errorDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  errorActionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Hero Card */
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 6,
    textAlign: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTimestamp: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 10,
    fontWeight: "500",
  },

  /* Dispute Progress Card */
  disputeStatusCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  disputeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  disputeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  disputeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  disputeStatusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  disputeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  disputeLabel: {
    fontSize: 12,
    color: "#78350F",
    fontWeight: "700",
    marginRight: 6,
  },
  disputeValue: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
  },
  disputeNotesBox: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  disputeNotesLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#78350F",
    marginBottom: 2,
  },
  disputeNotesText: {
    fontSize: 12,
    color: "#1E293B",
    lineHeight: 16,
  },
  disputeAdminBox: {
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  disputeAdminLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 2,
  },
  disputeAdminText: {
    fontSize: 12,
    color: "#14532D",
    lineHeight: 16,
  },
  disputeTurnaroundNotice: {
    fontSize: 11,
    color: "#92400E",
    marginTop: 10,
    fontStyle: "italic",
  },

  /* Ledger Information Card */
  ledgerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  ledgerLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  ledgerValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  copyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 200,
  },
  copyPillText: {
    fontSize: 11,
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
  },
  serviceCatPill: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serviceCatText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "800",
  },

  /* Digital Receipt Card */
  receiptCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  receiptTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  receiptHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  receiptDashedLine: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    marginVertical: 12,
  },
  receiptLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  receiptLineLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  receiptLineVal: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    maxWidth: 200,
    textAlign: "right",
  },
  receiptActionsRow: {
    marginTop: 6,
  },
  shareReceiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shareReceiptText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Dispute Button Section */
  disputeActionSection: {
    marginTop: 4,
  },
  openDisputePageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  openDisputePageText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#DC2626",
  },
  disputePendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  disputePendingText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
  },

  complianceNote: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
});
