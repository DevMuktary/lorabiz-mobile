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
import { useTheme } from "../../context/ThemeContext";
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
        route: "/services/bvn-modification",
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
        route: "/services/business-name",
      },
      {
        id: "llc",
        title: "Company (LLC)",
        logo: require("../../assets/cac.png"),
      },
      {
        id: "annual_returns",
        title: "Annual Returns",
        logo: require("../../assets/cac.png"),
        route: "/services/annual-returns",
      },
      {
        id: "tax_id",
        title: "Tax ID (TIN)",
        logo: require("../../assets/nrs.png"),
        route: "/services/tax-id",
      },
      {
        id: "scuml",
        title: "SCUML",
        logo: require("../../assets/scuml.png"),
        route: "/services/scuml",
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
      },
      {
        id: "data",
        title: "Data Bundles",
        icon: Wifi,
        iconColor: "#2563EB",
        iconBg: "#EFF6FF",
      },
    ],
  },
];

export default function ServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

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
      const matched = section.items.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(q);
        const postIncorpMatch =
          item.id === "annual_returns" &&
          (q.includes("post") || q.includes("incorp") || q.includes("cac"));
        return titleMatch || postIncorpMatch;
      });
      return {
        ...section,
        items: matched,
      };
    }).filter((section) => section.items.length > 0);
  }, [searchQuery]);

  const handleServicePress = (svc: ServiceItem) => {
    if (svc.id === "post_incorp" || svc.id === "annual_returns" || svc.route) {
      router.push((svc.route || "/services/annual-returns") as any);
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Stagnant / Fixed Top App Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 20) + 12,
          },
        ]}
      >
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
            paddingBottom: Math.max(insets.bottom, 24) + 24,
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
                        svc.logo
                          ? {
                              backgroundColor: isDark ? "rgba(255, 255, 255, 0.96)" : "#FFFFFF",
                              borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.06)",
                            }
                          : {
                              backgroundColor: svc.iconBg
                                ? (isDark ? "rgba(255, 255, 255, 0.10)" : svc.iconBg)
                                : (isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"),
                              borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)",
                            },
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
            Lorabiz is an independent corporate facilitation and business management platform. We are an accredited corporate services facilitator and strictly not an agency of the Corporate Affairs Commission (CAC) or any government department.
          </Text>
        </View>
      </ScrollView>

      {/* Custom Alert Modal for upcoming service workflows */}
      <CustomAlertModal {...alertConfig} />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: colors.surfaceElevated,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      zIndex: 10,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
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
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 16,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 12,
      height: 44,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      paddingVertical: 0,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    sectionHeader: {
      marginBottom: 14,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.surfaceBorder,
    },
    sectionTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
    },
    gridItem: {
      width: "25%",
      alignItems: "center",
      paddingVertical: 8,
    },
    gridIconBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      marginBottom: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    gridAgencyLogo: {
      width: 32,
      height: 32,
    },
    gridLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
      lineHeight: 14,
      paddingHorizontal: 2,
    },
    emptySearchCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 32,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
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
    disclaimerBox: {
      backgroundColor: isDark ? "rgba(200, 45, 117, 0.12)" : "rgba(200, 45, 117, 0.06)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(200, 45, 117, 0.25)" : "rgba(200, 45, 117, 0.18)",
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
