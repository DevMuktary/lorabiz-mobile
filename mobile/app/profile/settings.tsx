import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Pressable,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Sun,
  Moon,
  Smartphone,
  Check,
  Clock,
  EyeOff,
  Mail,
  ChevronRight,
  X,
  UserX,
  AlertTriangle,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const {
    user,
    autoLockTimeout,
    setAutoLockSetting,
    hideBalance,
    setHideBalancePreference,
    refreshProfile,
  } = useAuth();

  const [emailAlerts, setEmailAlerts] = useState(user?.emailLoginAlerts ?? true);
  const [isAutoLockModalVisible, setIsAutoLockModalVisible] = useState(false);

  // Sync state with user profile
  React.useEffect(() => {
    if (user) {
      setEmailAlerts(user.emailLoginAlerts ?? true);
    }
  }, [user]);

  async function handleToggleHideBalances(val: boolean) {
    await setHideBalancePreference(val);
  }

  async function handleToggleEmailAlerts(val: boolean) {
    setEmailAlerts(val);
    try {
      const res = await api.put("/api/user/profile", { emailLoginAlerts: val });
      if (res?.success) {
        await refreshProfile();
      } else {
        setEmailAlerts(!val);
      }
    } catch {
      setEmailAlerts(!val);
    }
  }

  const getAutoLockLabel = (timeout: string) => {
    switch (timeout) {
      case "immediately":
        return "Immediate";
      case "1m":
        return "1 Min";
      case "5m":
        return "5 Mins";
      case "15m":
        return "15 Mins";
      case "30m":
        return "30 Mins";
      case "1h":
        return "1 Hour";
      case "2h":
        return "2 Hours";
      default:
        return "Never";
    }
  };

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
        <Text style={[styles.topBarTitle, { color: colors.text }]}>Settings & Preferences</Text>
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
        {/* Section 1: Theme & Appearance */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          Theme & Appearance
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <Text style={[styles.cardExplainer, { color: colors.textMuted }]}>
            Choose how you would like Lorabiz to look or follow your device settings.
          </Text>

          <View style={styles.themeOptionsGrid}>
            {/* System Mode */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                {
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
                  borderColor: themeMode === "system" ? colors.primary : colors.surfaceBorder,
                },
                themeMode === "system" && styles.themeOptionBtnActive,
              ]}
              onPress={() => setThemeMode("system")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.themeIconCircle,
                  themeMode === "system"
                    ? { backgroundColor: "rgba(200, 45, 117, 0.15)" }
                    : { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9" },
                ]}
              >
                <Smartphone
                  size={22}
                  color={themeMode === "system" ? colors.primary : colors.textMuted}
                />
              </View>
              <Text style={[styles.themeOptionTitle, { color: colors.text }]}>System</Text>
              <Text style={[styles.themeOptionDesc, { color: colors.textMuted }]}>
                Follows device
              </Text>
              {themeMode === "system" && (
                <View style={[styles.themeCheckBadge, { backgroundColor: colors.primary }]}>
                  <Check size={11} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Light Mode */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                {
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
                  borderColor: themeMode === "light" ? colors.primary : colors.surfaceBorder,
                },
                themeMode === "light" && styles.themeOptionBtnActive,
              ]}
              onPress={() => setThemeMode("light")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.themeIconCircle,
                  themeMode === "light"
                    ? { backgroundColor: "rgba(200, 45, 117, 0.15)" }
                    : { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9" },
                ]}
              >
                <Sun size={22} color={themeMode === "light" ? colors.primary : colors.textMuted} />
              </View>
              <Text style={[styles.themeOptionTitle, { color: colors.text }]}>Light</Text>
              <Text style={[styles.themeOptionDesc, { color: colors.textMuted }]}>
                Clean white
              </Text>
              {themeMode === "light" && (
                <View style={[styles.themeCheckBadge, { backgroundColor: colors.primary }]}>
                  <Check size={11} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Dark Mode */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                {
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
                  borderColor: themeMode === "dark" ? colors.primary : colors.surfaceBorder,
                },
                themeMode === "dark" && styles.themeOptionBtnActive,
              ]}
              onPress={() => setThemeMode("dark")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.themeIconCircle,
                  themeMode === "dark"
                    ? { backgroundColor: "rgba(200, 45, 117, 0.15)" }
                    : { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9" },
                ]}
              >
                <Moon size={22} color={themeMode === "dark" ? colors.primary : colors.textMuted} />
              </View>
              <Text style={[styles.themeOptionTitle, { color: colors.text }]}>Dark</Text>
              <Text style={[styles.themeOptionDesc, { color: colors.textMuted }]}>
                Deep slate
              </Text>
              {themeMode === "dark" && (
                <View style={[styles.themeCheckBadge, { backgroundColor: colors.primary }]}>
                  <Check size={11} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Session Security */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>
          Session Security
        </Text>
        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setIsAutoLockModalVisible(true)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.menuIconBox,
                {
                  backgroundColor: isDark
                    ? "rgba(139, 92, 246, 0.15)"
                    : "rgba(139, 92, 246, 0.10)",
                },
              ]}
            >
              <Clock size={19} color={colors.purple} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>App Auto-Lock</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                Require unlock when inactive or minimized
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                  {getAutoLockLabel(autoLockTimeout)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 3: Display & Privacy */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>
          Display & Privacy
        </Text>
        <View
          style={[
            styles.menuCard,
            { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          {/* Hide Balance Toggle */}
          <View
            style={[
              styles.menuItem,
              {
                borderBottomColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : colors.surfaceBorder,
              },
            ]}
          >
            <View
              style={[
                styles.menuIconBox,
                {
                  backgroundColor: isDark ? "rgba(100, 116, 139, 0.15)" : "#F1F5F9",
                },
              ]}
            >
              <EyeOff size={19} color={colors.textSecondary} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Hide Balances by Default</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                Mask balances across wallet and dashboard
              </Text>
            </View>
            <Switch
              value={hideBalance}
              onValueChange={handleToggleHideBalances}
              trackColor={{ false: isDark ? "#334155" : "#CBD5E1", true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Email Login Alerts */}
          <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <View
              style={[
                styles.menuIconBox,
                {
                  backgroundColor: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                },
              ]}
            >
              <Mail size={19} color={colors.info} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Email Login Alerts</Text>
              <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                Notify via email on new sign-ins
              </Text>
            </View>
            <Switch
              value={emailAlerts}
              onValueChange={handleToggleEmailAlerts}
              trackColor={{ false: isDark ? "#334155" : "#CBD5E1", true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>

      {/* Auto-Lock Native Modal Picker (Bottom Sheet Presentation) */}
      <Modal
        visible={isAutoLockModalVisible}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setIsAutoLockModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsAutoLockModalVisible(false)}
          />
          <View
            style={[
              styles.bottomSheetCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.surfaceBorder,
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "#CBD5E1" }]} />
            <View style={styles.dialogHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dialogTitle, { color: colors.text }]}>
                  App Auto-Lock Timeout
                </Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>
                  Select inactivity duration before requiring unlock
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAutoLockModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.closeIconCircle, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9" }]}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 14, gap: 8 }}>
              {[
                { id: "immediately", label: "Immediately upon leaving" },
                { id: "1m", label: "1 Minute of inactivity" },
                { id: "5m", label: "5 Minutes of inactivity" },
                { id: "15m", label: "15 Minutes of inactivity" },
                { id: "30m", label: "30 Minutes of inactivity" },
                { id: "never", label: "Never (Require manual sign out)" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.autoLockOptionRow,
                    {
                      backgroundColor:
                        autoLockTimeout === option.id
                          ? (isDark ? "rgba(200, 45, 117, 0.15)" : "#FDF2F8")
                          : (isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC"),
                      borderColor:
                        autoLockTimeout === option.id ? colors.primary : colors.surfaceBorder,
                    },
                  ]}
                  onPress={() => {
                    setAutoLockSetting(option.id as any);
                    setIsAutoLockModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.autoLockOptionLabel,
                      { color: colors.text },
                      autoLockTimeout === option.id && {
                        color: colors.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {autoLockTimeout === option.id ? (
                    <View
                      style={[styles.optionRadioActive, { backgroundColor: colors.primary }]}
                    >
                      <Check size={12} color="#FFFFFF" />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.optionRadioInactive,
                        { borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "#CBD5E1" },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardExplainer: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  themeOptionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  themeOptionBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    alignItems: "center",
    position: "relative",
  },
  themeOptionBtnActive: {
    shadowColor: "#C82D75",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  themeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  themeOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  themeOptionDesc: {
    fontSize: 10.5,
    marginTop: 2,
  },
  themeCheckBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuTexts: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  menuSub: {
    fontSize: 12,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  bottomSheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  closeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  autoLockOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  autoLockOptionLabel: {
    fontSize: 13.5,
    fontWeight: "500",
  },
  optionRadioActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionRadioInactive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});
