import React, { useState, useMemo } from "react";
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
import { colors as defaultColors } from "../../../constants/theme";
import { useTheme } from "../../../context/ThemeContext";
import { api, BASE_URL } from "../../../lib/api";
import { downloadAndSharePdf } from "../../../lib/pdf";
import { getAuthToken } from "../../../lib/storage";
import { useAuth } from "../../../context/AuthContext";

export default function TransactionDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { token } = useAuth();
  const { id, reference } = useLocalSearchParams<{ id: string; reference?: string }>();
  const [copiedRef, setCopiedRef] = useState(false);
  const [showReceiptCard, setShowReceiptCard] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

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
    if (!tx || isSharing) return;
    setIsSharing(true);
    try {
      const activeToken = token || (await getAuthToken());
      const receiptUrl = `${BASE_URL}/api/user/transactions/${tx.id}/receipt-image?token=${encodeURIComponent(activeToken || "")}`;

      await downloadAndSharePdf({
        source: receiptUrl,
        filename: `Lorabiz_Receipt_${tx.reference}.png`,
        dialogTitle: `Lorabiz Receipt - ${tx.reference}`,
        mimeType: "image/png",
      });
    } catch (err: any) {
      console.error("Receipt image share error:", err);
    } finally {
      setIsSharing(false);
    }
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.surface} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 4, backgroundColor: colors.surface, borderBottomColor: colors.surfaceBorder }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/activity");
            }
          }}
          style={[styles.backBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Transaction Details</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {tx?.reference ? `Ref: ${tx.reference}` : "Viewing Order Ledger"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShareReceipt}
          style={[styles.shareHeaderBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }]}
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
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading transaction...</Text>
        </View>
      ) : !tx ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={44} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Transaction Not Found</Text>
          <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>
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
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
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

            <Text style={[styles.heroDesc, { color: colors.text }]} numberOfLines={2}>
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

            <Text style={[styles.heroTimestamp, { color: colors.textMuted }]}>
              {formattedDate} {formattedTime ? `at ${formattedTime}` : ""}
            </Text>
          </View>

          {/* ACTIVE DISPUTE CARD (if present) */}
          {hasDispute && (
            <View style={[styles.disputeStatusCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <View style={styles.disputeHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <ShieldAlert size={18} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.disputeTitle, { color: colors.text }]}>Dispute Case</Text>
                </View>
                <View
                  style={[
                    styles.disputeStatusPill,
                    {
                      backgroundColor:
                        tx.dispute?.status === "RESOLVED"
                          ? "#ECFDF5"
                          : tx.dispute?.status === "REJECTED"
                          ? "#FEF2F2"
                          : isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "#F1F5F9",
                      borderColor:
                        tx.dispute?.status === "RESOLVED"
                          ? "#A7F3D0"
                          : tx.dispute?.status === "REJECTED"
                          ? "#FECACA"
                          : colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.disputeStatusPillText,
                      {
                        color:
                          tx.dispute?.status === "RESOLVED"
                            ? "#059669"
                            : tx.dispute?.status === "REJECTED"
                            ? "#DC2626"
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {tx.dispute?.status === "RESOLVED"
                      ? "RESOLVED"
                      : tx.dispute?.status === "REJECTED"
                      ? "CLOSED"
                      : "IN REVIEW"}
                  </Text>
                </View>
              </View>

              <View style={styles.disputeRow}>
                <Text style={[styles.disputeLabel, { color: colors.textSecondary }]}>Reason:</Text>
                <Text style={[styles.disputeValue, { color: colors.text }]}>{tx.dispute?.issueType}</Text>
              </View>

              {tx.dispute?.notes ? (
                <View style={[styles.disputeNotesBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC", borderColor: colors.surfaceBorder }]}>
                  <Text style={[styles.disputeNotesLabel, { color: colors.textSecondary }]}>Your Submitted Note:</Text>
                  <Text style={[styles.disputeNotesText, { color: colors.text }]}>{tx.dispute.notes}</Text>
                </View>
              ) : null}

              {tx.dispute?.adminResponse ? (
                <View style={[styles.disputeAdminBox, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.1)" : "#FFF1F2", borderColor: colors.surfaceBorderLight }]}>
                  <Text style={[styles.disputeAdminLabel, { color: colors.primary }]}>Response from Review Team:</Text>
                  <Text style={[styles.disputeAdminText, { color: colors.text }]}>{tx.dispute.adminResponse}</Text>
                </View>
              ) : null}

              <Text style={[styles.disputeTurnaroundNotice, { color: colors.textSecondary }]}>
                {isDisputePending
                  ? "Investigation window: 1 – 48 Working Hours."
                  : "Case recorded in audit logs."}
              </Text>

              <TouchableOpacity
                style={[styles.openCaseTimelineBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9" }]}
                onPress={() =>
                  router.push({
                    pathname: "/wallet/transaction/dispute/[id]",
                    params: { id: tx.id },
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={[styles.openCaseTimelineText, { color: colors.text }]}>View Dispute Discussion & Updates</Text>
                <ExternalLink size={14} color={colors.text} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* Detailed Ledger Card */}
          <View style={[styles.ledgerCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>Transaction Information</Text>

            {/* Reference with Tap-to-Copy */}
            <View style={[styles.ledgerRow, { borderBottomColor: colors.surfaceBorder }]}>
              <Text style={[styles.ledgerLabel, { color: colors.textSecondary }]}>Reference</Text>
              <TouchableOpacity
                style={[styles.copyPill, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9" }]}
                onPress={() => handleCopy(tx.reference)}
                activeOpacity={0.7}
              >
                <Text style={[styles.copyPillText, { color: colors.text }]} numberOfLines={1}>
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
              <View style={[styles.ledgerRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.ledgerLabel, { color: colors.textSecondary }]}>Category</Text>
                <View style={styles.serviceCatPill}>
                  <Text style={styles.serviceCatText}>{tx.serviceCategory}</Text>
                </View>
              </View>
            ) : null}

            {/* Type */}
            <View style={[styles.ledgerRow, { borderBottomColor: colors.surfaceBorder }]}>
              <Text style={[styles.ledgerLabel, { color: colors.textSecondary }]}>Payment Flow</Text>
              <Text style={[styles.ledgerValue, { color: colors.text }]}>
                {isCredit ? "Wallet Credit" : "Wallet Debit"}
              </Text>
            </View>

            {/* Balances Before & After */}
            <View style={[styles.ledgerRow, { borderBottomColor: colors.surfaceBorder }]}>
              <Text style={[styles.ledgerLabel, { color: colors.textSecondary }]}>Balance Before</Text>
              <Text style={[styles.ledgerValue, { color: colors.text }]}>
                ₦{Number(tx.balanceBefore || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.ledgerRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.ledgerLabel, { color: colors.textSecondary }]}>Balance After</Text>
              <Text style={[styles.ledgerValue, { fontWeight: "800", color: colors.text }]}>
                ₦{Number(tx.balanceAfter || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* IN-APP DIGITAL RECEIPT CARD */}
          <View style={[styles.receiptCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <View style={styles.receiptTop}>
              <Receipt size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.receiptHeaderTitle, { color: colors.text }]}>Digital Receipt</Text>
            </View>

            <View style={[styles.receiptDashedLine, { borderColor: colors.surfaceBorder }]} />

            <View style={styles.receiptLineRow}>
              <Text style={[styles.receiptLineLabel, { color: colors.textSecondary }]}>Item / Description</Text>
              <Text style={[styles.receiptLineVal, { color: colors.text }]} numberOfLines={1}>
                {tx.description || (isCredit ? "Deposit" : "Service Order")}
              </Text>
            </View>

            <View style={styles.receiptLineRow}>
              <Text style={[styles.receiptLineLabel, { color: colors.textSecondary }]}>Channel</Text>
              <Text style={[styles.receiptLineVal, { color: colors.text }]}>Lorabiz Secure Wallet</Text>
            </View>

            <View style={styles.receiptLineRow}>
              <Text style={[styles.receiptLineLabel, { color: colors.textSecondary }]}>Date & Time</Text>
              <Text style={[styles.receiptLineVal, { color: colors.text }]}>
                {formattedDate} {formattedTime}
              </Text>
            </View>

            <View style={styles.receiptLineRow}>
              <Text style={[styles.receiptLineLabel, { color: colors.textSecondary }]}>Amount Paid</Text>
              <Text style={[styles.receiptLineVal, { fontWeight: "800", color: colors.text }]}>
                ₦{Number(tx.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.receiptDashedLine, { borderColor: colors.surfaceBorder }]} />

            {/* Action Buttons */}
            <View style={styles.receiptActionsRow}>
              <TouchableOpacity
                style={[styles.shareReceiptBtn, isSharing && { opacity: 0.7 }]}
                onPress={handleShareReceipt}
                disabled={isSharing}
                activeOpacity={0.8}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : (
                  <Share2 size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.shareReceiptText}>
                  {isSharing ? "Generating Receipt..." : "Share Receipt"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DISPUTE TRIGGER OR CASE ACCESS */}
          <View style={styles.disputeActionSection}>
            {hasDispute ? (
              <TouchableOpacity
                style={[styles.openDisputePageBtn, styles.openDisputeActiveBtn]}
                onPress={() =>
                  router.push({
                    pathname: "/wallet/transaction/dispute/[id]",
                    params: { id: tx.id },
                  })
                }
                activeOpacity={0.85}
              >
                <ShieldAlert size={16} color="#334155" style={{ marginRight: 8 }} />
                <Text style={[styles.openDisputePageText, { color: "#1E293B" }]}>
                  View Dispute Case & Updates
                </Text>
              </TouchableOpacity>
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
                  Dispute This Transaction
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

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    headerTitleWrap: {
      flex: 1,
      alignItems: "center",
      marginHorizontal: 10,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: "500",
    },
    shareHeaderBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
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
      color: colors.textSecondary,
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
      color: colors.text,
      marginTop: 14,
    },
    errorDesc: {
      fontSize: 13,
      color: colors.textSecondary,
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
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingVertical: 24,
      paddingHorizontal: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.04,
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
      color: colors.textSecondary,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 4,
      paddingHorizontal: 12,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      marginTop: 12,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    heroTimestamp: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 8,
      fontWeight: "500",
    },

    /* Dispute Status Card */
    disputeStatusCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 6,
      elevation: 1,
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
      color: colors.text,
    },
    disputeStatusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
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
      color: colors.textSecondary,
      fontWeight: "700",
      marginRight: 6,
    },
    disputeValue: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
      flex: 1,
    },
    disputeNotesBox: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
      padding: 10,
      borderRadius: 10,
      marginTop: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    disputeNotesLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 2,
    },
    disputeNotesText: {
      fontSize: 12,
      color: colors.text,
      lineHeight: 16,
    },
    disputeAdminBox: {
      backgroundColor: isDark ? "rgba(200, 45, 117, 0.12)" : "#F0FDF4",
      padding: 10,
      borderRadius: 10,
      marginTop: 8,
      borderWidth: 1,
      borderColor: isDark ? "rgba(200, 45, 117, 0.3)" : "#BBF7D0",
    },
    disputeAdminLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: isDark ? colors.primary : "#166534",
      marginBottom: 2,
    },
    disputeAdminText: {
      fontSize: 12,
      color: isDark ? colors.text : "#14532D",
      lineHeight: 16,
    },
    disputeTurnaroundNotice: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 10,
      fontStyle: "italic",
    },
    openCaseTimelineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F8FAFC",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 10,
      paddingVertical: 10,
      marginTop: 12,
    },
    openCaseTimelineText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.text,
    },

    /* Ledger Information Card */
    ledgerCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionHeaderTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
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
      borderBottomColor: colors.surfaceBorder,
    },
    ledgerLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    ledgerValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "700",
    },
    copyPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      maxWidth: 200,
    },
    copyPillText: {
      fontSize: 11,
      color: colors.text,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontWeight: "700",
    },
    serviceCatPill: {
      backgroundColor: "rgba(200, 45, 117, 0.12)",
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
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.03,
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
      color: colors.text,
    },
    receiptDashedLine: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
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
      color: colors.textSecondary,
      fontWeight: "600",
    },
    receiptLineVal: {
      fontSize: 12,
      color: colors.text,
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
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.06)",
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.2)",
    },
    openDisputePageText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#DC2626",
    },
    openDisputeActiveBtn: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F8FAFC",
      borderColor: colors.surfaceBorder,
    },
    disputePendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FFFBEB",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
    },
    disputePendingText: {
      fontSize: 12,
      color: isDark ? "#FBBF24" : "#92400E",
      fontWeight: "600",
      flex: 1,
      lineHeight: 16,
    },

    complianceNote: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 16,
      paddingHorizontal: 16,
      marginTop: 8,
    },
  });
