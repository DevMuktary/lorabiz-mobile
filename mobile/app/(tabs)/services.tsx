import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Search,
  X,
  Wifi,
} from "lucide-react-native";
import { colors } from "../../constants/theme";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

interface ServiceItem {
  id: string;
  title: string;
  logo?: any;
  icon?: any;
  iconColor?: string;
  iconBg?: string;
  route?: string;
}

interface ServiceCategory {
  id: string;
  title: string;
  subtitle: string;
  items: ServiceItem[];
}

const SERVICE_SECTIONS: ServiceCategory[] = [
  {
    id: "nin",
    title: "National Identity (NIMC)",
    subtitle: "National NIN verification slips, validation, and database updates",
    items: [
      {
        id: "nin_slip",
        title: "NIN Slip",
        logo: require("../../assets/nimc.png"),
        route: "/services/nin-slip",
      },
      {
        id: "nin_validation",
        title: "NIN Validation",
        logo: require("../../assets/nimc.png"),
        route: "/services/nin-validation",
      },
      {
        id: "ipe_clearance",
        title: "IPE Clearance",
        logo: require("../../assets/nimc.png"),
        route: "/services/nin-ipe",
      },
      {
        id: "nin_modification",
        title: "NIN Modification",
        logo: require("../../assets/nimc.png"),
        route: "/services/nin-modification",
      },
      {
        id: "nin_personalization",
        title: "Personalization",
        logo: require("../../assets/nimc.png"),
        route: "/services/nin-personalization",
      },
    ],
  },
  {
    id: "bvn",
    title: "Bank Verification (NIBSS)",
    subtitle: "Accredited BVN verification slips, retrieval, and corrections",
    items: [
      {
        id: "bvn_slip",
        title: "BVN Slip",
        logo: require("../../assets/nibss.png"),
        route: "/services/bvn-slip",
      },
      {
        id: "bvn_retrieval",
        title: "BVN Retrieval",
        logo: require("../../assets/nibss.png"),
        route: "/services/bvn-retrieval",
      },
      {
        id: "bvn_modification",
        title: "BVN Modification",
        logo: require("../../assets/nibss.png"),
      },
    ],
  },
  {
    id: "corporate",
    title: "Corporate & Tax",
    subtitle: "Accredited CAC filings, corporate TIN, and SCUML certification",
    items: [
      {
        id: "biz_name",
        title: "Business Name",
        logo: require("../../assets/cac.png"),
      },
      {
        id: "llc",
        title: "Company (LLC)",
        logo: require("../../assets/cac.png"),
      },
      {
        id: "tax_id",
        title: "Tax ID (TIN)",
        logo: require("../../assets/nrs.png"),
      },
      {
        id: "scuml",
        title: "SCUML",
        logo: require("../../assets/scuml.png"),
      },
      {
        id: "post_incorp",
        title: "Post Incorp",
        logo: require("../../assets/cac.png"),
      },
    ],
  },
  {
    id: "bills",
    title: "Bills & Utilities",
    subtitle: "Instant nationwide airtime top-up and high-speed data bundles",
    items: [
      {
        id: "airtime",
        title: "Airtime",
        logo: require("../../assets/airtime.png"),
        route: "/(tabs)/bills",
      },
      {
        id: "data",
        title: "Data Bundles",
        icon: Wifi,
        iconColor: "#2563EB",
        iconBg: "#EFF6FF",
        route: "/(tabs)/bills",
      },
    ],
  },
];

export default function ServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
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

  // Filter items by search query across all sections
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SERVICE_SECTIONS;

    return SERVICE_SECTIONS.map((section) => {
      const matched = section.items.filter((item) =>
        item.title.toLowerCase().includes(q)
      );
      return {
        ...section,
        items: matched,
      };
    }).filter((section) => section.items.length > 0);
  }, [searchQuery]);

  const handleServicePress = (svc: ServiceItem) => {
    if (svc.route) {
      router.push(svc.route as any);
    } else {
      setAlertConfig({
        visible: true,
        type: "info",
        title: svc.title,
        message: `${svc.title} is currently active on the Lorabiz web platform. Dedicated mobile flow is launching soon!`,
        confirmText: "Got It",
        onConfirm: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Stagnant / Fixed Top App Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Services</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16) + 72,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Input Bar */}
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services (NIN, BVN, CAC, Data...)"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Categorized Service Grids */}
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => (
            <View key={section.id} style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>

              <View style={styles.gridContainer}>
                {section.items.map((svc) => (
                  <TouchableOpacity
                    key={svc.id}
                    style={styles.gridItem}
                    onPress={() => handleServicePress(svc)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.gridIconBox,
                        svc.iconBg ? { backgroundColor: svc.iconBg } : null,
                      ]}
                    >
                      {svc.logo ? (
                        <Image
                          source={svc.logo}
                          style={styles.gridAgencyLogo}
                          resizeMode="contain"
                        />
                      ) : svc.icon ? (
                        <svc.icon size={24} color={svc.iconColor || colors.primary} />
                      ) : null}
                    </View>
                    <Text
                      style={styles.gridLabel}
                      numberOfLines={2}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.75}
                    >
                      {svc.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptySearchCard}>
            <Search size={28} color={colors.textMuted} />
            <Text style={styles.emptySearchTitle}>No services found</Text>
            <Text style={styles.emptySearchSubtitle}>
              Try searching with another keyword like &quot;NIN&quot;, &quot;BVN&quot;, or &quot;CAC&quot;.
            </Text>
          </View>
        )}

        {/* Regulatory Notice Disclaimer Box */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>Regulatory Notice</Text>
          <Text style={styles.disclaimerText}>
            Lorabiz is an independent corporate facilitation and business management platform. We are an accredited corporate services facilitator and not an agency of the Corporate Affairs Commission (CAC) or the Federal Government of Nigeria.
          </Text>
        </View>
      </ScrollView>

      {/* Custom Alert Modal for upcoming service workflows */}
      <CustomAlertModal {...alertConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  /* Stagnant / Fixed Top App Bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  backBtnPlaceholder: {
    width: 36,
  },

  /* Scrollable Container */
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },

  /* Search Input */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },

  /* Category Section Card */
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },

  /* 4-Column Grid Layout */
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  gridItem: {
    width: "25%",
    alignItems: "center",
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  gridIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  gridAgencyLogo: {
    width: 28,
    height: 28,
  },
  gridLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 13,
    paddingHorizontal: 1,
  },

  /* Empty Search Card */
  emptySearchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  emptySearchTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
  },
  emptySearchSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },

  /* Disclaimer Box */
  disclaimerBox: {
    backgroundColor: "rgba(200, 45, 117, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.2)",
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.primaryLight,
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 10.5,
    color: colors.textSecondary,
    lineHeight: 15,
  },
});
