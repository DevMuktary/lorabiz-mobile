import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Scale,
  AlertTriangle,
  Info,
} from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import {
  TERMS_OF_SERVICE_DOC,
  PRIVACY_POLICY_DOC,
} from "../../constants/legalDocuments";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [documentType, setDocumentType] = useState<"TERMS" | "PRIVACY">("TERMS");
  const doc = documentType === "TERMS" ? TERMS_OF_SERVICE_DOC : PRIVACY_POLICY_DOC;

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 16),
            backgroundColor: colors.surfaceElevated,
            borderBottomColor: colors.surfaceBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)" },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Legal & Compliance</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Regulatory Standing Notice Card */}
        <TouchableOpacity
          style={[
            styles.regulatoryCard,
            {
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
              borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
            },
          ]}
          onPress={() =>
            setAlertConfig({
              visible: true,
              type: "info",
              title: "Regulatory Notice",
              message:
                "Lorabiz is an independent corporate facilitation and business management platform. We are an accredited corporate services facilitator and strictly not an agency of the Corporate Affairs Commission (CAC) or any government department.",
              confirmText: "Understood",
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.regulatoryIconBox}>
            <Info size={18} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.regulatoryTitle, { color: isDark ? "#FBBF24" : "#92400E" }]}>
              Accredited Corporate Facilitator
            </Text>
            <Text style={[styles.regulatoryText, { color: isDark ? "#FDE68A" : "#B45309" }]}>
              Lorabiz is an independent corporate facilitation platform and strictly not a government department or agency. Tap for regulatory details.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Document Segment Switcher */}
        <View
          style={[
            styles.tabSwitcher,
            {
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
              borderColor: colors.surfaceBorder,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabBtn,
              documentType === "TERMS" && [
                styles.tabBtnActive,
                { backgroundColor: isDark ? colors.surfaceElevated : "#FFFFFF" },
              ],
            ]}
            onPress={() => setDocumentType("TERMS")}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: colors.textSecondary },
                documentType === "TERMS" && { color: colors.primary, fontWeight: "700" },
              ]}
            >
              Terms of Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              documentType === "PRIVACY" && [
                styles.tabBtnActive,
                { backgroundColor: isDark ? colors.surfaceElevated : "#FFFFFF" },
              ],
            ]}
            onPress={() => setDocumentType("PRIVACY")}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: colors.textSecondary },
                documentType === "PRIVACY" && { color: colors.primary, fontWeight: "700" },
              ]}
            >
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Document Banner */}
        <View
          style={[
            styles.docHeaderCard,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <Text style={[styles.docTag, { color: colors.primary }]}>{doc.tag}</Text>
          <Text style={[styles.docTitle, { color: colors.text }]}>{doc.title}</Text>
          <Text style={[styles.docMeta, { color: colors.textSecondary }]}>
            Effective: {doc.effectiveDate} • {doc.regulatoryStandard}
          </Text>
        </View>

        {/* Preamble Callout if present */}
        {doc.preambleCallout ? (
          <View
            style={[
              styles.preambleBox,
              {
                backgroundColor: isDark ? "rgba(217, 119, 6, 0.12)" : "#FFFBEB",
                borderColor: isDark ? "rgba(217, 119, 6, 0.28)" : "#FDE68A",
              },
            ]}
          >
            <View style={styles.preambleHeader}>
              <AlertTriangle size={15} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={[styles.preambleTitle, { color: isDark ? "#FBBF24" : "#92400E" }]}>
                {doc.preambleCallout.title}
              </Text>
            </View>
            <Text style={[styles.preambleText, { color: isDark ? "#FDE68A" : "#B45309" }]}>
              {doc.preambleCallout.text}
            </Text>
          </View>
        ) : null}

        {/* Intro */}
        {doc.intro ? (
          <Text style={[styles.introText, { color: colors.text }]}>{doc.intro}</Text>
        ) : null}

        {/* Sections */}
        {doc.sections.map((sec) => (
          <View
            key={sec.id}
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
            ]}
          >
            <Text style={[styles.secTitle, { color: colors.text }]}>{sec.title}</Text>

            {sec.callout ? (
              <View
                style={[
                  styles.secCallout,
                  {
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.secCalloutText, { color: colors.textSecondary }]}>
                  {sec.callout}
                </Text>
              </View>
            ) : null}

            {sec.subsections ? (
              sec.subsections.map((sub, idx) => (
                <View key={idx} style={{ marginBottom: 12 }}>
                  {sub.subtitle ? (
                    <Text style={[styles.subTitle, { color: colors.text }]}>{sub.subtitle}</Text>
                  ) : null}
                  <Text style={[styles.secBody, { color: colors.textSecondary }]}>
                    {sub.text}
                  </Text>
                </View>
              ))
            ) : null}

            {sec.body ? (
              <Text
                style={[
                  styles.secBody,
                  { marginBottom: sec.bullets ? 8 : 0, color: colors.textSecondary },
                ]}
              >
                {sec.body}
              </Text>
            ) : null}

            {sec.bullets ? (
              <View style={{ marginTop: 4 }}>
                {sec.bullets.map((b, bIdx) => (
                  <View key={bIdx} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: colors.primary }]}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {/* Footer */}
        <View
          style={[
            styles.footerCard,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <Text style={[styles.footerCompany, { color: colors.text }]}>
            {doc.footer.company}
          </Text>
          {doc.footer.items.map((item, idx) => (
            <Text key={idx} style={[styles.footerItem, { color: colors.textSecondary }]}>
              {item.label}:{" "}
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{item.value}</Text>
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* In-Page Custom Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        onConfirm={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  backBtnPlaceholder: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  regulatoryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  regulatoryIconBox: {
    marginRight: 10,
    marginTop: 1,
  },
  regulatoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  regulatoryText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  tabSwitcher: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  docHeaderCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  docTag: {
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 11.5,
  },
  preambleBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  preambleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  preambleTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  preambleText: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  introText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  secTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 10,
  },
  secCallout: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  secCalloutText: {
    fontSize: 12,
    lineHeight: 17,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  secBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 18,
    marginRight: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  footerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
  },
  footerCompany: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  footerItem: {
    fontSize: 12,
    lineHeight: 18,
  },
});
