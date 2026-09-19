import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Platform,
  Image,
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
  Download,
  Fingerprint,
  FileText,
  User,
  Calendar,
  Phone,
  MapPin,
} from "lucide-react-native";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";

export interface PersonalizationTicket {
  id: string;
  trackingId: string;
  reference: string;
  provider: string;
  externalTxId?: string | null;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  resolvedNin?: string | null;
  fullName?: string | null;
  dob?: string | null;
  gender?: string | null;
  phone?: string | null;
  residenceState?: string | null;
  photoUrl?: string | null;
  pdfUrl?: string | null;
  userData?: Record<string, any> | null;
  apiMessage?: string | null;
  failureReason?: string | null;
  amountCharged: number;
  createdAt: string;
  completedAt?: string | null;
}

type FilterTab = "ALL" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function NinPersonalizationHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<PersonalizationTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");

  // Selected Ticket for Details Modal
  const [selectedTicket, setSelectedTicket] = useState<PersonalizationTicket[] | null>(null);
  const [activeModalTicket, setActiveModalTicket] = useState<PersonalizationTicket | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
        requests: PersonalizationTicket[];
        stats?: {
          total: number;
          processing: number;
          completed: number;
          failed: number;
        };
      }>("/api/nin/personalization/history");

      if (res && res.success && Array.isArray(res.requests)) {
        setTickets(res.requests);
      } else {
        setTickets([]);
      }
    } catch (err: any) {
      console.error("Failed to load personalization history:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCopy = (key: string, text: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadSlip = async (ticket: PersonalizationTicket) => {
    if (!ticket.pdfUrl) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Slip Not Available",
        message: "No printable slip was generated for this record yet.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setDownloadingId(ticket.id);
    try {
      const filename = `NIN_Personalization_${ticket.resolvedNin || ticket.trackingId}.pdf`;
      await downloadAndSharePdf({
        source: ticket.pdfUrl,
        filename,
        dialogTitle: "Download NIN Slip",
      });
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Failed",
        message: err?.message || "Could not save or share the slip. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Sync Live Gateway Status
  const handleSyncStatus = async (ticket: PersonalizationTicket) => {
    setIsSyncing(true);
    try {
      const res = await api.get<{
        success: boolean;
        request?: PersonalizationTicket;
        message?: string;
      }>(`/api/nin/personalization/status?reference=${encodeURIComponent(ticket.reference)}`);

      if (res && res.success && res.request) {
        const updated = res.request;
        setActiveModalTicket(updated);
        setTickets((prev) =>
          prev.map((t) => (t.id === updated.id || t.reference === updated.reference ? updated : t))
        );

        if (updated.status === "COMPLETED") {
          setAlertConfig({
            visible: true,
            type: "success",
            title: "Personalization Complete!",
            message: `NIN has been successfully generated: ${updated.resolvedNin || "Ready"}. Verified slip is available.`,
            confirmText: "View Details",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
        } else if (updated.status === "FAILED") {
          setAlertConfig({
            visible: true,
            type: "error",
            title: "Request Failed",
            message: updated.failureReason || "NIMC identity gateway could not personalize this record.",
            confirmText: "OK",
            onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
          });
        }
      }
    } catch (err: any) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Sync Error",
        message: err?.message || "Unable to reach identity gateway. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter and search
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Status filter
      if (activeFilter !== "ALL" && ticket.status !== activeFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTracking = ticket.trackingId.toLowerCase().includes(q);
        const matchesRef = ticket.reference.toLowerCase().includes(q);
        const matchesNin = ticket.resolvedNin?.toLowerCase().includes(q) ?? false;
        const matchesName = ticket.fullName?.toLowerCase().includes(q) ?? false;
        return matchesTracking || matchesRef || matchesNin || matchesName;
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

  // Helper to extract non-empty user demographic details
  const getCleanDemographics = (ticket: PersonalizationTicket) => {
    const u = ticket.userData || {};

    const cleanStr = (val?: any): string | null => {
      if (typeof val === "string" && val.trim().length > 0) return val.trim();
      return null;
    };

    // Full name
    let name = cleanStr(ticket.fullName);
    if (!name) {
      const parts = [
        cleanStr(u.firstName),
        cleanStr(u.middleName || u.middlename),
        cleanStr(u.surname || u.lastName),
      ].filter(Boolean);
      if (parts.length > 0) name = parts.join(" ");
    }

    // Gender
    const gender = cleanStr(ticket.gender) || cleanStr(u.gender);

    // DOB
    const dob = cleanStr(ticket.dob) || cleanStr(u.birthdate) || cleanStr(u.dateOfBirth);

    // Phone (Hides if empty)
    const phone = cleanStr(ticket.phone) || cleanStr(u.telephoneno) || cleanStr(u.phone);

    // State (Hides if empty)
    const state = cleanStr(ticket.residenceState) || cleanStr(u.residence_state) || cleanStr(u.self_origin_state);

    // LGA (Hides if empty)
    const lga = cleanStr(u.residence_lga) || cleanStr(u.self_origin_lga);

    // Address (Hides if empty)
    const address = cleanStr(u.residence_address) || cleanStr(u.residence_addr) || cleanStr(u.residence_AdressLine1);

    // Height (Hides if empty)
    const height = cleanStr(u.heigth) ? `${cleanStr(u.heigth)} cm` : null;

    return {
      name,
      gender,
      dob,
      phone,
      state,
      lga,
      address,
      height,
    };
  };

  const renderTicketCard = ({ item }: { item: PersonalizationTicket }) => {
    const isCompleted = item.status === "COMPLETED";
    const isFailed = item.status === "FAILED";
    const isProcessing = item.status === "PROCESSING";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => setActiveModalTicket(item)}
      >
        {/* Card Header: Tracking ID & Status Badge */}
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

        {/* Resolved NIN Highlight (if Completed) */}
        {isCompleted && item.resolvedNin ? (
          <View style={styles.resolvedNinPill}>
            <Text style={styles.resolvedNinPillLabel}>RESOLVED NIN:</Text>
            <Text style={styles.resolvedNinPillValue}>{item.resolvedNin}</Text>
          </View>
        ) : null}

        {/* Failure Reason Snippet (if Failed) */}
        {isFailed && item.failureReason ? (
          <View style={styles.failureSnippetBox}>
            <Text style={styles.failureSnippetText} numberOfLines={2}>
              {item.failureReason}
            </Text>
          </View>
        ) : null}

        {/* Turnaround Snippet (if Processing) */}
        {isProcessing && (
          <View style={styles.processingSnippetBox}>
            <Clock size={12} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={styles.processingSnippetText}>
              Turnaround: 30 mins – 3 working hours
            </Text>
          </View>
        )}

        <View style={styles.cardDivider} />

        {/* Card Footer: Reference, Amount, Action */}
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.cardRefText}>{item.reference}</Text>
            <Text style={styles.cardDateText}>
              {new Date(item.createdAt).toLocaleDateString("en-NG", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isCompleted && item.pdfUrl ? (
              <TouchableOpacity
                style={styles.quickSlipBtn}
                onPress={() => handleDownloadSlip(item)}
                activeOpacity={0.8}
                disabled={downloadingId === item.id}
              >
                {downloadingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Download size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.quickSlipBtnText}>Slip</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => setActiveModalTicket(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Personalization Records</Text>
        <TouchableOpacity
          onPress={() => router.push("/services/nin-personalization" as any)}
          style={styles.newRequestBtn}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newRequestBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
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
          <Text style={styles.loadingText}>Loading personalization records...</Text>
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
                <Fingerprint size={40} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery || activeFilter !== "ALL"
                  ? "No personalization requests match your search or filter."
                  : "You have not submitted any enrollment tracking IDs for personalization yet."}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/services/nin-personalization" as any)}
                activeOpacity={0.88}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyBtnText}>Submit Personalization</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Details Modal */}
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
                    <Fingerprint size={20} color={colors.primary} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.modalTitle}>Personalization Details</Text>
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
                {/* Status Bar with Live Sync Button */}
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
                        ? "Processing (Typically 30m – 3h)"
                        : activeModalTicket.status}
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

                {/* Resolved NIN Highlight (When Completed) */}
                {activeModalTicket.resolvedNin && (
                  <View style={styles.resolvedNinBox}>
                    <Text style={styles.resolvedNinBoxLabel}>GENERATED &amp; RESOLVED NIN</Text>
                    <View style={styles.resolvedNinRow}>
                      <Text style={styles.resolvedNinLarge}>{activeModalTicket.resolvedNin}</Text>
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

                {/* PDF Slip Download Card (When Completed & Slip Available) */}
                {activeModalTicket.pdfUrl && (
                  <View style={styles.slipCard}>
                    <View style={styles.slipCardLeft}>
                      <View style={styles.slipIconWrap}>
                        <FileText size={20} color="#FFFFFF" />
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.slipCardTitle}>Verified NIN Slip Ready</Text>
                        <Text style={styles.slipCardSub}>Official NIMC identity slip</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.slipDownloadBtn}
                      onPress={() => handleDownloadSlip(activeModalTicket)}
                      disabled={downloadingId === activeModalTicket.id}
                      activeOpacity={0.88}
                    >
                      {downloadingId === activeModalTicket.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Download size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.slipDownloadBtnText}>Download</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Failure Banner (When Failed) */}
                {activeModalTicket.status === "FAILED" && (
                  <View style={styles.failureDetailBox}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={16} color={colors.error} />
                      <Text style={styles.failureDetailTitle}>Personalization Unsuccessful</Text>
                    </View>
                    <Text style={styles.failureDetailReason}>
                      {activeModalTicket.failureReason || "The NIMC gateway rejected this tracking ID."}
                    </Text>
                    <Text style={styles.failureDetailNotice}>
                      Fulfillment fees for rejected requests are non-refundable. Please contact support if you need further clarification.
                    </Text>
                  </View>
                )}

                {/* Applicant Demographics (Strictly hide empty fields) */}
                {(() => {
                  const demo = getCleanDemographics(activeModalTicket);
                  const hasAnyDemo = Boolean(demo.name || demo.gender || demo.dob || demo.phone || demo.state || demo.address || demo.height);

                  if (!hasAnyDemo) return null;

                  return (
                    <View style={styles.demoSection}>
                      <Text style={styles.sectionHeader}>APPLICANT DEMOGRAPHICS</Text>
                      <View style={styles.demoGrid}>
                        {demo.name ? (
                          <View style={styles.demoItem}>
                            <Text style={styles.demoLabel}>Full Name</Text>
                            <Text style={styles.demoValue}>{demo.name}</Text>
                          </View>
                        ) : null}

                        {demo.gender ? (
                          <View style={styles.demoItem}>
                            <Text style={styles.demoLabel}>Gender</Text>
                            <Text style={styles.demoValue}>{demo.gender}</Text>
                          </View>
                        ) : null}

                        {demo.dob ? (
                          <View style={styles.demoItem}>
                            <Text style={styles.demoLabel}>Date of Birth</Text>
                            <Text style={styles.demoValue}>{demo.dob}</Text>
                          </View>
                        ) : null}

                        {demo.phone ? (
                          <View style={styles.demoItem}>
                            <Text style={styles.demoLabel}>Phone Number</Text>
                            <Text style={styles.demoValue}>{demo.phone}</Text>
                          </View>
                        ) : null}

                        {demo.state ? (
                          <View style={styles.demoItem}>
                            <Text style={styles.demoLabel}>State</Text>
                            <Text style={styles.demoValue}>{demo.state}</Text>
                          </View>
                        ) : null}

                        {demo.lga ? (
                          <View style={styles.demoItem}>
                            <Text style={styles.demoLabel}>LGA</Text>
                            <Text style={styles.demoValue}>{demo.lga}</Text>
                          </View>
                        ) : null}

                        {demo.address ? (
                          <View style={[styles.demoItem, { width: "100%" }]}>
                            <Text style={styles.demoLabel}>Residential Address</Text>
                            <Text style={styles.demoValue}>{demo.address}</Text>
                          </View>
                        ) : null}

                        {demo.height ? (
                          <View style={styles.demoItem}>
                            <Text style={styles.demoLabel}>Height</Text>
                            <Text style={styles.demoValue}>{demo.height}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })()}

                {/* Technical Order Details */}
                <View style={styles.techSection}>
                  <Text style={styles.sectionHeader}>ORDER SPECIFICATIONS</Text>
                  <View style={styles.techBox}>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Tracking ID:</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={[styles.techValue, styles.fontMono]}>
                          {activeModalTicket.trackingId}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleCopy("MODAL_TRACKING", activeModalTicket.trackingId)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {copiedKey === "MODAL_TRACKING" ? (
                            <Check size={13} color="#059669" />
                          ) : (
                            <Copy size={13} color={colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.techDivider} />

                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Amount Charged:</Text>
                      <Text style={[styles.techValue, { fontWeight: "800", color: colors.text }]}>
                        ₦{Number(activeModalTicket.amountCharged).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.techDivider} />

                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Date Submitted:</Text>
                      <Text style={styles.techValue}>
                        {new Date(activeModalTicket.createdAt).toLocaleDateString("en-NG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>

                    {activeModalTicket.completedAt && (
                      <>
                        <View style={styles.techDivider} />
                        <View style={styles.techRow}>
                          <Text style={styles.techLabel}>Completed At:</Text>
                          <Text style={[styles.techValue, { color: "#059669" }]}>
                            {new Date(activeModalTicket.completedAt).toLocaleDateString("en-NG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setActiveModalTicket(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseBtnText}>Close Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Custom Alert Modal */}
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
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  newRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  newRequestBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  tabContainer: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginRight: 6,
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },
  tabCountPill: {
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabCountText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.textSecondary,
  },
  tabCountTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTrackingLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  cardTrackingId: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.text,
  },
  badgeCompleted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTextCompleted: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#059669",
  },
  badgeProcessing: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(217, 119, 6, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTextProcessing: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#D97706",
  },
  badgeFailed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTextFailed: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.error,
  },
  resolvedNinPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
    marginTop: 10,
  },
  resolvedNinPillLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    marginRight: 6,
  },
  resolvedNinPillValue: {
    fontSize: 13.5,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#059669",
  },
  failureSnippetBox: {
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  failureSnippetText: {
    fontSize: 11,
    color: colors.error,
    lineHeight: 15,
  },
  processingSnippetBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(217, 119, 6, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
  },
  processingSnippetText: {
    fontSize: 11,
    color: "#D97706",
    fontWeight: "600",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    marginVertical: 10,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardRefText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.textMuted,
  },
  cardDateText: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  quickSlipBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickSlipBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  viewBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  centerBox: {
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
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    marginTop: 20,
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
    marginBottom: 12,
  },
  modalHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(200, 45, 117, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  modalRefText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.textMuted,
    marginTop: 1,
  },
  modalStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  bannerCompleted: {
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  bannerProcessing: {
    backgroundColor: "rgba(217, 119, 6, 0.08)",
    borderColor: "rgba(217, 119, 6, 0.2)",
  },
  bannerFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  modalStatusBannerText: {
    fontSize: 12.5,
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
    borderColor: "rgba(5, 150, 105, 0.25)",
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  resolvedNinBox: {
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  resolvedNinBoxLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
  },
  resolvedNinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  resolvedNinLarge: {
    fontSize: 20,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#059669",
    letterSpacing: 1,
  },
  copyNinBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyNinBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  slipCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  slipCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  slipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  slipCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  slipCardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  slipDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  slipDownloadBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  failureDetailBox: {
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  failureDetailTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.error,
  },
  failureDetailReason: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 17,
    marginTop: 4,
  },
  failureDetailNotice: {
    fontSize: 10.5,
    color: colors.textMuted,
    lineHeight: 14,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 68, 68, 0.15)",
  },
  demoSection: {
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  demoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  demoItem: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  demoLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "600",
  },
  demoValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  techSection: {
    marginBottom: 16,
  },
  techBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  techLabel: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  techValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  techDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    marginVertical: 8,
  },
  modalCloseBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  modalCloseBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.text,
  },
  fontMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
