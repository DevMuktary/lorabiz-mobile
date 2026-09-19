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
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Search,
  FileText,
  Download,
  Eye,
  Clock,
  User,
  Calendar,
  Phone,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { downloadAndSharePdf } from "../../lib/pdf";
import { parseDemographics } from "../../lib/demographics";

interface SlipHistoryItem {
  id: string;
  category: "NIN" | "BVN";
  identifier: string;
  maskedId: string;
  rawSlipType: string;
  slipType: string;
  searchType?: string; // "NIN" | "PHONE"
  amountCharged: number;
  reference: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  address?: string;
  residentialAddress?: string;
  stateOfOrigin?: string;
  lgaOfOrigin?: string;
  stateOfResidence?: string;
  lgaOfResidence?: string;
  nationality?: string;
  maritalStatus?: string;
  height?: string;
  weight?: string;
  title?: string;
  religion?: string;
  registrationDate?: string;
  enrollmentBank?: string;
  levelOfAccount?: string;
  nameOnCard?: string;
  watchListed?: string;
  email?: string;
  photo?: string;
  pdfUrl?: string;
  hasPdf: boolean;
  createdAt: string;
  userData?: any;
}

const ITEMS_PER_PAGE = 10;

export default function SlipHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: "NIN" | "BVN"; id?: string }>();

  // Determine active category strictly: NIN or BVN (never mixed on the same screen)
  const isBvn = params.type?.toUpperCase() === "BVN";
  const category: "NIN" | "BVN" = isBvn ? "BVN" : "NIN";
  const brandColor = category === "BVN" ? "#0284C7" : colors.primary;

  // Sub-filter: For NIN: "ALL" | "NIN" | "PHONE". For BVN: "ALL" | "STANDARD" | "PREMIUM"
  const [filter, setFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<SlipHistoryItem | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: AlertType;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    visible: false,
    type: "info",
    title: "",
    message: "",
    confirmText: "OK",
    onConfirm: () => {},
  });

  const {
    data: historyData,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["mobileSlipsHistory", category],
    queryFn: async () => {
      try {
        return await api.get(`/api/slips/history?category=${category}`);
      } catch {
        return null;
      }
    },
  });

  const rawSlips: any[] = historyData?.history || [];

  // Normalize each item's demographics
  const slips: SlipHistoryItem[] = useMemo(() => {
    return rawSlips.map((item) => {
      const demo = parseDemographics(item.userData || item, item.fullName);
      return {
        ...item,
        fullName: demo.fullName || item.fullName || (item.category === "NIN" ? "Verified Citizen" : "Verified Customer"),
        firstName: demo.firstName || item.firstName,
        lastName: demo.lastName || item.lastName,
        gender: demo.gender || item.gender,
        dob: demo.dob || item.dob,
        phone: demo.phone || item.phone,
        address: demo.address || item.address,
        residentialAddress: demo.residentialAddress || demo.address || item.residentialAddress || item.address,
        stateOfOrigin: demo.stateOfOrigin || item.stateOfOrigin,
        lgaOfOrigin: demo.lgaOfOrigin || item.lgaOfOrigin,
        stateOfResidence: demo.stateOfResidence || item.stateOfResidence,
        lgaOfResidence: demo.lgaOfResidence || item.lgaOfResidence,
        nationality: demo.nationality || item.nationality,
        maritalStatus: demo.maritalStatus || item.maritalStatus,
        height: demo.height || item.height,
        weight: demo.weight || item.weight,
        title: demo.title || item.title,
        religion: demo.religion || item.religion,
        registrationDate: demo.registrationDate || item.registrationDate,
        enrollmentBank: demo.enrollmentBank || item.enrollmentBank,
        levelOfAccount: demo.levelOfAccount || item.levelOfAccount,
        nameOnCard: demo.nameOnCard || item.nameOnCard,
        watchListed: demo.watchListed || item.watchListed,
        email: demo.email || item.email,
        photo: demo.photo || item.photo,
        userData: item.userData,
      };
    });
  }, [rawSlips]);

  // Auto-open specific slip details modal when navigated to with an id
  useEffect(() => {
    if (params.id && slips.length > 0) {
      const match = slips.find(
        (s) => s.id === params.id || s.reference === params.id || s.identifier === params.id
      );
      if (match) {
        setSelectedDetails(match);
      }
    }
  }, [params.id, slips]);

  const filterOptions = useMemo(() => {
    if (category === "NIN") {
      return [
        { id: "ALL", label: "All Slips" },
        { id: "NIN", label: "Query by NIN" },
        { id: "PHONE", label: "Query by Phone" },
      ];
    } else {
      return [
        { id: "ALL", label: "All Slips" },
        { id: "STANDARD", label: "Standard" },
        { id: "PREMIUM", label: "Premium" },
      ];
    }
  }, [category]);

  const filteredSlips = useMemo(() => {
    return slips.filter((item) => {
      // Sub-filter check
      let matchesSub = true;
      if (category === "NIN") {
        if (filter === "NIN") {
          matchesSub = item.searchType !== "PHONE";
        } else if (filter === "PHONE") {
          matchesSub = item.searchType === "PHONE";
        }
      } else if (category === "BVN") {
        if (filter === "STANDARD") {
          matchesSub =
            item.rawSlipType?.toLowerCase().includes("standard") ||
            item.slipType?.toLowerCase().includes("standard");
        } else if (filter === "PREMIUM") {
          matchesSub =
            item.rawSlipType?.toLowerCase().includes("premium") ||
            item.slipType?.toLowerCase().includes("premium");
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.fullName?.toLowerCase().includes(q) ||
        item.identifier?.toLowerCase().includes(q) ||
        item.reference?.toLowerCase().includes(q) ||
        item.slipType?.toLowerCase().includes(q);

      return matchesSub && matchesSearch;
    });
  }, [slips, category, filter, searchQuery]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredSlips.length / ITEMS_PER_PAGE));
  const paginatedSlips = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSlips.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSlips, currentPage]);

  const handleDownloadPdf = async (item: SlipHistoryItem) => {
    if (!item.pdfUrl) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Document Unavailable",
        message:
          "The PDF document for this verification record has expired or was not archived. Please generate a fresh slip.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setDownloadingId(item.id);
    const cleanName = (item.fullName || item.category || "Slip").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${item.category}_Slip_${cleanName}_${Date.now()}.pdf`;

    const res = await downloadAndSharePdf({
      source: item.pdfUrl,
      filename,
      dialogTitle: `Download ${item.category} Slip`,
    });

    setDownloadingId(null);

    if (!res.success) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Download Failed",
        message: res.error || "Unable to process document download. Please try again.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const renderSlipItem = ({ item }: { item: SlipHistoryItem }) => {
    const isNinItem = item.category === "NIN";
    const isDownloading = downloadingId === item.id;
    const formattedDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Recent";

    return (
      <View style={styles.tableRow}>
        {/* Left: Avatar Thumbnail */}
        <TouchableOpacity
          onPress={() => setSelectedDetails(item)}
          activeOpacity={0.7}
          style={styles.avatarWrap}
        >
          {item.photo ? (
            <Image
              source={{ uri: item.photo }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                isNinItem ? styles.ninAvatarBg : styles.bvnAvatarBg,
              ]}
            >
              <User size={18} color={isNinItem ? colors.primary : "#0284C7"} />
            </View>
          )}
        </TouchableOpacity>

        {/* Center: Details & Metadata */}
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => setSelectedDetails(item)}
          activeOpacity={0.7}
        >
          <View style={styles.nameRow}>
            <Text style={styles.rowFullName} numberOfLines={1}>
              {item.fullName}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.rowIdentifier}>
              {item.maskedId || item.identifier}
            </Text>
            {item.searchType === "PHONE" ? (
              <View style={styles.phoneTag}>
                <Text style={styles.phoneTagText}>PHONE</Text>
              </View>
            ) : null}
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.rowSlipType} numberOfLines={1}>
              {item.slipType}
            </Text>
          </View>

          <View style={styles.bottomMetaRow}>
            <Text style={styles.rowDate}>{formattedDate}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.rowFee}>₦{Number(item.amountCharged || 0).toLocaleString()}</Text>
          </View>
        </TouchableOpacity>

        {/* Right: Actions */}
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setSelectedDetails(item)}
            activeOpacity={0.75}
          >
            <Eye size={12} color={colors.text} style={{ marginRight: 3 }} />
            <Text style={styles.detailsBtnText}>Details</Text>
          </TouchableOpacity>

          {item.hasPdf ? (
            <TouchableOpacity
              style={[styles.downloadIconBtn, isDownloading && { opacity: 0.7 }]}
              onPress={() => handleDownloadPdf(item)}
              disabled={isDownloading}
              activeOpacity={0.75}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Download size={13} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredText}>Expired</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const screenTitle = category === "NIN" ? "NIN Slips History" : "BVN Slips History";
  const searchPlaceholder =
    category === "NIN"
      ? "Search citizen name or NIN..."
      : "Search customer name or BVN...";

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{screenTitle}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search & Sub-Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Sub-Filter Pills */}
        <View style={styles.filterRow}>
          {filterOptions.map((opt) => {
            const isActive = filter === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.filterPill,
                  isActive && (category === "BVN" ? styles.filterPillActiveBvn : styles.filterPillActive),
                ]}
                onPress={() => setFilter(opt.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isActive && styles.filterPillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 72-Hour Data Purge & Privacy Banner */}
      <View style={styles.retentionBanner}>
        <Clock size={15} color={brandColor} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <View style={styles.retentionTitleRow}>
            <Text style={styles.retentionTitle}>72-Hour Retention Window</Text>
            <View style={[styles.retentionChip, { backgroundColor: `${brandColor}12` }]}>
              <Text style={[styles.retentionChipText, { color: brandColor }]}>NDPA Compliant</Text>
            </View>
          </View>
          <Text style={styles.retentionSubtitle}>
            For data security and privacy compliance, slip verification records and PDF documents are retained for 72 hours.
          </Text>
        </View>
      </View>

      {/* Slips List with Compact Rows */}
      <FlatList
        data={paginatedSlips}
        keyExtractor={(item) => item.id}
        renderItem={renderSlipItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={brandColor}
            colors={[brandColor]}
          />
        }
        ListFooterComponent={
          filteredSlips.length > 0 ? (
            <View style={styles.paginationSection}>
              <View style={styles.paginationInfoRow}>
                <Text style={styles.paginationInfoText}>
                  Showing{" "}
                  <Text style={{ fontWeight: "800", color: colors.text }}>
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                  </Text>{" "}
                  to{" "}
                  <Text style={{ fontWeight: "800", color: colors.text }}>
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredSlips.length)}
                  </Text>{" "}
                  of{" "}
                  <Text style={{ fontWeight: "800", color: colors.text }}>
                    {filteredSlips.length}
                  </Text>{" "}
                  records
                </Text>
              </View>

              {totalPages > 1 && (
                <View style={styles.paginationControls}>
                  <TouchableOpacity
                    style={[
                      styles.pageNavBtn,
                      currentPage === 1 && styles.pageNavBtnDisabled,
                    ]}
                    disabled={currentPage === 1}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    activeOpacity={0.75}
                  >
                    <ChevronLeft
                      size={15}
                      color={currentPage === 1 ? colors.textMuted : colors.text}
                    />
                    <Text
                      style={[
                        styles.pageNavBtnText,
                        currentPage === 1 && styles.pageNavBtnTextDisabled,
                      ]}
                    >
                      Prev
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.pagePill}>
                    <Text style={styles.pagePillText}>
                      {currentPage} / {totalPages}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.pageNavBtn,
                      currentPage === totalPages && styles.pageNavBtnDisabled,
                    ]}
                    disabled={currentPage === totalPages}
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.pageNavBtnText,
                        currentPage === totalPages && styles.pageNavBtnTextDisabled,
                      ]}
                    >
                      Next
                    </Text>
                    <ChevronRight
                      size={15}
                      color={currentPage === totalPages ? colors.textMuted : colors.text}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isFetching ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <FileText size={32} color={brandColor} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No Matching Slips" : `No ${category} Slips in 72 Hours`}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "No verification records matched your query."
                  : `You have not generated any ${category} verification slips within the last 72 hours.`}
              </Text>

              <TouchableOpacity
                style={[styles.quickGenBtn, { backgroundColor: brandColor }]}
                onPress={() =>
                  router.push(
                    (category === "BVN"
                      ? "/services/bvn-slip"
                      : "/services/nin-slip") as any
                  )
                }
                activeOpacity={0.85}
              >
                <Text style={styles.quickGenBtnText}>
                  Generate {category} Slip
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* APPLICANT IDENTITY DETAILS MODAL */}
      <Modal
        visible={!!selectedDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDetails(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Applicant Identity Details</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedDetails?.slipType} • {selectedDetails?.reference}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedDetails(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Profile Card */}
              <View style={styles.modalProfileCard}>
                {selectedDetails?.photo ? (
                  <Image
                    source={{ uri: selectedDetails.photo }}
                    style={styles.modalPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.modalPhoto, styles.modalPhotoFallback]}>
                    <User size={30} color={brandColor} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.modalFieldLabel}>FULL NAME</Text>
                  <Text style={styles.modalFullName} numberOfLines={2}>
                    {selectedDetails?.fullName}
                  </Text>
                  <View style={styles.modalIdBadge}>
                    <Text style={styles.modalIdBadgeText}>
                      {selectedDetails?.category}: {selectedDetails?.maskedId || selectedDetails?.identifier}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Demographics Grid (Only non-empty fields) */}
              {(() => {
                const demo = selectedDetails
                  ? parseDemographics(selectedDetails.userData || selectedDetails, selectedDetails.fullName)
                  : {};

                const isBvnRecord = selectedDetails?.category === "BVN";

                const dobVal = selectedDetails?.dob || demo.dob;
                const genderVal = selectedDetails?.gender || demo.gender;
                const phoneVal = selectedDetails?.phone || demo.phone;
                const emailVal = selectedDetails?.email || demo.email;
                const addressVal =
                  selectedDetails?.residentialAddress ||
                  selectedDetails?.address ||
                  demo.residentialAddress ||
                  demo.address;
                const stateOriginVal = selectedDetails?.stateOfOrigin || demo.stateOfOrigin;
                const lgaOriginVal = selectedDetails?.lgaOfOrigin || demo.lgaOfOrigin;
                const nationalityVal = selectedDetails?.nationality || demo.nationality;
                // Exclude marital status, account level, and enrollment bank for BVN to keep modal compact
                const maritalVal = isBvnRecord ? undefined : (selectedDetails?.maritalStatus || demo.maritalStatus);
                const stateResVal = selectedDetails?.stateOfResidence || demo.stateOfResidence;
                const lgaResVal = selectedDetails?.lgaOfResidence || demo.lgaOfResidence;
                const bankVal = isBvnRecord ? undefined : (selectedDetails?.enrollmentBank || demo.enrollmentBank);
                const levelVal = isBvnRecord ? undefined : (selectedDetails?.levelOfAccount || demo.levelOfAccount);
                const regDateVal = selectedDetails?.registrationDate || demo.registrationDate;

                const heightVal = selectedDetails?.height || demo.height;
                const weightVal = selectedDetails?.weight || demo.weight;
                const titleVal = selectedDetails?.title || demo.title;
                const religionVal = selectedDetails?.religion || demo.religion;

                const detailFields: { label: string; value?: string; fullWidth?: boolean; isMono?: boolean }[] = [
                  { label: "DATE OF BIRTH", value: dobVal },
                  { label: "GENDER", value: genderVal },
                  { label: "PHONE NUMBER", value: phoneVal, isMono: true },
                  { label: "MARITAL STATUS", value: maritalVal },
                  { label: "HEIGHT", value: heightVal },
                  { label: "WEIGHT", value: weightVal },
                  { label: "STATE OF ORIGIN", value: stateOriginVal },
                  { label: "LGA OF ORIGIN", value: lgaOriginVal },
                  { label: "NATIONALITY", value: nationalityVal },
                  { label: "STATE OF RESIDENCE", value: stateResVal },
                  { label: "LGA OF RESIDENCE", value: lgaResVal },
                  { label: "ACCOUNT LEVEL", value: levelVal },
                  { label: "ENROLLMENT BANK", value: bankVal },
                  { label: "TITLE", value: titleVal },
                  { label: "RELIGION", value: religionVal },
                  { label: "REGISTRATION DATE", value: regDateVal },
                  { label: "EMAIL", value: emailVal },
                  { label: "RESIDENTIAL ADDRESS", value: addressVal, fullWidth: true },
                  { label: "FORMAT", value: selectedDetails?.slipType },
                  {
                    label: "FEE CHARGED",
                    value: selectedDetails?.amountCharged
                      ? `₦${Number(selectedDetails.amountCharged).toLocaleString()}`
                      : undefined,
                  },
                ].filter((item) => {
                  if (!item.value) return false;
                  const s = String(item.value).trim();
                  return (
                    s !== "" &&
                    s.toUpperCase() !== "N/A" &&
                    s.toUpperCase() !== "NULL" &&
                    s.toUpperCase() !== "UNDEFINED"
                  );
                });

                return (
                  <View style={styles.modalGrid}>
                    {detailFields.map((field, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.gridItem,
                          field.fullWidth && styles.gridItemFull,
                        ]}
                      >
                        <Text style={styles.gridLabel}>{field.label}</Text>
                        <Text
                          style={[
                            styles.gridValue,
                            field.isMono && styles.gridValueMono,
                          ]}
                          numberOfLines={field.fullWidth ? 3 : 1}
                        >
                          {field.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Reference & Generation Timestamp */}
              <View style={styles.modalAuditCard}>
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Audit Reference</Text>
                  <Text style={styles.auditValue} numberOfLines={1}>
                    {selectedDetails?.reference}
                  </Text>
                </View>
                <View style={styles.auditDivider} />
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Generated At</Text>
                  <Text style={styles.auditValue}>
                    {selectedDetails?.createdAt
                      ? new Date(selectedDetails.createdAt).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Recent"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              {selectedDetails?.hasPdf ? (
                <TouchableOpacity
                  style={[styles.modalDownloadBtn, { backgroundColor: brandColor }]}
                  onPress={() => {
                    if (selectedDetails) {
                      handleDownloadPdf(selectedDetails);
                    }
                  }}
                  activeOpacity={0.85}
                  disabled={downloadingId === selectedDetails?.id}
                >
                  {downloadingId === selectedDetails?.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Download size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.modalDownloadBtnText}>
                    {downloadingId === selectedDetails?.id ? "Preparing PDF..." : "Download PDF Slip"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.modalDismissBtn}
                onPress={() => setSelectedDetails(null)}
              >
                <Text style={styles.modalDismissBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  searchSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterPillActiveBvn: {
    backgroundColor: "#0284C7",
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  /* 72-Hour Banner */
  retentionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  retentionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  retentionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  retentionChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  retentionChipText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  retentionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },

  /* List & Table Row */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 40,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarWrap: {
    marginRight: 10,
  },
  avatarImage: {
    width: 42,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  avatarFallback: {
    width: 42,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ninAvatarBg: {
    backgroundColor: "rgba(255, 63, 122, 0.08)",
  },
  bvnAvatarBg: {
    backgroundColor: "rgba(2, 132, 199, 0.08)",
  },
  rowMain: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  rowFullName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  rowIdentifier: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.textSecondary,
  },
  phoneTag: {
    backgroundColor: "rgba(2, 132, 199, 0.1)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  phoneTagText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#0284C7",
  },
  metaDot: {
    fontSize: 10,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
  rowSlipType: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    flexShrink: 1,
  },
  bottomMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowDate: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
  },
  rowFee: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  /* Row Actions */
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 6,
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  downloadIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  expiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
  },
  expiredText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
  },

  /* Pagination */
  paginationSection: {
    marginTop: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  paginationInfoRow: {
    marginBottom: 8,
  },
  paginationInfoText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  paginationControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pageNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  pageNavBtnTextDisabled: {
    color: colors.textMuted,
  },
  pagePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  pagePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.text,
  },

  /* Empty State */
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 18,
  },
  quickGenBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  quickGenBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* Applicant Details Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    maxHeight: "94%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalBody: {
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalProfileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    marginBottom: 10,
  },
  modalPhoto: {
    width: 48,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  modalPhotoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  modalFieldLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  modalFullName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginVertical: 1,
  },
  modalIdBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  modalIdBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.textSecondary,
  },
  modalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  gridItem: {
    width: "48.8%",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  gridItemFull: {
    width: "100%",
  },
  gridLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  gridValue: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.text,
  },
  gridValueMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 0.3,
  },
  modalAuditCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  auditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  auditDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginVertical: 5,
  },
  auditLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.textMuted,
  },
  auditValue: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.textSecondary,
    maxWidth: "60%",
  },
  modalActions: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.06)",
    gap: 6,
  },
  modalDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
  },
  modalDownloadBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalDismissBtn: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDismissBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});
