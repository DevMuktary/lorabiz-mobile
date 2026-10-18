import React, { useState } from "react";
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
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../../../constants/theme";
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

  const [selectedReason, setSelectedReason] = useState(DISPUTE_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch transaction details
  const { data: tx, isLoading } = useQuery({
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
  });

  const isPendingDispute = tx?.dispute?.status === "PENDING";

  const handleSubmit = async () => {
    if (!tx) return;
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
        setIsSuccess(true);
        setSuccessMessage(
          res.message || "Dispute submitted successfully. Our team will review your case within 1 – 48 Working Hours."
        );
        // Invalidate transaction queries so parent screens update immediately
        queryClient.invalidateQueries({ queryKey: ["transactionDetail", id] });
        queryClient.invalidateQueries({ queryKey: ["mobileAllTransactions"] });
      } else {
        setSubmitError(res?.message || "Unable to submit dispute at this time.");
      }
    } catch (err: any) {
      setSubmitError(err?.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <Text style={styles.headerTitle}>Dispute Transaction</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {tx?.reference ? `Ref: ${tx.reference}` : "Case Filing"}
          </Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading transaction...</Text>
        </View>
      ) : isSuccess ? (
        /* Success State */
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[styles.successContainer, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
        >
          <View style={styles.successIconCircle}>
            <CheckCircle2 size={44} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Dispute Filed Successfully</Text>
          <Text style={styles.successMsg}>{successMessage}</Text>

          <View style={styles.successInfoCard}>
            <Text style={styles.successInfoLabel}>Transaction Reference</Text>
            <Text style={styles.successInfoValue}>{tx?.reference}</Text>

            <View style={styles.divider} />

            <Text style={styles.successInfoLabel}>Reason Filed</Text>
            <Text style={styles.successInfoValue}>{selectedReason}</Text>

            <View style={styles.divider} />

            <Text style={styles.successInfoLabel}>Investigation Window</Text>
            <Text style={[styles.successInfoValue, { color: colors.primary, fontWeight: "800" }]}>
              1 – 48 Working Hours
            </Text>
          </View>

          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/activity");
              }
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.returnBtnText}>Back to Transaction</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : isPendingDispute ? (
        /* Duplicate Dispute Blocked State */
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[styles.pendingContainer, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
        >
          <View style={styles.pendingIconCircle}>
            <Clock3 size={40} color="#D97706" />
          </View>

          <Text style={styles.pendingTitle}>Dispute Already Active</Text>
          <Text style={styles.pendingSubtitle}>
            A dispute for this transaction is currently under review by our compliance team. You cannot submit multiple dispute requests for the same transaction until the active case is concluded.
          </Text>

          {/* Active Dispute Summary Card */}
          <View style={styles.activeCaseCard}>
            <View style={styles.activeCaseHeader}>
              <Text style={styles.activeCaseHeaderTitle}>Active Case Details</Text>
              <View style={styles.activeCaseStatusPill}>
                <Text style={styles.activeCaseStatusText}>UNDER REVIEW</Text>
              </View>
            </View>

            <View style={styles.caseRow}>
              <Text style={styles.caseLabel}>Reason:</Text>
              <Text style={styles.caseValue}>{tx?.dispute?.issueType}</Text>
            </View>

            {tx?.dispute?.notes ? (
              <View style={styles.caseNotesBox}>
                <Text style={styles.caseNotesLabel}>Submitted Note:</Text>
                <Text style={styles.caseNotesText}>{tx?.dispute?.notes}</Text>
              </View>
            ) : null}

            <View style={styles.turnaroundBox}>
              <Clock3 size={14} color="#B45309" style={{ marginRight: 6 }} />
              <Text style={styles.turnaroundText}>
                Turnaround window: 1 – 48 Working Hours
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => router.back()}
            activeOpacity={0.88}
          >
            <Text style={styles.returnBtnText}>Return to Transaction Details</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* Dispute Filing Form */
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={[
              styles.formContainer,
              { paddingBottom: Math.max(insets.bottom, 24) + 32 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. REGULATORY / FRAUD WARNING BANNER (as explicitly requested) */}
            <View style={styles.regulatoryWarningCard}>
              <View style={styles.warningHeader}>
                <AlertTriangle size={18} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.warningTitle}>Security & Policy Notice</Text>
              </View>
              <Text style={styles.warningBody}>
                Warning: False dispute requests or fraudulent claims may result in immediate account restriction or permanent suspension under our terms of service.
              </Text>
            </View>

            {/* 2. Transaction Summary Header */}
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

            {/* 3. Reason Selection */}
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

            {/* 4. Detailed Notes Textarea */}
            <Text style={styles.sectionTitle}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.notesTextarea}
              placeholder="Provide specific details about what occurred (e.g., service error, transmission timeout, or expected deliverable)..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Turnaround Notice */}
            <View style={styles.turnaroundNoticeRow}>
              <Clock3 size={14} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.turnaroundNoticeText}>
                Dispute investigation turnaround: 1 – 48 Working Hours
              </Text>
            </View>

            {/* Error Message */}
            {submitError ? (
              <View style={styles.errorInline}>
                <AlertCircle size={15} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Dispute Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
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
  scrollContent: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },

  /* Regulatory Warning Card */
  regulatoryWarningCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#B91C1C",
  },
  warningBody: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 18,
    fontWeight: "600",
  },

  /* Mini Transaction Summary Card */
  txMiniCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  txMiniDesc: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  txMiniRef: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  txMiniAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginLeft: 10,
  },

  /* Reasons List */
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  reasonsList: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reasonItemActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(200, 45, 117, 0.04)",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  reasonText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
    flex: 1,
  },
  reasonTextActive: {
    color: "#0F172A",
    fontWeight: "700",
  },

  /* Notes */
  notesTextarea: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 90,
  },
  turnaroundNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  turnaroundNoticeText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },

  /* Error */
  errorInline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: "600",
    flex: 1,
  },

  /* Primary Button */
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  /* Success View */
  successContainer: {
    padding: 24,
    alignItems: "center",
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  successMsg: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  successInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  successInfoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 2,
  },
  successInfoValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  returnBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    width: "100%",
  },
  returnBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  /* Pending View */
  pendingContainer: {
    padding: 24,
    alignItems: "center",
  },
  pendingIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  pendingTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#92400E",
    textAlign: "center",
  },
  pendingSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  activeCaseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  activeCaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  activeCaseHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  activeCaseStatusPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeCaseStatusText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.3,
  },
  caseRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  caseLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginRight: 6,
  },
  caseValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },
  caseNotesBox: {
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  caseNotesLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 2,
  },
  caseNotesText: {
    fontSize: 12,
    color: "#1E293B",
  },
  turnaroundBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  turnaroundText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
  },
});
