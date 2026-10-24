import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Check,
  Send,
  MessageSquare,
  ShieldCheck,
  RotateCw,
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../../../../context/ThemeContext";
import { api } from "../../../../lib/api";

const DISPUTE_REASONS = [
  "Debited but service not delivered",
  "Double debit on wallet balance",
  "Incorrect amount debited",
  "Payment gateway delayed / pending",
  "Other transaction issue",
];

export default function TransactionDisputeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Filing state
  const [selectedReason, setSelectedReason] = useState(DISPUTE_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Comment state for ongoing dispute discussion
  const [followUpComment, setFollowUpComment] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Fetch complete real-time transaction details including dispute case & message history
  const {
    data: tx,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["transactionDetail", id],
    queryFn: async () => {
      if (!id) return null;
      try {
        const res = await api.get(`/api/user/transactions/${id}`);
        return res?.transaction || null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data: any = query.state.data;
      if (data?.dispute && data.dispute.status === "PENDING") {
        return 4000;
      }
      return false;
    },
  });

  const hasDispute = !!tx?.dispute;
  const isDisputePending = tx?.dispute?.status === "PENDING";
  const isDisputeResolved = tx?.dispute?.status === "RESOLVED";

  // Submit new dispute
  const handleSubmitNewDispute = async () => {
    if (!tx || isSubmitting) return;
    setSubmitError(null);

    if (!selectedReason) {
      setSubmitError("Please select a dispute reason.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await api.post("/api/user/transactions/dispute", {
        transactionId: tx.id,
        issueType: selectedReason,
        notes: notes.trim(),
      });

      if (res?.success) {
        setNotes("");
        await queryClient.invalidateQueries({ queryKey: ["transactionDetail", id] });
        await queryClient.invalidateQueries({ queryKey: ["mobileAllTransactions"] });
      } else {
        setSubmitError(res?.message || "Unable to submit dispute at this time.");
      }
    } catch (err: any) {
      setSubmitError(err?.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit follow-up comment to ongoing dispute thread
  const handleSendFollowUp = async () => {
    if (!tx || !followUpComment.trim() || isSendingComment) return;
    setCommentError(null);
    setIsSendingComment(true);

    try {
      const res: any = await api.post("/api/user/transactions/dispute", {
        transactionId: tx.id,
        comment: followUpComment.trim(),
      });

      if (res?.success) {
        setFollowUpComment("");
        Keyboard.dismiss();
        await queryClient.invalidateQueries({ queryKey: ["transactionDetail", id] });
      } else {
        setCommentError(res?.message || "Could not post follow-up message.");
      }
    } catch (err: any) {
      setCommentError(err?.message || "Network error. Please try again.");
    } finally {
      setIsSendingComment(false);
    }
  };

  const rawMessages = tx?.dispute?.messages || [];
  const threadMessages = rawMessages.length > 0
    ? rawMessages
    : tx?.dispute
    ? [
        {
          id: "msg_init",
          sender: "USER",
          text: tx.dispute.notes ? `${tx.dispute.issueType}: ${tx.dispute.notes}` : tx.dispute.issueType,
          createdAt: tx.dispute.createdAt,
        },
        ...(tx.dispute.adminResponse
          ? [
              {
                id: "msg_admin",
                sender: "SUPPORT",
                text: tx.dispute.adminResponse,
                createdAt: tx.dispute.updatedAt || tx.dispute.createdAt,
              },
            ]
          : []),
      ]
    : [];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
          <Text style={styles.headerTitle}>
            {hasDispute ? "Dispute Case & Updates" : "Dispute Transaction"}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {tx?.reference ? `Ref: ${tx.reference}` : "Support Investigation"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.refreshBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <RotateCw size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading case details...</Text>
        </View>
      ) : hasDispute ? (
        /* =================================================================== */
        /* SCREEN STATE A: ONGOING DISPUTE CASE & DISCUSSION THREAD            */
        /* =================================================================== */
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={[
              styles.caseHubContainer,
              { paddingBottom: Math.max(insets.bottom, 24) + 120 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Case Overview Card */}
            <View style={styles.caseCard}>
              <View style={styles.caseCardHeader}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.caseCardTag}>CASE STATUS</Text>
                  <Text style={styles.caseIssueType} numberOfLines={2}>
                    {tx?.dispute?.issueType || "Transaction Inquiry"}
                  </Text>
                </View>

                {/* Sleek Slate Status Badge */}
                <View
                  style={[
                    styles.caseStatusBadge,
                    {
                      backgroundColor: isDisputeResolved
                        ? "#ECFDF5"
                        : tx?.dispute?.status === "REJECTED"
                        ? "#FEF2F2"
                        : "#F1F5F9",
                      borderColor: isDisputeResolved
                        ? "#A7F3D0"
                        : tx?.dispute?.status === "REJECTED"
                        ? "#FECACA"
                        : "#CBD5E1",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: isDisputeResolved
                          ? "#10B981"
                          : tx?.dispute?.status === "REJECTED"
                          ? "#EF4444"
                          : "#475569",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.caseStatusText,
                      {
                        color: isDisputeResolved
                          ? "#065F46"
                          : tx?.dispute?.status === "REJECTED"
                          ? "#991B1B"
                          : "#1E293B",
                      },
                    ]}
                  >
                    {isDisputeResolved
                      ? "RESOLVED"
                      : tx?.dispute?.status === "REJECTED"
                      ? "CLOSED"
                      : "UNDER INVESTIGATION"}
                  </Text>
                </View>
              </View>

              {/* Transaction Mini Ledger */}
              <View style={styles.caseTxBox}>
                <View style={styles.caseTxRow}>
                  <Text style={styles.caseTxLabel}>Transaction Reference</Text>
                  <Text style={styles.caseTxVal}>{tx?.reference}</Text>
                </View>
                <View style={styles.caseTxRow}>
                  <Text style={styles.caseTxLabel}>Disputed Amount</Text>
                  <Text style={[styles.caseTxVal, { fontWeight: "800", color: "#0F172A" }]}>
                    ₦{Number(tx?.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.caseTxRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.caseTxLabel}>Date Filed</Text>
                  <Text style={styles.caseTxVal}>
                    {tx?.dispute?.createdAt
                      ? new Date(tx.dispute.createdAt).toLocaleString("en-NG", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recent"}
                  </Text>
                </View>
              </View>

              {/* SLA Turnaround Pill */}
              <View style={styles.turnaroundBar}>
                <Clock3 size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.turnaroundBarText}>
                  Standard Review Turnaround: <Text style={{ fontWeight: "800", color: "#0F172A" }}>1 – 48 Working Hours</Text>
                </Text>
              </View>
            </View>

            {/* Investigation Progress Stages */}
            <View style={styles.stagesCard}>
              <Text style={styles.stagesTitle}>Investigation Timeline</Text>
              <View style={styles.stagesList}>
                {/* Stage 1: Received */}
                <View style={styles.stageItem}>
                  <View style={[styles.stageIconWrap, styles.stageIconCompleted]}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                  <View style={styles.stageContent}>
                    <Text style={styles.stageName}>Dispute Received & Logged</Text>
                    <Text style={styles.stageDesc}>Case created in security audit log</Text>
                  </View>
                </View>

                {/* Connector */}
                <View style={[styles.stageConnector, styles.stageConnectorActive]} />

                {/* Stage 2: In Review */}
                <View style={styles.stageItem}>
                  <View
                    style={[
                      styles.stageIconWrap,
                      isDisputeResolved ? styles.stageIconCompleted : styles.stageIconCurrent,
                    ]}
                  >
                    {isDisputeResolved ? (
                      <Check size={12} color="#FFFFFF" />
                    ) : (
                      <View style={styles.pulseInnerDot} />
                    )}
                  </View>
                  <View style={styles.stageContent}>
                    <Text style={styles.stageName}>Compliance Review</Text>
                    <Text style={styles.stageDesc}>
                      {isDisputeResolved
                        ? "Investigation concluded"
                        : "Our review team is auditing the gateway settlement"}
                    </Text>
                  </View>
                </View>

                {/* Connector */}
                <View
                  style={[
                    styles.stageConnector,
                    isDisputeResolved && styles.stageConnectorActive,
                  ]}
                />

                {/* Stage 3: Resolution */}
                <View style={styles.stageItem}>
                  <View
                    style={[
                      styles.stageIconWrap,
                      isDisputeResolved ? styles.stageIconCompleted : styles.stageIconPending,
                    ]}
                  >
                    {isDisputeResolved ? (
                      <Check size={12} color="#FFFFFF" />
                    ) : (
                      <View style={[styles.pulseInnerDot, { backgroundColor: "#94A3B8" }]} />
                    )}
                  </View>
                  <View style={styles.stageContent}>
                    <Text style={styles.stageName}>Final Resolution</Text>
                    <Text style={styles.stageDesc}>
                      {isDisputeResolved
                        ? "Case resolved and balance reconciled"
                        : "Pending conclusion of gateway audit"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Conversation / Update Thread */}
            <View style={styles.threadSection}>
              <View style={styles.threadHeader}>
                <MessageSquare size={16} color="#0F172A" style={{ marginRight: 6 }} />
                <Text style={styles.threadTitle}>Case Discussion & Notes</Text>
              </View>

              {threadMessages.length === 0 ? (
                <View style={styles.emptyThreadCard}>
                  <Text style={styles.emptyThreadText}>No messages yet in this case thread.</Text>
                </View>
              ) : (
                <View style={styles.messagesList}>
                  {threadMessages.map((msg: any, idx: number) => {
                    const isUser = msg.sender === "USER";
                    const formattedMsgTime = msg.createdAt
                      ? new Date(msg.createdAt).toLocaleString("en-NG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <View
                        key={msg.id || idx}
                        style={[
                          styles.messageBubbleWrap,
                          isUser ? styles.messageBubbleUserWrap : styles.messageBubbleSupportWrap,
                        ]}
                      >
                        <View style={styles.messageSenderRow}>
                          {!isUser && (
                            <View style={styles.supportAvatar}>
                              <ShieldCheck size={12} color="#FFFFFF" />
                            </View>
                          )}
                          <Text style={styles.messageSenderName}>
                            {isUser ? "You" : "Compliance Review Team"}
                          </Text>
                          {formattedMsgTime ? (
                            <Text style={styles.messageTime}>{formattedMsgTime}</Text>
                          ) : null}
                        </View>

                        <View
                          style={[
                            styles.messageBubble,
                            isUser ? styles.messageBubbleUser : styles.messageBubbleSupport,
                          ]}
                        >
                          <Text
                            style={[
                              styles.messageText,
                              isUser ? styles.messageTextUser : styles.messageTextSupport,
                            ]}
                          >
                            {msg.text}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Bar: Closed Notice if Resolved/Closed, else Active Comment Bar */}
          {isDisputeResolved || tx?.dispute?.status === "REJECTED" ? (
            <View style={[styles.bottomClosedBar, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
              <View
                style={[
                  styles.closedNoticeBox,
                  {
                    backgroundColor: isDisputeResolved
                      ? isDark
                        ? "rgba(16, 185, 129, 0.12)"
                        : "#ECFDF5"
                      : isDark
                      ? "rgba(239, 68, 68, 0.12)"
                      : "#FEF2F2",
                    borderColor: isDisputeResolved
                      ? isDark
                        ? "rgba(16, 185, 129, 0.3)"
                        : "#A7F3D0"
                      : isDark
                      ? "rgba(239, 68, 68, 0.3)"
                      : "#FECACA",
                  },
                ]}
              >
                {isDisputeResolved ? (
                  <CheckCircle2 size={16} color="#10B981" style={{ marginRight: 8, marginTop: 1 }} />
                ) : (
                  <AlertCircle size={16} color="#EF4444" style={{ marginRight: 8, marginTop: 1 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.closedNoticeTitle,
                      {
                        color: isDisputeResolved
                          ? isDark
                            ? "#34D399"
                            : "#065F46"
                          : isDark
                          ? "#F87171"
                          : "#991B1B",
                      },
                    ]}
                  >
                    {isDisputeResolved ? "Dispute Case Resolved" : "Dispute Case Closed"}
                  </Text>
                  <Text
                    style={[
                      styles.closedNoticeSub,
                      {
                        color: isDisputeResolved
                          ? isDark
                            ? "#A7F3D0"
                            : "#047857"
                          : isDark
                          ? "#FCA5A5"
                          : "#B91C1C",
                      },
                    ]}
                  >
                    {isDisputeResolved
                      ? "This dispute has been resolved and reconciled. Messaging is closed."
                      : "This dispute case has been reviewed and closed by compliance. Messaging is closed."}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.bottomCommentBar, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
              {commentError ? (
                <Text style={styles.commentErrorText}>{commentError}</Text>
              ) : null}

              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Type a follow-up message or detail..."
                  placeholderTextColor={colors.textMuted}
                  value={followUpComment}
                  onChangeText={(txt) => {
                    setFollowUpComment(txt);
                    if (commentError) setCommentError(null);
                  }}
                  multiline
                  maxLength={500}
                />

                <TouchableOpacity
                  style={[
                    styles.sendCommentBtn,
                    (!followUpComment.trim() || isSendingComment) && styles.sendCommentBtnDisabled,
                  ]}
                  onPress={handleSendFollowUp}
                  disabled={!followUpComment.trim() || isSendingComment}
                  activeOpacity={0.8}
                >
                  {isSendingComment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        /* =================================================================== */
        /* SCREEN STATE B: DISPUTE FILING FORM (NO DISPUTE FILED YET)          */
        /* =================================================================== */
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={[
              styles.formContainer,
              { paddingBottom: Math.max(insets.bottom, 24) + 32 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Regulatory Fraud Notice */}
            <View style={styles.regulatoryWarningCard}>
              <View style={styles.warningHeader}>
                <AlertTriangle size={18} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.warningTitle}>Security & Policy Notice</Text>
              </View>
              <Text style={styles.warningBody}>
                Warning: False dispute requests or fraudulent claims may result in immediate account restriction or permanent suspension under our terms of service.
              </Text>
            </View>

            {/* Transaction Summary Header */}
            {tx ? (
              <View style={styles.txMiniCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txMiniDesc} numberOfLines={1}>
                    {tx.description || "Service Order"}
                  </Text>
                  <Text style={styles.txMiniRef}>Ref: {tx.reference}</Text>
                </View>
                <Text style={styles.txMiniAmount}>
                  ₦{Number(tx.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ) : null}

            {/* Reason Selection */}
            <Text style={styles.sectionTitle}>Select Issue Reason</Text>
            <View style={styles.reasonsList}>
              {DISPUTE_REASONS.map((r) => {
                const isSelected = selectedReason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonItem, isSelected && styles.reasonItemActive]}
                    onPress={() => setSelectedReason(r)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleActive,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text
                      style={[
                        styles.reasonText,
                        isSelected && styles.reasonTextActive,
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Detailed Explanation */}
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <Text style={styles.sectionSubtitle}>
              Explain what occurred (e.g. error code, payment method, bank account debited).
            </Text>
            <View style={styles.textAreaCard}>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the issue with this transaction..."
                placeholderTextColor="#94A3B8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                maxLength={400}
                textAlignVertical="top"
              />
              <Text style={styles.charCounter}>{notes.length} / 400</Text>
            </View>

            {/* SLA Turnaround Notice */}
            <View style={styles.turnaroundBox}>
              <Clock3 size={15} color="#475569" style={{ marginRight: 8 }} />
              <Text style={styles.turnaroundText}>
                Turnaround window: <Text style={{ fontWeight: "700", color: "#0F172A" }}>1 – 48 Working Hours</Text>. Our compliance team audits all logs.
              </Text>
            </View>

            {/* Inline Error Notice */}
            {submitError ? (
              <View style={styles.errorInline}>
                <AlertCircle size={15} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}

            {/* Submit Action Button */}
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
              onPress={handleSubmitNewDispute}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Dispute Case</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
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
      backgroundColor: isDark ? colors.surface : "#F8FAFC",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    refreshBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? colors.surface : "#F8FAFC",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    headerTitleWrap: {
      flex: 1,
      alignItems: "center",
      marginHorizontal: 12,
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
    scrollContent: {
      flex: 1,
    },

    /* ------------------------------------------------------------------ */
    /* ONGOING CASE HUB STYLES (Screen State A)                           */
    /* ------------------------------------------------------------------ */
    caseHubContainer: {
      padding: 16,
      gap: 16,
    },
    caseCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    caseCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    caseCardTag: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    caseIssueType: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
      lineHeight: 20,
    },
    caseStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 100,
      borderWidth: 1,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },
    caseStatusText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    caseTxBox: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: 12,
    },
    caseTxRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    caseTxLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    caseTxVal: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "700",
    },
    turnaroundBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    turnaroundBarText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "500",
    },

    /* Investigation Stages */
    stagesCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    stagesTitle: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: colors.text,
      textTransform: "uppercase",
      marginBottom: 16,
    },
    stagesList: {
      paddingLeft: 4,
    },
    stageItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    stageIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    stageIconCompleted: {
      backgroundColor: "#10B981",
    },
    stageIconCurrent: {
      backgroundColor: isDark ? colors.primaryLight : "#0F172A",
    },
    stageIconPending: {
      backgroundColor: colors.surfaceBorder,
    },
    pulseInnerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#FFFFFF",
    },
    stageConnector: {
      width: 2,
      height: 22,
      backgroundColor: colors.surfaceBorder,
      marginLeft: 12,
      marginVertical: 2,
    },
    stageConnectorActive: {
      backgroundColor: "#10B981",
    },
    stageContent: {
      marginLeft: 12,
      flex: 1,
    },
    stageName: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    stageDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },

    /* Conversation Thread */
    threadSection: {
      marginTop: 4,
    },
    threadHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    threadTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    emptyThreadCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 18,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    emptyThreadText: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: "italic",
    },
    messagesList: {
      gap: 12,
    },
    messageBubbleWrap: {
      maxWidth: "92%",
    },
    messageBubbleUserWrap: {
      alignSelf: "flex-end",
    },
    messageBubbleSupportWrap: {
      alignSelf: "flex-start",
    },
    messageSenderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
      gap: 6,
    },
    supportAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: isDark ? colors.primaryLight : "#0F172A",
      alignItems: "center",
      justifyContent: "center",
    },
    messageSenderName: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    messageTime: {
      fontSize: 10,
      color: colors.textMuted,
    },
    messageBubble: {
      padding: 14,
      borderRadius: 16,
    },
    messageBubbleUser: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    messageBubbleSupport: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 13,
      lineHeight: 18,
    },
    messageTextUser: {
      color: "#FFFFFF",
      fontWeight: "500",
    },
    messageTextSupport: {
      color: colors.text,
      fontWeight: "500",
    },

    /* Sticky Bottom Comment Input Bar */
    bottomCommentBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      paddingTop: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 8,
    },
    bottomClosedBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      paddingTop: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 8,
    },
    closedNoticeBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
    },
    closedNoticeTitle: {
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 2,
    },
    closedNoticeSub: {
      fontSize: 11,
      lineHeight: 16,
    },
    commentErrorText: {
      fontSize: 11,
      color: colors.error,
      marginBottom: 6,
      fontWeight: "600",
    },
    commentInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    commentInput: {
      flex: 1,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 13,
      color: colors.text,
      maxHeight: 100,
    },
    sendCommentBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendCommentBtnDisabled: {
      backgroundColor: isDark ? "#334155" : "#CBD5E1",
    },

    /* ------------------------------------------------------------------ */
    /* DISPUTE FILING FORM STYLES (Screen State B)                        */
    /* ------------------------------------------------------------------ */
    formContainer: {
      padding: 16,
    },
    regulatoryWarningCard: {
      backgroundColor: "rgba(239, 68, 68, 0.06)",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.2)",
      padding: 14,
      marginBottom: 16,
    },
    warningHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    warningTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: "#DC2626",
    },
    warningBody: {
      fontSize: 12,
      color: isDark ? "#FCA5A5" : "#991B1B",
      lineHeight: 17,
    },
    txMiniCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 20,
    },
    txMiniDesc: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    txMiniRef: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    txMiniAmount: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 10,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 10,
      marginTop: -4,
    },
    reasonsList: {
      gap: 8,
      marginBottom: 20,
    },
    reasonItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    reasonItemActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? "rgba(200, 45, 117, 0.12)" : "rgba(200, 45, 117, 0.04)",
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    radioCircleActive: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    reasonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },
    reasonTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    textAreaCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
    },
    textArea: {
      minHeight: 90,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    charCounter: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: "right",
      marginTop: 4,
    },
    turnaroundBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9",
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    turnaroundText: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 16,
      flex: 1,
    },
    errorInline: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(239, 68, 68, 0.08)",
      padding: 10,
      borderRadius: 10,
      marginBottom: 14,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      fontWeight: "600",
      flex: 1,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    submitBtnText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    btnDisabled: {
      opacity: 0.65,
    },
  });
