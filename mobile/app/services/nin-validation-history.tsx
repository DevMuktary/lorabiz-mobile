import React, { useState, useMemo, useEffect } from "react";
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
  Modal,
  ScrollView,
  Share,
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
  ShieldCheck,
  Share2,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export interface ValidationTicket {
  id: string;
  category: string;
  nin: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  amountCharged: number;
  transactionRef: string;
  failureReason?: string | null;
  adminNotes?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

const CATEGORY_MAP: Record<string, { label: string; desc: string }> = {
  NO_RECORD_FOUND: {
    label: "No Record Found",
    desc: "Resolves NIN records not appearing on NIMC verification portals",
  },
  VNIN_VALIDATION: {
    label: "SIM/Bank & VNIN Validation",
    desc: "Synchronizes NIN with telecom operators and commercial bank KYC",
  },
  UPDATE_RECORD_MOD: {
    label: "Modification Validation",
    desc: "Reflects recent name, date of birth, or biometric modifications",
  },
  PHOTO_ERROR: {
    label: "Photographic Error",
    desc: "Resolves missing photo or image transmission mismatch errors",
  },
};

type FilterTab = "ALL" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function NinValidationHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<ValidationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Live status checking state
  const [checkingTicketId, setCheckingTicketId] = useState<string | null>(null);

  // Copied feedback
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  // Inspection Modal
  const [selectedTicket, setSelectedTicket] = useState<ValidationTicket | null>(null);

  // Alert Modal
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

  const fetchHistory = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg(null);

    try {
      const data = await api.get("/api/nin/validation/history");
      if (data && data.success) {
        setTickets(data.history || []);
      } else {
        setErrorMsg(data?.message || "Failed to load validation history.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to load records. Check your internet connection.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCopy = async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Ignore fallback
    }
    setCopiedValue(text);
    setTimeout(() => {
      setCopiedValue((prev) => (prev === text ? null : prev));
    }, 2000);
  };

  const handleShare = async (ticket: ValidationTicket) => {
    try {
      const cat = CATEGORY_MAP[ticket.category]?.label || ticket.category;
      await Share.share({
        message: `Lorabiz NIN Validation Record\nCategory: ${cat}\nNIN: ${ticket.nin}\nStatus: ${ticket.status}\nRef: ${ticket.transactionRef}\nFee: ₦${ticket.amountCharged.toLocaleString()}`,
      });
    } catch {
      // Ignore
    }
  };

  const handleCheckStatus = async (ticket: ValidationTicket) => {
    if (checkingTicketId) return;
    setCheckingTicketId(ticket.id);

    try {
      const res = await api.get(`/api/nin/validation/status?reference=${encodeURIComponent(ticket.transactionRef)}`);
      if (res && res.success && res.ticket) {
        const updatedTicket: ValidationTicket = {
          id: res.ticket.id,
          category: res.ticket.category,
          nin: res.ticket.nin,
          status: res.ticket.status,
          amountCharged: Number(res.ticket.amountCharged),
          transactionRef: res.ticket.transactionRef,
          failureReason: res.ticket.failureReason,
          adminNotes: res.ticket.adminNotes,
          completedAt: res.ticket.completedAt,
          createdAt: res.ticket.createdAt,
        };

        // Update list state
        setTickets((prev) =>
          prev.map((t) => (t.id === updatedTicket.id || t.transactionRef === updatedTicket.transactionRef ? updatedTicket : t))
        );

        // Update modal state if open
        if (selectedTicket && (selectedTicket.id === updatedTicket.id || selectedTicket.transactionRef === updatedTicket.transactionRef)) {
          setSelectedTicket(updatedTicket);
        }

        const catName = CATEGORY_MAP[updatedTicket.category]?.label || updatedTicket.category;

        if (updatedTicket.status === "COMPLETED") {
          setAlertConfig({
            visible: true,
            type: "success",
            title: "Validation Validated!",
            message: `NIN ${updatedTicket.nin} (${catName}) has been validated successfully on the national identity database.`,
            confirmText: "Great",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
        } else if (updatedTicket.status === "FAILED") {
          setAlertConfig({
            visible: true,
            type: "error",
            title: "Validation Failed",
            message: updatedTicket.failureReason || "Validation request could not be completed on NIMC gateway.",
            confirmText: "Understood",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
        } else {
          setAlertConfig({
            visible: true,
            type: "info",
            title: "Still Processing",
            message: "Your ticket is actively queued with NIMC. Standard processing window is 24 to 48 Business Hours (1 to 2 Working Days).",
            confirmText: "Got It",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
        }
      } else {
        setAlertConfig({
          visible: true,
          type: "warning",
          title: "Status Check",
          message: res?.message || "Unable to fetch live status update. Please try again later.",
          confirmText: "OK",
          onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
        });
      }
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Connection Error",
        message: err?.message || "Failed to check status. Check your network connection.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setCheckingTicketId(null);
    }
  };

  // Filtered & searched tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (activeFilter === "PROCESSING" && t.status !== "PROCESSING") return false;
      if (activeFilter === "COMPLETED" && t.status !== "COMPLETED") return false;
      if (activeFilter === "FAILED" && t.status !== "FAILED") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const catLabel = (CATEGORY_MAP[t.category]?.label || t.category).toLowerCase();
        const matchesNin = t.nin.toLowerCase().includes(q);
        const matchesRef = t.transactionRef.toLowerCase().includes(q);
        const matchesCat = catLabel.includes(q);
        return matchesNin || matchesRef || matchesCat;
      }
      return true;
    });
  }, [tickets, activeFilter, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    let processing = 0;
    let completed = 0;
    let failed = 0;
    tickets.forEach((t) => {
      if (t.status === "PROCESSING") processing++;
      else if (t.status === "COMPLETED") completed++;
      else if (t.status === "FAILED") failed++;
    });
    return {
      all: tickets.length,
      processing,
      completed,
      failed,
    };
  }, [tickets]);

  const renderStatusBadge = (status: "PROCESSING" | "COMPLETED" | "FAILED", isCompact = false) => {
    if (status === "COMPLETED") {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeCompleted, isCompact && styles.statusBadgeCompact]}>
          <CheckCircle2 size={isCompact ? 11 : 12} color="#059669" style={{ marginRight: 4 }} />
          <Text style={[styles.statusText, styles.statusTextCompleted, isCompact && styles.statusTextCompact]}>
            Validated
          </Text>
        </View>
      );
    }
    if (status === "FAILED") {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeFailed, isCompact && styles.statusBadgeCompact]}>
          <AlertCircle size={isCompact ? 11 : 12} color="#DC2626" style={{ marginRight: 4 }} />
          <Text style={[styles.statusText, styles.statusTextFailed, isCompact && styles.statusTextCompact]}>
            Failed
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.statusBadgeProcessing, isCompact && styles.statusBadgeCompact]}>
        <Clock size={isCompact ? 11 : 12} color="#D97706" style={{ marginRight: 4 }} />
        <Text style={[styles.statusText, styles.statusTextProcessing, isCompact && styles.statusTextCompact]}>
          In Processing
        </Text>
      </View>
    );
  };

  const renderTicketCard = ({ item }: { item: ValidationTicket }) => {
    const cat = CATEGORY_MAP[item.category] || {
      label: item.category.replace(/_/g, " "),
      desc: "NIN Validation Record",
    };
    const isChecking = checkingTicketId === item.id;
    const isCopiedNin = copiedValue === item.nin;
    const isCopiedRef = copiedValue === item.transactionRef;

    const formattedDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Recent";

    return (
      <View style={styles.card}>
        {/* Card Header: Category & Status */}
        <View style={styles.cardHeader}>
          <View style={styles.catWrap}>
            <Text style={styles.catLabel} numberOfLines={1}>
              {cat.label}
            </Text>
          </View>
          {renderStatusBadge(item.status)}
        </View>

        {/* NIN Row */}
        <View style={styles.cardRow}>
          <Text style={styles.cardRowLabel}>Submitted NIN</Text>
          <View style={styles.cardRowValueGroup}>
            <Text style={styles.ninMono}>{item.nin}</Text>
            <TouchableOpacity
              style={styles.copyPill}
              onPress={() => handleCopy(item.nin)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              {isCopiedNin ? (
                <>
                  <Check size={11} color="#059669" />
                  <Text style={styles.copyPillTextCopied}>Copied</Text>
                </>
              ) : (
                <>
                  <Copy size={11} color="#64748B" />
                  <Text style={styles.copyPillText}>Copy</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Reference Row */}
        <View style={styles.cardRow}>
          <Text style={styles.cardRowLabel}>Reference</Text>
          <View style={styles.cardRowValueGroup}>
            <Text style={styles.refMono} numberOfLines={1} ellipsizeMode="middle">
              {item.transactionRef}
            </Text>
            <TouchableOpacity
              style={styles.copyIconBtn}
              onPress={() => handleCopy(item.transactionRef)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              {isCopiedRef ? <Check size={12} color="#059669" /> : <Copy size={12} color="#64748B" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Fee & Date Row */}
        <View style={styles.cardMetaRow}>
          <View>
            <Text style={styles.cardMetaSubLabel}>Amount Paid</Text>
            <Text style={styles.amountText}>
              {item.amountCharged === 0 ? "Free Pass" : `₦${item.amountCharged.toLocaleString()}`}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.cardMetaSubLabel}>Submitted</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
        </View>

        {/* Failure reason callout if failed */}
        {item.status === "FAILED" && item.failureReason && (
          <View style={styles.cardFailureBox}>
            <AlertCircle size={13} color="#DC2626" style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={styles.cardFailureText} numberOfLines={2}>
              {item.failureReason}
            </Text>
          </View>
        )}

        {/* Card Actions */}
        <View style={styles.cardActionsRow}>
          {item.status === "PROCESSING" && (
            <TouchableOpacity
              style={[styles.checkStatusBtn, isChecking && styles.checkStatusBtnDisabled]}
              onPress={() => handleCheckStatus(item)}
              disabled={isChecking}
              activeOpacity={0.8}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
              ) : (
                <RotateCw size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.checkStatusBtnText}>
                {isChecking ? "Checking..." : "Check Status"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.viewDetailsBtn,
              item.status !== "PROCESSING" && { flex: 1 },
            ]}
            onPress={() => setSelectedTicket(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.viewDetailsBtnText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Stagnant Fixed Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Validation History</Text>
        <TouchableOpacity
          onPress={() => fetchHistory(true)}
          style={styles.refreshBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RotateCw size={18} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by 11-digit NIN or Ref..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsContainer}
        >
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === "ALL" && styles.filterPillActive]}
            onPress={() => setActiveFilter("ALL")}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterPillText, activeFilter === "ALL" && styles.filterPillTextActive]}>
              All ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === "PROCESSING" && styles.filterPillActiveProcessing]}
            onPress={() => setActiveFilter("PROCESSING")}
            activeOpacity={0.8}
          >
            <View style={styles.dotProcessing} />
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "PROCESSING" && styles.filterPillTextActiveProcessing,
              ]}
            >
              In Processing ({counts.processing})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === "COMPLETED" && styles.filterPillActiveCompleted]}
            onPress={() => setActiveFilter("COMPLETED")}
            activeOpacity={0.8}
          >
            <View style={styles.dotCompleted} />
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "COMPLETED" && styles.filterPillTextActiveCompleted,
              ]}
            >
              Validated ({counts.completed})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === "FAILED" && styles.filterPillActiveFailed]}
            onPress={() => setActiveFilter("FAILED")}
            activeOpacity={0.8}
          >
            <View style={styles.dotFailed} />
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "FAILED" && styles.filterPillTextActiveFailed,
              ]}
            >
              Failed ({counts.failed})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <BrandLoader inline visible message="Loading validation history..." />
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <AlertCircle size={36} color={colors.error} />
          <Text style={styles.centerErrorTitle}>Failed to Load History</Text>
          <Text style={styles.centerErrorDesc}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchHistory()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id || item.transactionRef}
          renderItem={renderTicketCard}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 32,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchHistory(true)}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconBox}>
                <Clock size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery || activeFilter !== "ALL"
                  ? "No matching validation records"
                  : "No Validation Requests Yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeFilter !== "ALL"
                  ? "Try altering your search keywords or switching filter tabs."
                  : "Submit a validation request to resolve No Record Found errors, VNIN synchronization, or biometric updates."}
              </Text>
              {!searchQuery && activeFilter === "ALL" && (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => router.push("/services/nin-validation" as any)}
                  activeOpacity={0.88}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyActionBtnText}>Submit New Validation</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Detailed Record Modal */}
      {selectedTicket && (
        <Modal
          visible={Boolean(selectedTicket)}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedTicket(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              {/* Sheet Drag Indicator */}
              <View style={styles.modalDragBar} />

              {/* Sheet Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalHeaderCategory}>
                    {CATEGORY_MAP[selectedTicket.category]?.label || selectedTicket.category}
                  </Text>
                  <Text style={styles.modalHeaderSubtitle}>Audit & Processing Information</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedTicket(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                {/* Status Hero Box */}
                <View style={styles.modalStatusBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={styles.modalStatusBoxLabel}>Current Ticket Status</Text>
                    {renderStatusBadge(selectedTicket.status)}
                  </View>
                  <Text style={styles.modalStatusDesc}>
                    {selectedTicket.status === "COMPLETED"
                      ? "This record has been validated and synced across the national identity gateway."
                      : selectedTicket.status === "FAILED"
                      ? "Validation could not be completed on NIMC servers. Review the reason below."
                      : "Record is actively queued for identity verification. Processing time: 24–48 Business Hours."}
                  </Text>
                </View>

                {/* Info List */}
                <View style={styles.modalInfoList}>
                  {/* NIN */}
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoKey}>Submitted NIN</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.modalInfoValMono}>{selectedTicket.nin}</Text>
                      <TouchableOpacity
                        onPress={() => handleCopy(selectedTicket.nin)}
                        style={styles.modalCopyBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        {copiedValue === selectedTicket.nin ? (
                          <Check size={13} color="#059669" />
                        ) : (
                          <Copy size={13} color="#64748B" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.modalDivider} />

                  {/* Transaction Ref */}
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoKey}>Reference ID</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.modalInfoValMono}>{selectedTicket.transactionRef}</Text>
                      <TouchableOpacity
                        onPress={() => handleCopy(selectedTicket.transactionRef)}
                        style={styles.modalCopyBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        {copiedValue === selectedTicket.transactionRef ? (
                          <Check size={13} color="#059669" />
                        ) : (
                          <Copy size={13} color="#64748B" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.modalDivider} />

                  {/* Fee Paid */}
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoKey}>Service Fee Paid</Text>
                    <Text style={styles.modalInfoValBold}>
                      {selectedTicket.amountCharged === 0
                        ? "Free Pass Redeemed"
                        : `₦${selectedTicket.amountCharged.toLocaleString()}`}
                    </Text>
                  </View>
                  <View style={styles.modalDivider} />

                  {/* Submission Date */}
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoKey}>Submitted At</Text>
                    <Text style={styles.modalInfoVal}>
                      {new Date(selectedTicket.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  {/* Completed Date if any */}
                  {selectedTicket.completedAt && (
                    <>
                      <View style={styles.modalDivider} />
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoKey}>Validated At</Text>
                        <Text style={[styles.modalInfoVal, { color: "#059669", fontWeight: "600" }]}>
                          {new Date(selectedTicket.completedAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Failure Reason Box if failed */}
                {selectedTicket.status === "FAILED" && selectedTicket.failureReason && (
                  <View style={styles.modalFailureCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <AlertCircle size={15} color="#DC2626" style={{ marginRight: 6 }} />
                      <Text style={styles.modalFailureTitle}>Rejection Reason</Text>
                    </View>
                    <Text style={styles.modalFailureBody}>{selectedTicket.failureReason}</Text>
                  </View>
                )}

                {/* Admin / Provider Notes if present */}
                {selectedTicket.adminNotes && (
                  <View style={styles.modalNotesCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <ShieldCheck size={15} color="#0284C7" style={{ marginRight: 6 }} />
                      <Text style={styles.modalNotesTitle}>Verification Provider Notes</Text>
                    </View>
                    <Text style={styles.modalNotesBody}>{selectedTicket.adminNotes}</Text>
                  </View>
                )}

                {/* Processing Timeline Notice */}
                <View style={styles.modalNoticeBox}>
                  <Clock size={15} color="#475569" style={{ marginRight: 8, marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalNoticeHeading}>Estimated Processing Window</Text>
                    <Text style={styles.modalNoticeText}>
                      Standard verification takes 24 to 48 Business Hours (1 to 2 Working Days). Once transmitted to NIMC, validation services are non-refundable.
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer Actions */}
              <View style={styles.modalFooter}>
                {selectedTicket.status === "PROCESSING" && (
                  <TouchableOpacity
                    style={[styles.modalSyncBtn, checkingTicketId === selectedTicket.id && styles.checkStatusBtnDisabled]}
                    onPress={() => handleCheckStatus(selectedTicket)}
                    disabled={checkingTicketId === selectedTicket.id}
                    activeOpacity={0.88}
                  >
                    {checkingTicketId === selectedTicket.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    ) : (
                      <RotateCw size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.modalSyncBtnText}>
                      {checkingTicketId === selectedTicket.id ? "Checking Gateway..." : "Check Status Now"}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.modalShareBtn}
                  onPress={() => handleShare(selectedTicket)}
                  activeOpacity={0.8}
                >
                  <Share2 size={16} color="#334155" style={{ marginRight: 8 }} />
                  <Text style={styles.modalShareBtnText}>Share Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Global Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
      />
    </View>
  );
}

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
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  filterTabsWrap: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 10,
  },
  filterTabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillActiveProcessing: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  filterPillActiveCompleted: {
    backgroundColor: "#D1FAE5",
    borderColor: "#10B981",
  },
  filterPillActiveFailed: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  filterPillTextActiveProcessing: {
    color: "#B45309",
  },
  filterPillTextActiveCompleted: {
    color: "#047857",
  },
  filterPillTextActiveFailed: {
    color: "#B91C1C",
  },
  dotProcessing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D97706",
    marginRight: 6,
  },
  dotCompleted: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
    marginRight: 6,
  },
  dotFailed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC2626",
    marginRight: 6,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  catWrap: {
    flex: 1,
    marginRight: 10,
  },
  catLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  statusBadgeCompleted: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusBadgeFailed: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  statusBadgeProcessing: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  statusTextCompact: {
    fontSize: 10.5,
  },
  statusTextCompleted: {
    color: "#059669",
  },
  statusTextFailed: {
    color: "#DC2626",
  },
  statusTextProcessing: {
    color: "#D97706",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardRowLabel: {
    fontSize: 12.5,
    color: "#64748B",
    fontWeight: "500",
  },
  cardRowValueGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  ninMono: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: "monospace",
    letterSpacing: 0.5,
    marginRight: 8,
  },
  refMono: {
    fontSize: 12,
    fontWeight: "500",
    color: "#334155",
    fontFamily: "monospace",
    maxWidth: 160,
    marginRight: 6,
  },
  copyPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
  },
  copyPillText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 3,
  },
  copyPillTextCopied: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#059669",
    marginLeft: 3,
  },
  copyIconBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  cardMetaSubLabel: {
    fontSize: 10.5,
    color: "#94A3B8",
    fontWeight: "500",
    marginBottom: 2,
  },
  amountText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  dateText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#475569",
  },
  cardFailureBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  cardFailureText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  checkStatusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0284C7",
    paddingVertical: 9,
    borderRadius: 8,
  },
  checkStatusBtnDisabled: {
    opacity: 0.65,
  },
  checkStatusBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  viewDetailsBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  centerLoadingText: {
    fontSize: 13.5,
    color: "#64748B",
    marginTop: 12,
  },
  centerErrorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 12,
  },
  centerErrorDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "85%",
  },
  modalDragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalHeaderCategory: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalHeaderSubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    marginBottom: 14,
  },
  modalStatusBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  modalStatusBoxLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalStatusDesc: {
    fontSize: 12.5,
    color: "#475569",
    marginTop: 8,
    lineHeight: 18,
  },
  modalInfoList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 14,
  },
  modalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  modalInfoKey: {
    fontSize: 13,
    color: "#64748B",
  },
  modalInfoVal: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  modalInfoValBold: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalInfoValMono: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: "monospace",
    letterSpacing: 0.4,
  },
  modalCopyBtn: {
    padding: 5,
    marginLeft: 6,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 6,
  },
  modalFailureCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 14,
  },
  modalFailureTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#DC2626",
  },
  modalFailureBody: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 17,
  },
  modalNotesCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    marginBottom: 14,
  },
  modalNotesTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0284C7",
  },
  modalNotesBody: {
    fontSize: 12,
    color: "#0369A1",
    lineHeight: 17,
  },
  modalNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  modalNoticeHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2,
  },
  modalNoticeText: {
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: 16,
  },
  modalFooter: {
    gap: 8,
    paddingTop: 8,
  },
  modalSyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0284C7",
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalSyncBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalShareBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
});
