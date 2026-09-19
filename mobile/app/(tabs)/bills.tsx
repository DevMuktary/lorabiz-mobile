import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Zap, Phone, Wifi, Tv, Lightbulb, CheckCircle2, Wallet, AlertCircle } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";

const NETWORKS = [
  { id: "MTN", name: "MTN", color: "#FBBF24", logo: require("../../assets/mtn.png") },
  { id: "AIRTEL", name: "Airtel", color: "#EF4444", logo: require("../../assets/airtel.png") },
  { id: "GLO", name: "Glo", color: "#10B981", logo: require("../../assets/glo.png") },
  { id: "9MOBILE", name: "9mobile", color: "#84CC16", logo: require("../../assets/9mobile.png") },
];

const AIRTIME_AMOUNTS = [200, 500, 1000, 2000, 5000];

export default function BillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, wallet, refreshWallet, refreshProfile } = useAuth();

  // Auto-refresh wallet when screen focuses
  useFocusEffect(
    useCallback(() => {
      refreshWallet().catch(() => {});
    }, [refreshWallet])
  );

  const [billType, setBillType] = useState<"AIRTIME" | "DATA" | "POWER" | "TV">("AIRTIME");
  const [selectedNetwork, setSelectedNetwork] = useState("MTN");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("500");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const walletBalance = wallet?.balance ?? user?.wallet?.balance ?? 0;
  const numAmount = Number(amount || 0);

  // Auto-detect Nigerian network from phone prefix
  function handlePhoneChange(val: string) {
    setPhone(val);
    const clean = val.trim();
    if (clean.length >= 4) {
      const prefix = clean.substring(0, 4);
      if (["0803", "0806", "0703", "0706", "0813", "0816", "0810", "0814", "0903", "0906"].includes(prefix)) {
        setSelectedNetwork("MTN");
      } else if (["0802", "0808", "0708", "0812", "0701", "0902", "0901", "0904"].includes(prefix)) {
        setSelectedNetwork("AIRTEL");
      } else if (["0805", "0807", "0705", "0815", "0811", "0905"].includes(prefix)) {
        setSelectedNetwork("GLO");
      } else if (["0809", "0818", "0817", "0909", "0908"].includes(prefix)) {
        setSelectedNetwork("9MOBILE");
      }
    }
  }

  async function handlePurchaseAirtime() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!phone.trim() || phone.trim().length !== 11) {
      setErrorMsg("Please enter a valid 11-digit phone number.");
      return;
    }

    if (!numAmount || numAmount < 50) {
      setErrorMsg("Minimum airtime recharge is ₦50.");
      return;
    }

    if (numAmount > walletBalance) {
      setErrorMsg("Insufficient wallet balance. Please fund your wallet.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post("/api/utilities/airtime", {
        network: selectedNetwork,
        phoneNumber: phone.trim(),
        amount: numAmount,
      });

      if (res?.success || res?.status === "success") {
        setSuccessMsg(`Successfully recharged ₦${numAmount.toLocaleString()} airtime to ${phone}!`);
        setPhone("");
        refreshWallet().catch(() => {});
        refreshProfile();
      } else {
        setErrorMsg(res?.message || "Airtime purchase could not be completed.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Service network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: Math.max(insets.top, 16) + 12,
            paddingBottom: Math.max(insets.bottom, 16) + 72,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bills & Utilities</Text>
        <Text style={styles.headerSubtitle}>
          Instant airtime, data bundles, electricity tokens, and cable subscriptions
        </Text>
      </View>

      {/* Wallet Balance Bar */}
      <View style={styles.walletBar}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Wallet size={16} color={colors.primaryLight} style={{ marginRight: 8 }} />
          <Text style={styles.walletBarLabel}>Available Balance: </Text>
          <Text style={styles.walletBarAmount}>
            ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.fundWalletShortcut}
          onPress={() => router.push("/wallet/fund" as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.fundWalletShortcutText}>+ Fund</Text>
        </TouchableOpacity>
      </View>

      {/* Bill Categories */}
      <View style={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.categoryBtn, billType === "AIRTIME" && styles.categoryBtnActive]}
          onPress={() => setBillType("AIRTIME")}
        >
          <Phone size={18} color={billType === "AIRTIME" ? "#FFFFFF" : colors.textSecondary} />
          <Text style={[styles.categoryText, billType === "AIRTIME" && styles.categoryTextActive]}>
            Airtime
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.categoryBtn, billType === "DATA" && styles.categoryBtnActive]}
          onPress={() => setBillType("DATA")}
        >
          <Wifi size={18} color={billType === "DATA" ? "#FFFFFF" : colors.textSecondary} />
          <Text style={[styles.categoryText, billType === "DATA" && styles.categoryTextActive]}>
            Data
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.categoryBtn, billType === "POWER" && styles.categoryBtnActive]}
          onPress={() => setBillType("POWER")}
        >
          <Lightbulb size={18} color={billType === "POWER" ? "#FFFFFF" : colors.textSecondary} />
          <Text style={[styles.categoryText, billType === "POWER" && styles.categoryTextActive]}>
            Power
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.categoryBtn, billType === "TV" && styles.categoryBtnActive]}
          onPress={() => setBillType("TV")}
        >
          <Tv size={18} color={billType === "TV" ? "#FFFFFF" : colors.textSecondary} />
          <Text style={[styles.categoryText, billType === "TV" && styles.categoryTextActive]}>
            Cable
          </Text>
        </TouchableOpacity>
      </View>

      {billType === "AIRTIME" || billType === "DATA" ? (
        <View style={styles.formCard}>
          {/* Network Selector */}
          <Text style={styles.fieldLabel}>Select Network</Text>
          <View style={styles.networkGrid}>
            {NETWORKS.map((net) => {
              const isSelected = selectedNetwork === net.id;
              return (
                <TouchableOpacity
                  key={net.id}
                  style={[styles.networkBtn, isSelected && styles.networkBtnActive]}
                  onPress={() => setSelectedNetwork(net.id)}
                  activeOpacity={0.8}
                >
                  <Image source={net.logo} style={{ width: 26, height: 26, borderRadius: 13, marginRight: 8 }} resizeMode="contain" />
                  <Text style={[styles.netName, isSelected && styles.netNameActive]}>
                    {net.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Phone Input */}
          <Text style={styles.fieldLabel}>Recipient Phone Number</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="08012345678"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>

          {/* Amount Input */}
          <Text style={styles.fieldLabel}>Recharge Amount (₦)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="500"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
            />
          </View>

          {/* Preset Buttons */}
          <View style={styles.presetGrid}>
            {AIRTIME_AMOUNTS.map((val) => {
              const isSelected = amount === String(val);
              return (
                <TouchableOpacity
                  key={val}
                  style={[styles.presetItem, isSelected && styles.presetItemActive]}
                  onPress={() => setAmount(String(val))}
                >
                  <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                    ₦{val}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Wallet Balance Info */}
          <View style={styles.walletBox}>
            <Wallet size={16} color={colors.primaryLight} />
            <Text style={styles.walletText}>
              Wallet:{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                ₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </Text>
            </Text>
          </View>

          {/* Alerts */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color="#FCA5A5" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successBox}>
              <CheckCircle2 size={18} color="#86EFAC" style={{ marginRight: 8 }} />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.actionBtn, isLoading && styles.actionBtnDisabled]}
            onPress={handlePurchaseAirtime}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionBtnText}>
                Pay ₦{Number(amount || 0).toLocaleString()} from Wallet
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.comingSoonCard}>
          <Lightbulb size={32} color={colors.gold} />
          <Text style={styles.comingSoonTitle}>
            {billType === "POWER" ? "Electricity Token Purchase" : "Cable TV Subscription"}
          </Text>
          <Text style={styles.comingSoonText}>
            Disco meter verification and decoder renewals are available. Select your provider to proceed.
          </Text>
        </View>
      )}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  categoryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  categoryBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 4,
  },
  categoryTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  networkGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  networkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 10,
    borderRadius: 10,
  },
  networkBtnActive: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceElevated,
  },
  netDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  netName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  netNameActive: {
    color: colors.text,
    fontWeight: "700",
  },
  inputWrapper: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  textInput: {
    color: colors.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  presetGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  presetItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  presetItemActive: {
    borderColor: colors.primary,
    backgroundColor: "#C82D7522",
  },
  presetText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  presetTextActive: {
    color: colors.primaryLight,
    fontWeight: "700",
  },
  walletBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 16,
  },
  walletText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#FCA5A5",
    fontSize: 13,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    color: "#86EFAC",
    fontSize: 13,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  comingSoonCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    marginTop: 10,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 12,
  },
  comingSoonText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  walletBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  walletBarLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  walletBarAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  fundWalletShortcut: {
    backgroundColor: "rgba(200, 45, 117, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fundWalletShortcutText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primaryLight,
  },
});
