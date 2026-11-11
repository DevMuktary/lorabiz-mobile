import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Clipboard,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck, X, CheckCircle2, Copy, Check, ArrowRight, Landmark } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { api } from "../../lib/api";
import { colors as defaultColors } from "../../constants/theme";
const colors = defaultColors;
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
  const { activate } = useLocalSearchParams<{ activate?: string }>();
  const insets = useSafeAreaInsets();
  const { user, wallet, updateWalletBalance, refreshWallet, refreshProfile } = useAuth();
  const { colors, isDark } = useTheme();

  const [amount, setAmount] = useState("5000");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Online Checkout WebView State
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isWebViewOpen, setIsWebViewOpen] = useState(false);

  // Verified Payment State (Strictly shown ONLY after backend server confirmation)
  const [verifiedPayment, setVerifiedPayment] = useState<VerifiedPayment | null>(null);

  // Dedicated Virtual Account State
  const didAutoActivateRef = useRef(false);
  const [virtualAccount, setVirtualAccount] = useState<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
  } | null>(null);
  const [isVaLoading, setIsVaLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [vaFullName, setVaFullName] = useState("");
  const [vaPhone, setVaPhone] = useState("");
  const [vaSubmitting, setVaSubmitting] = useState(false);
  const [vaError, setVaError] = useState<string | null>(null);

  const fetchVirtualAccount = useCallback(async () => {
    try {
      const res = await api.get("/api/user/virtual-account");
      if (res?.success && res.hasAccount && res.account) {
        setVirtualAccount(res.account);
      } else {
        setVirtualAccount(null);
        if (res?.userName) {
          setVaFullName((prev) => prev || res.userName);
        }
        const fallbackPhone = res?.userPhone || user?.phone || "";
        if (fallbackPhone) {
          setVaPhone((prev) => prev || fallbackPhone);
        }
      }
    } catch {
      // silent
    } finally {
      setIsVaLoading(false);
    }
  }, [user?.phone]);

  function handleCopyAccountNo() {
    if (!virtualAccount?.accountNumber) return;
    Clipboard.setString(virtualAccount.accountNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  async function handleActivateAccount(useModalFields = false) {
    Keyboard.dismiss();
    setVaError(null);

    let payload: Record<string, string> = {};
    if (useModalFields) {
      const cleanName = vaFullName.trim().replace(/\s+/g, " ");
      if (cleanName.split(" ").filter(Boolean).length < 2) {
        setVaError("Please enter your first and last name.");
        return;
      }

      const phoneDigits = vaPhone.trim().replace(/\D/g, "");
      if (!phoneDigits || phoneDigits.length < 10) {
        setVaError("Please enter a valid 11-digit Nigerian phone number.");
        return;
      }

      payload = {
        fullName: cleanName,
        phone: vaPhone.trim(),
      };
    }

    setVaSubmitting(true);
    try {
      const res = await api.post("/api/user/virtual-account", payload);

      if (res?.success && res.account) {
        setVirtualAccount(res.account);
        setIsActivateModalOpen(false);
        return;
      }

      if (res?.needsProfileFields) {
        setVaError(res?.message || null);
        setIsActivateModalOpen(true);
        return;
      }

      setVaError(res?.message || "Failed to generate account. Please try again.");
    } catch (err: any) {
      if (err?.data?.needsProfileFields) {
        setVaError(err?.data?.message || err?.message || null);
        setIsActivateModalOpen(true);
        return;
      }
      setVaError(err?.message || "Network error. Please try again.");
    } finally {
      setVaSubmitting(false);
    }
  }

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
      fetchVirtualAccount().catch(() => {});
    }, [refreshWallet, fetchVirtualAccount])
  );

  // Support direct activation deep-link from Home screen if profile confirmation is needed
  useEffect(() => {
    if (
      activate === "1" &&
      !isVaLoading &&
      !virtualAccount &&
      !didAutoActivateRef.current
    ) {
      didAutoActivateRef.current = true;
      handleActivateAccount(false);
    }
  }, [activate, isVaLoading, virtualAccount]);

  const currentBalance = wallet?.balance ?? user?.wallet?.balance ?? 0;

  async function handleInitializeCheckout() {
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
    if (!url || typeof url !== "string") return;

    const isExternalCheckoutPage =
      url.includes("checkout.paystack.com") ||
      url.includes("korapay.com") ||
      url.includes("checkout.");

    // Detect if the gateway is redirecting back to the app callback URL
    const isCancelled =
      url.includes("status=failed") ||
      url.includes("status=cancelled") ||
      url.includes("cancel=true") ||
      url.includes("cancelled=true");

    const isCompleted =
      !isExternalCheckoutPage &&
      !isCancelled &&
      (url.includes("funded=true") ||
        url.includes("/dashboard") ||
        url.includes("trxref=") ||
        url.includes("status=success") ||
        url.includes("success=true"));

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
        message: "Have you already completed the payment?",
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
  // VIEW 1: Online Checkout Inline WebView
  // =========================================================================
  if (isWebViewOpen && checkoutUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.webViewHeader, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
          <Text style={styles.webViewTitle}>Secure Checkout</Text>
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* BrandLoader for payment checkout initialization */}
        <BrandLoader visible={isLoading} message="Initializing secure checkout..." />

        {/* BrandLoader for server verification */}
        <BrandLoader
          visible={isVerifying}
          message="Verifying payment with payment gateway... Please do not close this screen."
        />

        {/* Modal Grabber */}
        <View style={[styles.grabberWrap, { paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 8 : 14), backgroundColor: colors.surface }]}>
          <View style={[styles.modalGrabber, { backgroundColor: colors.surfaceBorder }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceBorder }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : colors.surfaceBorder }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Fund Wallet</Text>
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
            <View style={[styles.balanceBox, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Current Available Balance</Text>
              <Text style={[styles.balanceValue, { color: colors.text }]}>
                ₦
                {currentBalance.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>

            {/* Dedicated Virtual Account */}
            {isVaLoading && !virtualAccount ? (
              <View style={[styles.vaInactiveCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                <ActivityIndicator size="small" color="#0B63CE" />
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>
                  Loading bank transfer account...
                </Text>
              </View>
            ) : virtualAccount ? (
              <View style={styles.vaCard}>
                <View style={styles.vaHeaderRow}>
                  <View style={[styles.vaBadge, { flexDirection: "row", alignItems: "center", gap: 5 }]}>
                    <Landmark size={12} color="#FFFFFF" />
                    <Text style={styles.vaBadgeText}>BANK TRANSFER</Text>
                  </View>
                  <Text style={styles.vaBankName}>{virtualAccount.bankName || "Dedicated Bank"}</Text>
                </View>

                <View style={styles.vaAccRow}>
                  <Text style={styles.vaAccNumber}>{virtualAccount.accountNumber}</Text>
                  <TouchableOpacity
                    style={[styles.copyBtn, isCopied && styles.copyBtnDone]}
                    onPress={handleCopyAccountNo}
                    activeOpacity={0.8}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} color="#FFFFFF" />
                        <Text style={styles.copyBtnText}>Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color="#FFFFFF" />
                        <Text style={styles.copyBtnText}>Copy</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.vaAccName}>
                  Account Name: <Text style={styles.vaAccNameBold}>{virtualAccount.accountName}</Text>
                </Text>

                <Text style={styles.vaHelpText}>
                  Transfer from any bank app to fund your wallet.
                </Text>
              </View>
            ) : (
              <View style={[styles.vaInactiveCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <View style={[styles.vaInactiveHeader, { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }]}>
                  <Landmark size={18} color={colors.primary} />
                  <Text style={[styles.vaInactiveTitle, { color: colors.text, marginBottom: 0 }]}>
                    Bank Transfer Account
                  </Text>
                </View>
                {vaError && !isActivateModalOpen ? (
                  <View style={styles.vaErrorBox}>
                    <Text style={styles.vaErrorText}>{vaError}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.vaActivateBtn, vaSubmitting && styles.btnDisabled]}
                  onPress={() => handleActivateAccount(false)}
                  disabled={vaSubmitting}
                  activeOpacity={0.8}
                >
                  {vaSubmitting ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.vaActivateBtnText}>Activating...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.vaActivateBtnText}>Activate Account</Text>
                      <ArrowRight size={15} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Section Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.surfaceBorder }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>OR PAY ONLINE</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.surfaceBorder }]} />
            </View>

            {/* Amount Input */}
            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <View style={styles.cardLabelRow}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Enter Amount (NGN)</Text>
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
                  style={[styles.amountInput, { color: colors.text }]}
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
            <Text style={[styles.presetHeading, { color: colors.text }]}>Quick Select</Text>
            <View style={styles.presetGrid}>
              {PRESET_AMOUNTS.map((val) => {
                const isSelected = amount === String(val);
                return (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : colors.surface,
                        borderColor: colors.surfaceBorder,
                      },
                      isSelected && styles.presetBtnActive,
                    ]}
                    onPress={() => {
                      setAmount(String(val));
                      Keyboard.dismiss();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        { color: colors.textSecondary },
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
            <View style={[styles.securityBadge, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <ShieldCheck size={18} color={colors.success} style={{ marginRight: 8 }} />
              <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                Processed securely via our payment gateway.
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
              onPress={handleInitializeCheckout}
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

        {/* Dedicated Account Activation Modal */}
        <Modal
          visible={isActivateModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!vaSubmitting) setIsActivateModalOpen(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalTitleWrap}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Landmark size={18} color={colors.primary} />
                    <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>Activate Dedicated Account</Text>
                  </View>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Confirm your name and phone number to generate your deposit account.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!vaSubmitting) setIsActivateModalOpen(false);
                  }}
                  style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceBorder }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {vaError && (
                <View style={styles.vaErrorBox}>
                  <Text style={styles.vaErrorText}>{vaError}</Text>
                </View>
              )}

              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  FULL NAME (FIRST & LAST NAME)
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    {
                      color: colors.text,
                      borderColor: colors.surfaceBorder,
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
                    },
                  ]}
                  value={vaFullName}
                  onChangeText={setVaFullName}
                  placeholder="First and Last Name"
                  placeholderTextColor={colors.textMuted}
                  editable={!vaSubmitting}
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  PHONE NUMBER
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    {
                      color: colors.text,
                      borderColor: colors.surfaceBorder,
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
                    },
                  ]}
                  value={vaPhone}
                  onChangeText={setVaPhone}
                  placeholder="e.g. 08012345678"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  editable={!vaSubmitting}
                />
              </View>

              <Text style={[styles.bvnNotice, { color: colors.textMuted }]}>
                Transfers to your dedicated bank account credit your wallet automatically.
              </Text>

              <TouchableOpacity
                style={[
                  styles.vaSubmitBtn,
                  (vaSubmitting ||
                    vaPhone.replace(/\D/g, "").length < 10 ||
                    vaFullName.trim().split(/\s+/).filter(Boolean).length < 2) &&
                    styles.btnDisabled,
                ]}
                onPress={() => handleActivateAccount(true)}
                disabled={
                  vaSubmitting ||
                  vaPhone.replace(/\D/g, "").length < 10 ||
                  vaFullName.trim().split(/\s+/).filter(Boolean).length < 2
                }
                activeOpacity={0.8}
              >
                {vaSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.vaSubmitBtnText}>Generate Account Number</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  // Dedicated Virtual Account Card Styles
  vaCard: {
    backgroundColor: "#09223B",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#09223B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  vaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  vaBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vaBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  vaBankName: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700",
  },
  vaAccRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  vaAccNumber: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnDone: {
    backgroundColor: "#10B981",
  },
  copyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  vaAccName: {
    color: "#E2E8F0",
    fontSize: 12,
    marginBottom: 4,
  },
  vaAccNameBold: {
    fontWeight: "800",
    color: "#FFFFFF",
  },
  vaHelpText: {
    color: "#BFDBFE",
    fontSize: 11,
    marginTop: 4,
  },
  vaInactiveCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    padding: 16,
    marginBottom: 16,
  },
  vaInactiveHeader: {
    marginBottom: 8,
  },
  vaInactiveTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  vaInactiveSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  vaActivateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#09223B",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  vaActivateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  vaErrorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  vaErrorText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "700",
  },
  bvnNotice: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 14,
  },
  vaSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#09223B",
    height: 46,
    borderRadius: 12,
  },
  vaSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
