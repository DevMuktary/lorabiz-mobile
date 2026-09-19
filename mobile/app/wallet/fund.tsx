import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck, X, CheckCircle2 } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

interface VerifiedPayment {
  amount: number;
  balance: number;
  reference: string;
}

export default function FundWalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, wallet, updateWalletBalance, refreshWallet, refreshProfile } = useAuth();

  const [amount, setAmount] = useState("5000");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // KoraPay WebView State
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isWebViewOpen, setIsWebViewOpen] = useState(false);

  // Verified Payment State (Strictly shown ONLY after backend server confirmation)
  const [verifiedPayment, setVerifiedPayment] = useState<VerifiedPayment | null>(null);

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  // Auto-refresh wallet when screen focuses
  useFocusEffect(
    useCallback(() => {
      refreshWallet().catch(() => {});
    }, [refreshWallet])
  );

  const currentBalance = wallet?.balance ?? user?.wallet?.balance ?? 0;

  async function handleInitializeKoraPay() {
    Keyboard.dismiss();
    setErrorMsg(null);
    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount < 100) {
      setErrorMsg("Minimum funding amount is ₦100.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post("/api/payment/checkout", {
        service: "wallet_funding",
        amount: numAmount,
        paymentMethod: "ONLINE",
      });

      if (res?.success && res.authorizationUrl) {
        setPaymentReference(res.reference || null);
        setCheckoutUrl(res.authorizationUrl);
        setIsWebViewOpen(true);
      } else {
        setErrorMsg(res?.message || "Failed to initialize payment gateway.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Payment network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Strictly verify with server before showing ANY success
  async function verifyPayment(ref: string, fundedAmount: number) {
    setIsVerifying(true);
    setErrorMsg(null);

    let verified = false;
    let finalBalance = currentBalance + fundedAmount;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !verified) {
      attempts++;
      try {
        const verifyRes = await api.post("/api/payment/verify", { reference: ref });
        if (verifyRes?.success) {
          verified = true;
          if (typeof verifyRes.balance === "number") {
            finalBalance = verifyRes.balance;
          } else if (typeof verifyRes.wallet?.balance === "number") {
            finalBalance = verifyRes.wallet.balance;
          }
          break;
        }
      } catch {
        // Retry after delay
      }

      if (!verified && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setIsVerifying(false);

    if (verified) {
      // Confirmed by backend server!
      updateWalletBalance(finalBalance);
      refreshProfile().catch(() => {});
      setVerifiedPayment({
        amount: fundedAmount,
        balance: finalBalance,
        reference: ref,
      });
    } else {
      // NEVER announce success if not confirmed!
      setAlertModal({
        visible: true,
        type: "error",
        title: "Payment Unconfirmed",
        message:
          "We could not verify this payment with the payment gateway. If you were debited, your wallet will automatically be credited once confirmed by the bank.",
        confirmText: "Check Status Again",
        cancelText: "Dismiss",
        onConfirm: () => {
          setAlertModal((prev) => ({ ...prev, visible: false }));
          verifyPayment(ref, fundedAmount);
        },
        onCancel: () => {
          setAlertModal((prev) => ({ ...prev, visible: false }));
        },
      });
    }
  }

  function handleNavigationStateChange(navState: any) {
    const { url } = navState;

    // Detect if KoraPay is redirecting to the return/callback URL
    const isCompleted =
      url.includes("funded=true") ||
      url.includes("/dashboard") ||
      url.includes("status=success") ||
      url.includes("success=true");

    const isCancelled =
      url.includes("status=failed") ||
      url.includes("status=cancelled") ||
      url.includes("cancel=true");

    if (isCancelled) {
      setIsWebViewOpen(false);
      setCheckoutUrl(null);
      setAlertModal({
        visible: true,
        type: "warning",
        title: "Payment Cancelled",
        message: "The checkout process was cancelled. Your wallet was not charged.",
        confirmText: "OK",
        onConfirm: () => setAlertModal((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (isCompleted && paymentReference) {
      setIsWebViewOpen(false);
      setCheckoutUrl(null);
      verifyPayment(paymentReference, Number(amount || 0));
    }
  }

  function handleCloseWebView() {
    if (paymentReference) {
      setAlertModal({
        visible: true,
        type: "confirm",
        title: "Close Checkout?",
        message: "Have you already completed the payment on the KoraPay gateway?",
        confirmText: "Yes, Verify Payment",
        cancelText: "No, Cancel",
        onConfirm: () => {
          setAlertModal((prev) => ({ ...prev, visible: false }));
          setIsWebViewOpen(false);
          setCheckoutUrl(null);
          verifyPayment(paymentReference, Number(amount || 0));
        },
        onCancel: () => {
          setAlertModal((prev) => ({ ...prev, visible: false }));
          setIsWebViewOpen(false);
          setCheckoutUrl(null);
        },
      });
    } else {
      setIsWebViewOpen(false);
      setCheckoutUrl(null);
    }
  }

  // =========================================================================
  // VIEW 1: KoraPay Inline WebView
  // =========================================================================
  if (isWebViewOpen && checkoutUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.webViewHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
          <Text style={styles.webViewTitle}>KoraPay Secure Checkout</Text>
          <TouchableOpacity
            onPress={handleCloseWebView}
            style={styles.closeWebViewBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <WebView
          source={{ uri: checkoutUrl }}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webLoading}>
              <Image
                source={require("../../assets/logo.png")}
                style={{ width: 48, height: 48, marginBottom: 12 }}
                resizeMode="contain"
              />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                Connecting to Gateway...
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 12 }}>
                Please wait while we load your secure checkout
              </Text>
            </View>
          )}
        />

        <CustomAlertModal
          visible={alertModal.visible}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          confirmText={alertModal.confirmText}
          cancelText={alertModal.cancelText}
          onConfirm={alertModal.onConfirm}
          onCancel={alertModal.onCancel}
        />
      </View>
    );
  }

  // =========================================================================
  // VIEW 2: Centered Verified Success Screen (ONLY after server confirmation)
  // =========================================================================
  if (verifiedPayment) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <CheckCircle2 size={48} color="#10B981" />
          </View>

          <Text style={styles.successTitle}>Payment Confirmed!</Text>
          <Text style={styles.successSubtitle}>
            Your payment has been verified and credited to your account.
          </Text>

          <View style={styles.successDetailsBox}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Amount Funded</Text>
              <Text style={styles.successAmountGreen}>
                +₦
                {verifiedPayment.amount.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>

            <View style={styles.successDivider} />

            <View style={styles.successRow}>
              <Text style={styles.successLabel}>New Wallet Balance</Text>
              <Text style={styles.successBalanceValue}>
                ₦
                {verifiedPayment.balance.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>

            <View style={styles.successDivider} />

            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Reference</Text>
              <Text style={styles.successRefText} numberOfLines={1} ellipsizeMode="middle">
                {verifiedPayment.reference}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.successDoneBtn}
            onPress={() => {
              router.replace("/(tabs)");
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.successDoneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // =========================================================================
  // VIEW 3: Standard Fund Wallet Form
  // =========================================================================
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* BrandLoader for payment checkout initialization */}
        <BrandLoader visible={isLoading} message="Initializing secure checkout..." />

        {/* BrandLoader for server verification */}
        <BrandLoader
          visible={isVerifying}
          message="Verifying payment with payment gateway... Please do not close this screen."
        />

        {/* Modal Grabber */}
        <View style={[styles.grabberWrap, { paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 8 : 14) }]}>
          <View style={styles.modalGrabber} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fund Wallet</Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Current Balance */}
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Current Available Balance</Text>
              <Text style={styles.balanceValue}>
                ₦
                {currentBalance.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>

            {/* Amount Input */}
            <View style={styles.inputCard}>
              <View style={styles.cardLabelRow}>
                <Text style={styles.cardLabel}>Enter Amount (NGN)</Text>
                <TouchableOpacity
                  onPress={Keyboard.dismiss}
                  style={styles.doneBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.amountInputRow}>
                <Text style={styles.nairaPrefix}>₦</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Preset Amounts */}
            <Text style={styles.presetHeading}>Quick Select</Text>
            <View style={styles.presetGrid}>
              {PRESET_AMOUNTS.map((val) => {
                const isSelected = amount === String(val);
                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                    onPress={() => {
                      setAmount(String(val));
                      Keyboard.dismiss();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        isSelected && styles.presetBtnTextActive,
                      ]}
                    >
                      ₦{val.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Security Info */}
            <View style={styles.securityBadge}>
              <ShieldCheck size={18} color={colors.success} style={{ marginRight: 8 }} />
              <Text style={styles.securityText}>
                Processed securely via KoraPay Gateway.
              </Text>
            </View>

            {/* Error Banner */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.payBtn, (isLoading || isVerifying) && styles.payBtnDisabled]}
              onPress={handleInitializeKoraPay}
              disabled={isLoading || isVerifying}
              activeOpacity={0.88}
            >
              <Text style={styles.payBtnText}>
                Proceed to Pay ₦{Number(amount || 0).toLocaleString()}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Custom Alert Modal */}
        <CustomAlertModal
          visible={alertModal.visible}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          confirmText={alertModal.confirmText}
          cancelText={alertModal.cancelText}
          onConfirm={alertModal.onConfirm}
          onCancel={alertModal.onCancel}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  webViewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  closeWebViewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: colors.surface,
  },
  modalGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceBorder,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  balanceBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  cardLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  doneBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(200, 45, 117, 0.12)",
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 8,
  },
  nairaPrefix: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primaryLight,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
  },
  presetHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  presetBtn: {
    width: "31%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  presetBtnActive: {
    borderColor: colors.primary,
    backgroundColor: "#C82D751A",
  },
  presetBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  presetBtnTextActive: {
    color: colors.primaryLight,
    fontWeight: "700",
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 20,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    textAlign: "center",
  },
  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  webLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },

  // Centered Success Screen Styles
  successScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  successDetailsBox: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 16,
    marginTop: 20,
    marginBottom: 24,
  },
  successRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  successDivider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: 10,
  },
  successLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  successAmountGreen: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10B981",
  },
  successBalanceValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  successRefText: {
    fontSize: 12,
    color: colors.textMuted,
    maxWidth: 160,
    textAlign: "right",
  },
  successDoneBtn: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
