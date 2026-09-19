import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Search,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCw,
  Copy,
  Check,
  Plus,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export interface IpeTicket {
  id: string;
  trackingId: string;
  reference: string;
  provider: string;
  externalReqId?: string | null;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  resolvedNin?: string | null;
  newTrackingId?: string | null;
  apiMessage?: string | null;
  failureReason?: string | null;
  amountCharged: number | string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  apiResponse?: any;
}

export default function NinIpeHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<IpeTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PROCESSING" | "COMPLETED" | "FAILED">("ALL");

  // Selected Ticket for Details Modal
  const [activeModalTicket, setActiveModalTicket] = useState<IpeTicket | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncingCardId, setSyncingCardId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isNinMasked, setIsNinMasked] = useState<boolean>(false);

  // Custom Alert Modal
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

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.get<{
        success: boolean;
        requests: IpeTicket[];
        stats?: {
          total: number;
          processing: number;
          completed: number;
          failed: number;
        };
      }>("/api/nin/ipe/history");

      if (res && res.success && Array.isArray(res.requests)) {
        setTickets(res.requests);
      } else {
        setTickets([]);
      }
    } catch (err: any) {
      console.error("Failed to load IPE history:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const handleCopy = (key: string, text: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Sync Live Status with Gateway
  const handleSyncStatus = async (ticket: IpeTicket, isCardAction = false) => {
    if (isCardAction) setSyncingCardId(ticket.id);
    else setIsSyncing(true);

    try {
      const res = await api.get<{
        success: boolean;
        message?: string;
        request?: IpeTicket;
        alreadyFinalized?: boolean;
      }>(`/api/nin/ipe/status?reference=${encodeURIComponent(ticket.reference)}`);

      if (res && res.success && res.request) {
        const updated = res.request;

        // Update local ticket in state
        setTickets((prev) =>
          prev.map((t) => (t.reference === updated.reference ? updated : t))
        );

        if (activeModalTicket && activeModalTicket.reference === updated.reference) {
          setActiveModalTicket(updated);
        }

        if (updated.status === "COMPLETED") {
          setAlertConfig({
            visible: true,
            type: "success",
            title: "Clearance Complete",
            message: `Your IPE error has been resolved! Resolved NIN: ${updated.resolvedNin || "Generated"}${updated.newTrackingId ? `\nNew Tracking ID: ${updated.newTrackingId}` : ""}`,
            confirmText: "View Details",
            onConfirm: () => {
              setAlertConfig((prev) => ({ ...prev, visible: false }));
              setActiveModalTicket(updated);
            },
          });
        } else if (updated.status === "FAILED") {
          setAlertConfig({
            visible: true,
            type: "error",
            title: "Clearance Failed",
            message: `${updated.failureReason || updated.apiMessage || "NIMC clearance could not be completed."}\n\nA full refund has been credited to your wallet.`,
            confirmText: "OK",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
        } else {
          if (!isCardAction) {
            setAlertConfig({
              visible: true,
              type: "info",
              title: "Clearance In Processing",
              message: res.message || "Your request is actively undergoing gateway processing (24 – 72 working hours).",
              confirmText: "OK",
              onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
            });
          }
        }
      }
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Sync Error",
        message: err?.message || "Unable to reach gateway. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSyncing(false);
      setSyncingCardId(null);
    }
  };

  // Filter and Search
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (activeFilter !== "ALL" && ticket.status !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTracking = ticket.trackingId.toLowerCase().includes(q);
        const matchesNewTracking = ticket.newTrackingId?.toLowerCase().includes(q) ?? false;
        const matchesRef = ticket.reference.toLowerCase().includes(q);
        const matchesNin = ticket.resolvedNin?.toLowerCase().includes(q) ?? false;
        return matchesTracking || matchesNewTracking || matchesRef || matchesNin;
      }
      return true;
    });
  }, [tickets, activeFilter, searchQuery]);

  // Counts for Tabs
  const counts = useMemo(() => {
    return {
      ALL: tickets.length,
      PROCESSING: tickets.filter((t) => t.status === "PROCESSING").length,
      COMPLETED: tickets.filter((t) => t.status === "COMPLETED").length,
      FAILED: tickets.filter((t) => t.status === "FAILED").length,
    };
  }, [tickets]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const renderTicketCard = ({ item }: { item: IpeTicket }) => {
    const isCompleted = item.status === "COMPLETED";
    const isFailed = item.status === "FAILED";
    const isProcessing = item.status === "PROCESSING";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => setActiveModalTicket(item)}
      >
        {/* Header: Tracking ID & Status Badge */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTrackingLabel}>TRACKING ID</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Text style={styles.cardTrackingId}>{item.trackingId}</Text>
              <TouchableOpacity
                onPress={() => handleCopy(`CARD_${item.id}`, item.trackingId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {copiedKey === `CARD_${item.id}` ? (
                  <Check size={14} color="#059669" />
                ) : (
                  <Copy size={14} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {isCompleted && (
            <View style={styles.badgeCompleted}>
              <CheckCircle2 size={12} color="#059669" style={{ marginRight: 4 }} />
              <Text style={styles.badgeTextCompleted}>COMPLETED</Text>
            </View>
          )}

          {isProcessing && (
            <View style={styles.badgeProcessing}>
              <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={styles.badgeTextProcessing}>PROCESSING</Text>
            </View>
          )}

          {isFailed && (
            <View style={styles.badgeFailed}>
              <AlertCircle size={12} color={colors.error} style={{ marginRight: 4 }} />
              <Text style={styles.badgeTextFailed}>FAILED</Text>
            </View>
          )}
        </View>

        {/* Card Body Details */}
        <View style={styles.cardBody}>
          {/* If Completed: Show Resolved NIN & New Tracking ID Chips */}
          {isCompleted && (
            <View style={styles.completedChipsWrap}>
              {item.resolvedNin && (
                <View style={styles.resultChipNin}>
                  <Text style={styles.resultChipLabel}>NIN:</Text>
                  <Text style={styles.resultChipValue}>{item.resolvedNin}</Text>
                </View>
              )}
              {item.newTrackingId && (
                <View style={styles.resultChipTracking}>
                  <Text style={styles.resultChipLabel}>NEW ID:</Text>
                  <Text style={styles.resultChipValue}>{item.newTrackingId}</Text>
                </View>
              )}
            </View>
          )}

          {/* If Processing: Timeline + Direct Sync Button */}
          {isProcessing && (
            <View style={styles.processingRow}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Clock size={13} color="#D97706" style={{ marginRight: 5 }} />
                <Text style={styles.processingNoticeText}>In gateway queue (24 – 72h)</Text>
              </View>

              <TouchableOpacity
                style={styles.cardSyncBtn}
                onPress={() => handleSyncStatus(item, true)}
                disabled={syncingCardId === item.id}
                activeOpacity={0.8}
              >
                {syncingCardId === item.id ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <>
                    <RotateCw size={12} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.cardSyncBtnText}>Sync</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* If Failed: Error Message Snippet + Refund Pill */}
          {isFailed && (
            <View style={styles.failedRow}>
              <Text style={styles.failedSnippet} numberOfLines={1}>
                {item.failureReason || item.apiMessage || "Clearance rejected by NIMC."}
              </Text>
              <View style={styles.refundPill}>
                <Sparkles size={10} color="#059669" style={{ marginRight: 3 }} />
                <Text style={styles.refundPillText}>Refunded</Text>
              </View>
            </View>
          )}
        </View>

        {/* Card Footer: Reference, Date, Fee */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardRefText} numberOfLines={1}>
            Ref: {item.reference}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={styles.cardDateText}>{formatDate(item.createdAt)}</Text>
            <Text style={styles.cardPriceText}>₦{Number(item.amountCharged).toLocaleString()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>IPE Clearance History</Text>
          <Text style={styles.headerSubtitle}>Status tracking & cleared records</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/services/nin-ipe" as any)}
          style={styles.newRequestBtn}
          activeOpacity={0.8}
        >
          <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newRequestBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBox}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by Tracking ID, NIN, Ref..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {(
            [
              { key: "ALL", label: "All" },
              { key: "PROCESSING", label: "In Processing" },
              { key: "COMPLETED", label: "Completed" },
              { key: "FAILED", label: "Failed" },
            ] as const
          ).map((tab) => {
            const isSelected = activeFilter === tab.key;
            const count = counts[tab.key];

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
                onPress={() => setActiveFilter(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabCountPill, isSelected && styles.tabCountPillActive]}>
                  <Text style={[styles.tabCountText, isSelected && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List / Empty / Loading */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading clearance records...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicketCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchHistory(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBox}>
                <Key size={38} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Clearance Records</Text>
              <Text style={styles.emptySub}>
                {searchQuery || activeFilter !== "ALL"
                  ? "No IPE clearance requests match your current search or filter."
                  : "You have not submitted any enrollment tracking IDs for IPE error clearance yet."}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/services/nin-ipe" as any)}
                activeOpacity={0.88}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyBtnText}>Submit IPE Clearance</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Ticket Details Modal */}
      {activeModalTicket && (
        <Modal
          visible={!!activeModalTicket}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveModalTicket(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxHeight: "88%", paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={styles.modalHeaderIconWrap}>
                    <Key size={20} color={colors.primary} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.modalTitle}>Clearance Details</Text>
                    <Text style={styles.modalRefText} numberOfLines={1}>
                      Ref: {activeModalTicket.reference}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setActiveModalTicket(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Status Banner */}
                <View
                  style={[
                    styles.modalStatusBanner,
                    activeModalTicket.status === "COMPLETED"
                      ? styles.bannerCompleted
                      : activeModalTicket.status === "FAILED"
                      ? styles.bannerFailed
                      : styles.bannerProcessing,
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    {activeModalTicket.status === "COMPLETED" ? (
                      <CheckCircle2 size={16} color="#059669" style={{ marginRight: 8 }} />
                    ) : activeModalTicket.status === "FAILED" ? (
                      <AlertCircle size={16} color={colors.error} style={{ marginRight: 8 }} />
                    ) : (
                      <Clock size={16} color="#D97706" style={{ marginRight: 8 }} />
                    )}
                    <Text
                      style={[
                        styles.modalStatusBannerText,
                        activeModalTicket.status === "COMPLETED"
                          ? { color: "#059669" }
                          : activeModalTicket.status === "FAILED"
                          ? { color: colors.error }
                          : { color: "#D97706" },
                      ]}
                    >
                      {activeModalTicket.status === "PROCESSING"
                        ? "Clearance In Processing (24 – 72h)"
                        : activeModalTicket.status === "COMPLETED"
                        ? "In-Processing Error Cleared"
                        : "Clearance Unsuccessful"}
                    </Text>
                  </View>

                  {/* Sync Live Status Button (if Processing) */}
                  {activeModalTicket.status === "PROCESSING" && (
                    <TouchableOpacity
                      style={styles.syncBtn}
                      onPress={() => handleSyncStatus(activeModalTicket)}
                      disabled={isSyncing}
                      activeOpacity={0.8}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color="#059669" />
                      ) : (
                        <>
                          <RotateCw size={13} color="#059669" style={{ marginRight: 4 }} />
                          <Text style={styles.syncBtnText}>Sync Status</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* When Completed: 1. Resolved NIN Box */}
                {activeModalTicket.resolvedNin && (
                  <View style={styles.resolvedNinBox}>
                    <View style={styles.resolvedNinTopRow}>
                      <Text style={styles.resolvedNinBoxLabel}>RESOLVED 11-DIGIT NIN</Text>
                      <TouchableOpacity
                        style={styles.maskToggleBtn}
                        onPress={() => setIsNinMasked(!isNinMasked)}
                        activeOpacity={0.7}
                      >
                        {isNinMasked ? (
                          <>
                            <Eye size={13} color="#94A3B8" style={{ marginRight: 4 }} />
                            <Text style={styles.maskToggleText}>Show</Text>
                          </>
                        ) : (
                          <>
                            <EyeOff size={13} color="#94A3B8" style={{ marginRight: 4 }} />
                            <Text style={styles.maskToggleText}>Mask</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={styles.resolvedNinRow}>
                      <Text style={styles.resolvedNinLarge}>
                        {isNinMasked
                          ? `${activeModalTicket.resolvedNin.slice(0, 3)}•••••${activeModalTicket.resolvedNin.slice(-3)}`
                          : activeModalTicket.resolvedNin}
                      </Text>
                      <TouchableOpacity
                        style={styles.copyNinBtn}
                        onPress={() => handleCopy("MODAL_NIN", activeModalTicket.resolvedNin!)}
                        activeOpacity={0.8}
                      >
                        {copiedKey === "MODAL_NIN" ? (
                          <>
                            <Check size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.copyNinBtnText}>Copied</Text>
                          </>
                        ) : (
                          <>
                            <Copy size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.copyNinBtnText}>Copy NIN</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* When Completed: 2. New Tracking ID Box */}
                {activeModalTicket.newTrackingId && (
                  <View style={styles.newTrackingBox}>
                    <Text style={styles.newTrackingBoxLabel}>NEW NIMC TRACKING ID</Text>
                    <View style={styles.newTrackingRow}>
                      <Text style={styles.newTrackingLarge}>{activeModalTicket.newTrackingId}</Text>
                      <TouchableOpacity
                        style={styles.copyTrackingBtn}
                        onPress={() => handleCopy("MODAL_TRACKING", activeModalTicket.newTrackingId!)}
                        activeOpacity={0.8}
                      >
                        {copiedKey === "MODAL_TRACKING" ? (
                          <>
                            <Check size={13} color="#059669" style={{ marginRight: 4 }} />
                            <Text style={styles.copyTrackingBtnText}>Copied</Text>
                          </>
                        ) : (
                          <>
                            <Copy size={13} color="#059669" style={{ marginRight: 4 }} />
                            <Text style={styles.copyTrackingBtnText}>Copy ID</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Provider Message / Confirmation Pill */}
                {activeModalTicket.status === "COMPLETED" && (
                  <View style={styles.providerSuccessBox}>
                    <CheckCircle2 size={16} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
                    <Text style={styles.providerSuccessText}>
                      {activeModalTicket.apiMessage || "IPE Clearance completed successfully. Your NIN has been released."}
                    </Text>
                  </View>
                )}

                {/* When Failed: Failure Reason & Refund Notice */}
                {activeModalTicket.status === "FAILED" && (
                  <View style={styles.failureDetailBox}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={16} color={colors.error} />
                      <Text style={styles.failureDetailTitle}>Clearance Rejected</Text>
                    </View>
                    <Text style={styles.failureDetailReason}>
                      {activeModalTicket.failureReason ||
                        activeModalTicket.apiMessage ||
                        "Your IPE clearance request has failed. Please contact support for more details."}
                    </Text>

                    {/* Green Refund Reassurance Banner */}
                    <View style={styles.refundNoticeBanner}>
                      <Sparkles size={16} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.refundNoticeTitle}>100% Wallet Refund Credited</Text>
                        <Text style={styles.refundNoticeText}>
                          The full processing fee of ₦{Number(activeModalTicket.amountCharged).toLocaleString()} has been automatically refunded to your wallet.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Processing Advisory Banner */}
                {activeModalTicket.status === "PROCESSING" && (
                  <View style={styles.processingAdvisoryBox}>
                    <Clock size={18} color="#D97706" style={{ marginRight: 10, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.processingAdvisoryTitle}>Clearance Under Review</Text>
                      <Text style={styles.processingAdvisoryText}>
                        This request is actively being synchronized at the NIMC backend. Clearance typically completes within 24 to 72 working hours. Use the "Sync Status" button above to check live gateway progress.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Audit Order Specifications */}
                <View style={styles.techSection}>
                  <Text style={styles.sectionHeader}>TRANSACTION SPECIFICATIONS</Text>
                  <View style={styles.techBox}>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Submitted Tracking ID:</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={[styles.techValue, styles.fontMono]}>
                          {activeModalTicket.trackingId}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleCopy("AUDIT_TRACKING", activeModalTicket.trackingId)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {copiedKey === "AUDIT_TRACKING" ? (
                            <Check size={12} color="#059669" />
                          ) : (
                            <Copy size={12} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.techDivider} />

                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Reference:</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={[styles.techValue, styles.fontMono]}>
                          {activeModalTicket.reference}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleCopy("AUDIT_REF", activeModalTicket.reference)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {copiedKey === "AUDIT_REF" ? (
                            <Check size={12} color="#059669" />
                          ) : (
                            <Copy size={12} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.techDivider} />

                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Amount Charged:</Text>
                      <Text style={[styles.techValue, { fontWeight: "800", color: "#0F172A" }]}>
                        ₦{Number(activeModalTicket.amountCharged).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.techDivider} />

                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Submitted Date:</Text>
                      <Text style={styles.techValue}>
                        {formatDate(activeModalTicket.createdAt)}
                      </Text>
                    </View>

                    {activeModalTicket.completedAt && (
                      <>
                        <View style={styles.techDivider} />
                        <View style={styles.techRow}>
                          <Text style={styles.techLabel}>Completed Date:</Text>
                          <Text style={[styles.techValue, { color: "#059669", fontWeight: "700" }]}>
                            {formatDate(activeModalTicket.completedAt)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setActiveModalTicket(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Global Custom Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  newRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  newRequestBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  tabContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },
  tabBtnActive: {
    backgroundColor: "#0F172A",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },
  tabCountPill: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 6,
  },
  tabCountPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  tabCountTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 12,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 20,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: 18,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  // Card Styles
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTrackingLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  cardTrackingId: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
    letterSpacing: 0.8,
  },
  badgeCompleted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  badgeTextCompleted: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
  },
  badgeProcessing: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  badgeTextProcessing: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
  },
  badgeFailed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  badgeTextFailed: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.error,
  },
  cardBody: {
    marginVertical: 10,
  },
  completedChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resultChipNin: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultChipTracking: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultChipLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    marginRight: 4,
  },
  resultChipValue: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  processingNoticeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#B45309",
  },
  cardSyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardSyncBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  failedSnippet: {
    fontSize: 11,
    color: "#DC2626",
    flex: 1,
    marginRight: 8,
  },
  refundPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  refundPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
  },
  cardRefText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#94A3B8",
    flex: 1,
    marginRight: 8,
  },
  cardDateText: {
    fontSize: 11,
    color: "#64748B",
  },
  cardPriceText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalRefText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#64748B",
    marginTop: 1,
  },
  modalStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    marginVertical: 14,
  },
  bannerCompleted: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  bannerProcessing: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  bannerFailed: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  modalStatusBannerText: {
    fontSize: 12,
    fontWeight: "800",
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },
  // Resolved NIN Highlight Box
  resolvedNinBox: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  resolvedNinTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resolvedNinBoxLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.8,
  },
  maskToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  maskToggleText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  resolvedNinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resolvedNinLarge: {
    fontSize: 22,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  copyNinBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  copyNinBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  // New Tracking Box
  newTrackingBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginBottom: 12,
  },
  newTrackingBoxLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  newTrackingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  newTrackingLarge: {
    fontSize: 16,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
    letterSpacing: 1.5,
  },
  copyTrackingBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyTrackingBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },
  providerSuccessBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  providerSuccessText: {
    fontSize: 12,
    color: "#166534",
    flex: 1,
    lineHeight: 18,
    fontWeight: "600",
  },
  failureDetailBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 14,
  },
  failureDetailTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.error,
  },
  failureDetailReason: {
    fontSize: 12,
    color: "#991B1B",
    marginTop: 6,
    lineHeight: 18,
  },
  refundNoticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  refundNoticeTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
  },
  refundNoticeText: {
    fontSize: 10,
    color: "#166534",
    marginTop: 1,
    lineHeight: 14,
  },
  processingAdvisoryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 14,
  },
  processingAdvisoryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B45309",
  },
  processingAdvisoryText: {
    fontSize: 11,
    color: "#78350F",
    marginTop: 2,
    lineHeight: 16,
  },
  techSection: {
    marginTop: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  techBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  techDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  techLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  techValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0F172A",
  },
  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  modalCloseBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
});
