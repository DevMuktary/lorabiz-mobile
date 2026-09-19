import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import {
  Eye,
  EyeOff,
  Check,
  ChevronDown,
  CheckCircle2,
  MapPin,
  Mail,
  User,
  Lock,
  Building2,
  AlertCircle,
  Edit3,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../constants/theme";
import { BASE_URL } from "../../lib/api";
import { getAuthToken } from "../../lib/storage";
import SearchablePickerModal from "../../components/SearchablePickerModal";
import {
  NIGERIAN_STATES,
  getLgasForState,
} from "../../constants/nigeria-states";

// Official Multi-Color Google G Icon
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </Svg>
  );
}

// Sleek Circular Back Chevron Icon matching ALAT
function ChevronLeftIcon({
  size = 20,
  color = "#0F172A",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, refreshProfile, completeSocialLogin } = useAuth();

  const params = useLocalSearchParams<{
    fromGoogle?: string;
    googleFirstName?: string;
    googleLastName?: string;
    googleEmail?: string;
  }>();

  // Social registration flag (Google sign-up)
  const [isSocialRegistration, setIsSocialRegistration] = useState(false);

  // Navigation mode: "gateway" (Choice screen) or "wizard" (4-stage form)
  const [viewMode, setViewMode] = useState<"gateway" | "wizard">("gateway");
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);

  // Handle incoming redirect from Google login screen
  useEffect(() => {
    if (params.fromGoogle === "true") {
      setIsSocialRegistration(true);
      if (params.googleFirstName) setFirstName(params.googleFirstName);
      if (params.googleLastName) setLastName(params.googleLastName);
      if (params.googleEmail) setEmail(params.googleEmail);
      setOtpStep("verified");
      setViewMode("wizard");
      setStage(1);
    }
  }, [params.fromGoogle, params.googleFirstName, params.googleLastName, params.googleEmail]);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");

  // Email & OTP State
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "verified">("idle");
  const [otpTimer, setOtpTimer] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Phone & WhatsApp & Password State
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Address & Referral State
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNo, setBuildingNo] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Pickers Modal State
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [lgaPickerVisible, setLgaPickerVisible] = useState(false);

  // Referral Live Validation
  const [referralValidation, setReferralValidation] = useState<{
    status: "idle" | "validating" | "valid" | "invalid";
    referrerName?: string;
    message?: string;
  }>({ status: "idle" });

  // General Loading & Error State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Input Focus Tracking
  const [activeInput, setActiveInput] = useState<string | null>(null);

  // Auto-sync WhatsApp when "sameAsPhone" is active
  useEffect(() => {
    if (sameAsPhone) {
      setWhatsapp(phone);
    }
  }, [phone, sameAsPhone]);

  // OTP Countdown Timer
  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (otpTimer > 0 && otpStep === "sent") {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpTimer, otpStep]);

  // Debounced Referral Code Validation
  const validateReferral = useCallback(async (code: string) => {
    const clean = code.trim();
    if (!clean) {
      setReferralValidation({ status: "idle" });
      return;
    }
    setReferralValidation({ status: "validating" });
    try {
      const res = await fetch(
        `${BASE_URL}/api/auth/validate-referral?code=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (data.valid) {
        setReferralValidation({
          status: "valid",
          referrerName: data.referrerName,
        });
      } else {
        setReferralValidation({
          status: "invalid",
          message: data.message || "Referral code not found",
        });
      }
    } catch {
      setReferralValidation({ status: "idle" });
    }
  }, []);

  useEffect(() => {
    if (!referralCode) {
      setReferralValidation({ status: "idle" });
      return;
    }
    const timer = setTimeout(() => {
      validateReferral(referralCode);
    }, 450);
    return () => clearTimeout(timer);
  }, [referralCode, validateReferral]);

  // Google OAuth Deep Link Listener
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (
        event.url.includes("google-success") ||
        event.url.includes("auth/callback")
      ) {
        try {
          WebBrowser.dismissAuthSession();
        } catch {}
        try {
          WebBrowser.dismissBrowser();
        } catch {}
        setIsLoading(true);
        try {
          let token = "";
          try {
            const parsed = new URL(event.url);
            token = parsed.searchParams.get("token") || "";
          } catch {
            const match = event.url.match(/token=([^&]+)/);
            if (match) token = decodeURIComponent(match[1]);
          }

          const loggedInUser = await completeSocialLogin(token);
          if (loggedInUser) {
            if (loggedInUser.isProfileComplete) {
              router.replace("/(tabs)");
            } else {
              setIsSocialRegistration(true);
              if (loggedInUser.firstName) setFirstName(loggedInUser.firstName);
              if (loggedInUser.lastName) setLastName(loggedInUser.lastName);
              if (loggedInUser.email) setEmail(loggedInUser.email);
              setOtpStep("verified");
              setViewMode("wizard");
              setStage(1);
            }
          }
        } catch (e) {
          console.error("Deep link session sync error:", e);
        } finally {
          setIsLoading(false);
        }
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, []);

  // Password Strength Calculator
  const getPasswordStrength = () => {
    let score = 0;
    if (!password) return score;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };
  const passScore = getPasswordStrength();

  // Available LGAs for currently chosen state
  const availableLgas = state ? getLgasForState(state) : [];

  // Navigation Back Action
  function handleBack() {
    setErrorMsg(null);
    if (viewMode === "wizard") {
      if (stage === 1) {
        setViewMode("gateway");
      } else if (stage === 3 && isSocialRegistration) {
        // For Google registration, going back from contact info returns to name/gender (stage 1)
        setStage(1);
      } else {
        setStage((prev) => (prev - 1) as 1 | 2 | 3);
      }
    } else {
      router.replace("/(auth)/welcome");
    }
  }

  // Google OAuth Trigger
  async function handleGoogleSignUp() {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const authUrl = `${BASE_URL}/auth/mobile-google`;
      const redirectUrl = "lorabiz://auth/google-success";

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
        { preferEphemeralSession: false }
      );

      // User cancelled or dismissed the in-app browser
      if (result.type === "cancel" || result.type === "dismiss") {
        setIsLoading(false);
        return;
      }

      if (result.type === "success") {
        let sessionToken = "";
        if (result.url) {
          try {
            const parsed = new URL(result.url);
            sessionToken = parsed.searchParams.get("token") || "";
          } catch {
            const match = result.url.match(/token=([^&]+)/);
            if (match) sessionToken = decodeURIComponent(match[1]);
          }
        }

        const loggedInUser = await completeSocialLogin(sessionToken);
        if (loggedInUser) {
          if (loggedInUser.isProfileComplete) {
            // Already complete profile: go directly to dashboard
            router.replace("/(tabs)");
          } else {
            // Profile incomplete: populate Google details and open registration wizard
            setIsSocialRegistration(true);
            if (loggedInUser.firstName) setFirstName(loggedInUser.firstName);
            if (loggedInUser.lastName) setLastName(loggedInUser.lastName);
            if (loggedInUser.email) setEmail(loggedInUser.email);
            setOtpStep("verified");
            setViewMode("wizard");
            setStage(1);
          }
        } else {
          setErrorMsg("Could not verify Google session. Please try again.");
        }
      }
    } catch (err: any) {
      console.error("Google sign up error:", err);
      setErrorMsg("Google sign up could not be opened. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Stage 1 Validation: Personal Name & Gender
  function handleStage1Continue() {
    setErrorMsg(null);
    if (!firstName.trim()) {
      setErrorMsg("Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      setErrorMsg("Please enter your last name.");
      return;
    }
    // If social registration, email is already verified by Google, so skip Stage 2 (Email OTP) and go directly to Stage 3!
    if (isSocialRegistration) {
      setStage(3);
    } else {
      setStage(2);
    }
  }

  // Stage 2: Send OTP
  async function handleSendOTP() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setErrorMsg(null);
    setIsSendingOtp(true);

    try {
      const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        setOtpStep("sent");
        setOtpTimer(60);
      } else {
        setErrorMsg(data.message || "Failed to send verification code.");
      }
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  }

  // Stage 2: Verify OTP
  async function handleVerifyOTP() {
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit code.");
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otpCode: cleanCode }),
      });

      const data = await res.json();
      if (res.ok) {
        setOtpStep("verified");
        setErrorMsg(null);
        setStage(3);
      } else {
        setErrorMsg(data.message || "Invalid or expired verification code.");
      }
    } catch {
      setErrorMsg("Verification failed. Please check your internet connection.");
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  // Stage 2: Edit Email (Allows fixing typos without lockout!)
  function handleEditEmail() {
    setOtpStep("idle");
    setOtpCode("");
    setErrorMsg(null);
  }

  // Stage 3 Validation: Phone, WhatsApp, Password
  function handleStage3Continue() {
    setErrorMsg(null);
    const cleanPhone = phone.trim();
    const cleanWhatsapp = (sameAsPhone ? phone : whatsapp).trim();

    if (!cleanPhone) {
      setErrorMsg("Please enter your phone number.");
      return;
    }

    // Nigerian Phone Validation: 10 or 11 digits
    const digitsOnlyPhone = cleanPhone.replace(/\D/g, "");
    if (
      (digitsOnlyPhone.startsWith("0") && digitsOnlyPhone.length !== 11) ||
      (!digitsOnlyPhone.startsWith("0") && digitsOnlyPhone.length !== 10)
    ) {
      setErrorMsg("Please enter a valid 10 or 11-digit Nigerian phone number.");
      return;
    }

    if (!cleanWhatsapp) {
      setErrorMsg("Please provide your WhatsApp number.");
      return;
    }

    // Passwords are only required for manual email registrations
    if (!isSocialRegistration) {
      if (passScore < 3) {
        setErrorMsg("Password is too weak. Must contain uppercase, numbers or symbols.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
    }

    setStage(4);
  }

  // Stage 4: Submit Final Registration
  async function handleFinalSubmit() {
    setErrorMsg(null);

    if (!state.trim()) {
      setErrorMsg("Please select your State.");
      return;
    }
    if (!lga.trim()) {
      setErrorMsg("Please select your Local Government Area (LGA).");
      return;
    }
    if (!street.trim()) {
      setErrorMsg("Please enter your street address.");
      return;
    }
    if (!termsAccepted) {
      setErrorMsg("You must accept the Terms and Conditions to create an account.");
      return;
    }

    setIsLoading(true);

    try {
      if (isSocialRegistration) {
        // Complete registration for Google authenticated user
        const token = await getAuthToken();
        const res = await fetch(`${BASE_URL}/api/auth/complete-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                  Cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            middleName: middleName.trim() || undefined,
            lastName: lastName.trim(),
            phone: phone.trim(),
            whatsapp: (sameAsPhone ? phone : whatsapp).trim(),
            gender: gender.toUpperCase(),
            state: state.trim(),
            lga: lga.trim(),
            street: street.trim(),
            buildingNo: buildingNo.trim() || undefined,
            referralCode: referralCode.trim() || undefined,
            termsAccepted: true,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success !== false) {
          setSuccessMsg("Profile completed successfully! Welcome to LoraBiz.");
          await refreshProfile();
          setTimeout(() => {
            router.replace("/(tabs)");
          }, 800);
        } else {
          setErrorMsg(data.message || "Failed to complete registration. Please verify details.");
        }
      } else {
        // Standard Email Registration
        if (otpStep !== "verified" || !otpCode) {
          setErrorMsg("Email verification is required before creating account.");
          setIsLoading(false);
          return;
        }

        const payload = {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          gender: gender.toUpperCase(),
          email: email.trim(),
          phone: phone.trim(),
          whatsapp: (sameAsPhone ? phone : whatsapp).trim(),
          password,
          state: state.trim(),
          lga: lga.trim(),
          street: street.trim(),
          buildingNo: buildingNo.trim() || undefined,
          referralCode: referralCode.trim() || undefined,
          otpCode: otpCode.trim(),
        };

        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok) {
          setSuccessMsg("Account created successfully! Signing you in...");
          try {
            const loginRes = await login(email.trim(), password);
            if (loginRes.success) {
              router.replace("/(tabs)");
              return;
            }
          } catch {}
          setTimeout(() => {
            router.replace("/(auth)/login");
          }, 1500);
        } else {
          setErrorMsg(data.message || "Failed to create account. Please verify details.");
        }
      }
    } catch {
      setErrorMsg("Network error during registration. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Safe area top padding
  const topSafePadding = Math.max(insets.top, 44) + 6;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? undefined : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Subtle Angled Background Brand Watermark */}
      <View style={styles.watermarkContainer} pointerEvents="none">
        <Image
          source={require("../../assets/logo-pink.png")}
          style={styles.watermarkImage}
          resizeMode="contain"
        />
      </View>

      {/* Top Bar: Left Circular Back Button + Right Top Orb */}
      <View style={[styles.topBar, { top: topSafePadding }]}>
        <TouchableOpacity
          style={styles.circularBackButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ChevronLeftIcon size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.topRightOrb}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.topRightOrbImage}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Scrollable Form Area */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: topSafePadding + 62,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        {/* ==================================================== */}
        {/* VIEW A: GATEWAY CHOICE SCREEN                         */}
        {/* ==================================================== */}
        {viewMode === "gateway" ? (
          <View style={styles.contentWrapper}>
            <View style={styles.gatewayHero}>
              <Text style={styles.gatewayTitle}>Create an Account</Text>
              <Text style={styles.gatewaySubtitle}>
                Choose how you would like to get started.
              </Text>
            </View>

            {/* Error Message if any */}
            {errorMsg ? (
              <View style={styles.errorInline}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Primary Action 1: Continue with Google */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignUp}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider: "or" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Primary Action 2: Sign up with Email */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setErrorMsg(null);
                setViewMode("wizard");
                setStage(1);
              }}
              activeOpacity={0.88}
            >
              <Mail size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>Sign up with Email</Text>
            </TouchableOpacity>

            {/* Footer: Already have an account? Sign in */}
            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={styles.footerLinkPink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ==================================================== */
          /* VIEW B: 4-STAGE STEPPED REGISTRATION WIZARD           */
          /* ==================================================== */
          <View style={styles.contentWrapper}>
            {/* Minimal Visual Progress Line (No Step Text Labels!) */}
            <View style={styles.progressTrack}>
              {isSocialRegistration ? (
                <>
                  <View
                    style={[
                      styles.progressSegment,
                      stage >= 1 && styles.progressSegmentActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressSegment,
                      stage >= 3 && styles.progressSegmentActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressSegment,
                      stage >= 4 && styles.progressSegmentActive,
                    ]}
                  />
                </>
              ) : (
                <>
                  <View
                    style={[
                      styles.progressSegment,
                      stage >= 1 && styles.progressSegmentActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressSegment,
                      stage >= 2 && styles.progressSegmentActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressSegment,
                      stage >= 3 && styles.progressSegmentActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressSegment,
                      stage >= 4 && styles.progressSegmentActive,
                    ]}
                  />
                </>
              )}
            </View>

            {/* Feedback Notifications */}
            {errorMsg ? (
              <View style={styles.errorInline}>
                <AlertCircle size={16} color="#B91C1C" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successInline}>
                <CheckCircle2 size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* ---------------------------------------------------- */}
            {/* STAGE 1: PERSONAL IDENTITY                          */}
            {/* ---------------------------------------------------- */}
            {stage === 1 && (
              <View style={styles.stageSection}>
                {/* Verified Google Account Badge */}
                {isSocialRegistration && (
                  <View style={styles.socialVerifiedCard}>
                    <View style={styles.socialVerifiedBadgeIcon}>
                      <GoogleIcon size={18} />
                    </View>
                    <View style={styles.socialVerifiedContent}>
                      <Text style={styles.socialVerifiedTitle}>Google Account Verified</Text>
                      <Text style={styles.socialVerifiedEmail} numberOfLines={1}>{email}</Text>
                    </View>
                    <CheckCircle2 size={18} color="#059669" />
                  </View>
                )}

                <View style={styles.stageHeader}>
                  <Text style={styles.stageTitle}>What is your name?</Text>
                  <Text style={styles.stageSubtitle}>
                    {isSocialRegistration
                      ? "Confirm your legal name and gender to continue."
                      : "Enter your legal name as on official documents."}
                  </Text>
                </View>

                {/* First Name */}
                <Text style={styles.fieldLabel}>First Name</Text>
                <Pressable
                  style={[
                    styles.alatInputCard,
                    activeInput === "firstName" && styles.alatInputCardActive,
                  ]}
                >
                  <User size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.alatTextInput}
                    placeholder="e.g. John"
                    placeholderTextColor="#94A3B8"
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onFocus={() => setActiveInput("firstName")}
                    onBlur={() => setActiveInput(null)}
                    autoCapitalize="words"
                  />
                </Pressable>

                {/* Middle Name (Optional) */}
                <Text style={styles.fieldLabel}>
                  Middle Name <Text style={styles.optionalText}>(Optional)</Text>
                </Text>
                <Pressable
                  style={[
                    styles.alatInputCard,
                    activeInput === "middleName" && styles.alatInputCardActive,
                  ]}
                >
                  <TextInput
                    style={styles.alatTextInput}
                    placeholder="e.g. David"
                    placeholderTextColor="#94A3B8"
                    value={middleName}
                    onChangeText={(text) => {
                      setMiddleName(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onFocus={() => setActiveInput("middleName")}
                    onBlur={() => setActiveInput(null)}
                    autoCapitalize="words"
                  />
                </Pressable>

                {/* Last Name */}
                <Text style={styles.fieldLabel}>Last Name / Surname</Text>
                <Pressable
                  style={[
                    styles.alatInputCard,
                    activeInput === "lastName" && styles.alatInputCardActive,
                  ]}
                >
                  <User size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.alatTextInput}
                    placeholder="e.g. Doe"
                    placeholderTextColor="#94A3B8"
                    value={lastName}
                    onChangeText={(text) => {
                      setLastName(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onFocus={() => setActiveInput("lastName")}
                    onBlur={() => setActiveInput(null)}
                    autoCapitalize="words"
                  />
                </Pressable>

                {/* Gender Pill Selector */}
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {(["MALE", "FEMALE", "OTHER"] as const).map((opt) => {
                    const isSelected = gender === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.genderPill,
                          isSelected && styles.genderPillSelected,
                        ]}
                        onPress={() => setGender(opt)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.genderPillText,
                            isSelected && styles.genderPillTextSelected,
                          ]}
                        >
                          {opt.charAt(0) + opt.slice(1).toLowerCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Continue CTA */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!firstName.trim() || !lastName.trim()) && styles.btnDisabled,
                  ]}
                  onPress={handleStage1Continue}
                  disabled={!firstName.trim() || !lastName.trim()}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ---------------------------------------------------- */}
            {/* STAGE 2: EMAIL & OTP VERIFICATION                    */}
            {/* ---------------------------------------------------- */}
            {stage === 2 && (
              <View style={styles.stageSection}>
                <View style={styles.stageHeader}>
                  <Text style={styles.stageTitle}>Verify your email</Text>
                  <Text style={styles.stageSubtitle}>
                    {otpStep === "idle"
                      ? "We will send a 6-digit code to verify your email."
                      : `Enter the code sent to your email address.`}
                  </Text>
                </View>

                {otpStep === "idle" ? (
                  <>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <Pressable
                      style={[
                        styles.alatInputCard,
                        activeInput === "email" && styles.alatInputCardActive,
                      ]}
                    >
                      <Mail size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                      <TextInput
                        style={styles.alatTextInput}
                        placeholder="name@example.com"
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setActiveInput("email")}
                        onBlur={() => setActiveInput(null)}
                      />
                    </Pressable>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        (!email.trim() || isSendingOtp) && styles.btnDisabled,
                      ]}
                      onPress={handleSendOTP}
                      disabled={!email.trim() || isSendingOtp}
                      activeOpacity={0.88}
                    >
                      {isSendingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Send Verification Code
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : otpStep === "sent" ? (
                  <>
                    {/* Editable Email Pill to Fix Typos (Solves Web Bug!) */}
                    <View style={styles.editableEmailCard}>
                      <View style={styles.emailPillInfo}>
                        <Mail size={16} color={colors.primary} />
                        <Text style={styles.emailPillText} numberOfLines={1}>
                          {email}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.editPencilBtn}
                        onPress={handleEditEmail}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Edit3 size={15} color="#475569" />
                        <Text style={styles.editPencilText}>Change</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 6-Digit OTP Code Input */}
                    <Text style={styles.fieldLabel}>6-Digit Code</Text>
                    <View style={styles.otpInputCard}>
                      <TextInput
                        style={styles.otpTextInput}
                        placeholder="••••••"
                        placeholderTextColor="#94A3B8"
                        value={otpCode}
                        onChangeText={(text) => {
                          const clean = text.replace(/\D/g, "").slice(0, 6);
                          setOtpCode(clean);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />
                    </View>

                    {/* Resend Code Option */}
                    <View style={styles.resendRow}>
                      {otpTimer > 0 ? (
                        <Text style={styles.timerText}>
                          Resend code in{" "}
                          <Text style={styles.timerBold}>{otpTimer}s</Text>
                        </Text>
                      ) : (
                        <TouchableOpacity
                          onPress={handleSendOTP}
                          disabled={isSendingOtp}
                        >
                          <Text style={styles.resendLink}>Resend Code</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        (otpCode.length !== 6 || isVerifyingOtp) &&
                          styles.btnDisabled,
                      ]}
                      onPress={handleVerifyOTP}
                      disabled={otpCode.length !== 6 || isVerifyingOtp}
                      activeOpacity={0.88}
                    >
                      {isVerifyingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Verify Code
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  /* Verified State */
                  <View style={styles.verifiedBox}>
                    <CheckCircle2 size={42} color="#059669" />
                    <Text style={styles.verifiedTitle}>Email Verified</Text>
                    <Text style={styles.verifiedSub}>{email}</Text>

                    <TouchableOpacity
                      style={[styles.primaryButton, { width: "100%", marginTop: 24 }]}
                      onPress={() => setStage(3)}
                    >
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ marginTop: 14 }}
                      onPress={handleEditEmail}
                    >
                      <Text style={styles.editPencilText}>
                        Change email address
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ---------------------------------------------------- */}
            {/* STAGE 3: SECURITY & PHONE CONTACT                    */}
            {/* ---------------------------------------------------- */}
            {stage === 3 && (
              <View style={styles.stageSection}>
                <View style={styles.stageHeader}>
                  <Text style={styles.stageTitle}>
                    {isSocialRegistration ? "Contact Information" : "Contact & Security"}
                  </Text>
                  <Text style={styles.stageSubtitle}>
                    {isSocialRegistration
                      ? "Enter your phone number so we can reach you for account updates."
                      : "For account updates and customer support."}
                  </Text>
                </View>

                {/* Phone Number Input */}
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <Pressable
                  style={[
                    styles.alatInputCard,
                    activeInput === "phone" && styles.alatInputCardActive,
                  ]}
                >
                  <View style={styles.countryBadge}>
                    <Text style={styles.flagEmoji}>🇳🇬</Text>
                    <Text style={styles.countryCodeText}>+234</Text>
                  </View>
                  <TextInput
                    style={styles.alatTextInput}
                    placeholder="08012345678"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    keyboardType="phone-pad"
                    onFocus={() => setActiveInput("phone")}
                    onBlur={() => setActiveInput(null)}
                  />
                </Pressable>
                <Text style={styles.phoneHelperText}>
                  Please enter an active phone number so our team can reach you if needed.
                </Text>

                {/* WhatsApp Number & Toggle */}
                <View style={styles.whatsappHeaderRow}>
                  <Text style={styles.fieldLabel}>WhatsApp Number</Text>
                  <TouchableOpacity
                    style={styles.sameAsRow}
                    onPress={() => setSameAsPhone(!sameAsPhone)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.miniCheckbox,
                        sameAsPhone && styles.miniCheckboxActive,
                      ]}
                    >
                      {sameAsPhone && <Check size={12} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.sameAsText}>Same as phone</Text>
                  </TouchableOpacity>
                </View>

                {!sameAsPhone && (
                  <Pressable
                    style={[
                      styles.alatInputCard,
                      activeInput === "whatsapp" && styles.alatInputCardActive,
                    ]}
                  >
                    <View style={styles.countryBadge}>
                      <Text style={styles.flagEmoji}>🇳🇬</Text>
                      <Text style={styles.countryCodeText}>+234</Text>
                    </View>
                    <TextInput
                      style={styles.alatTextInput}
                      placeholder="08012345678"
                      placeholderTextColor="#94A3B8"
                      value={whatsapp}
                      onChangeText={(text) => {
                        setWhatsapp(text);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      keyboardType="phone-pad"
                      onFocus={() => setActiveInput("whatsapp")}
                      onBlur={() => setActiveInput(null)}
                    />
                  </Pressable>
                )}

                {isSocialRegistration ? (
                  <View style={styles.socialPasswordBypassCard}>
                    <CheckCircle2 size={18} color="#059669" style={{ marginRight: 8 }} />
                    <Text style={styles.socialPasswordBypassText}>
                      Signed in with Google. No password is required.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Password Input */}
                    <Text style={styles.fieldLabel}>Create Password</Text>
                    <Pressable
                      style={[
                        styles.alatInputCard,
                        activeInput === "password" && styles.alatInputCardActive,
                      ]}
                    >
                      <Lock size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                      <TextInput
                        style={styles.alatTextInput}
                        placeholder="Minimum 8 characters"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        secureTextEntry={!showPassword}
                        onFocus={() => setActiveInput("password")}
                        onBlur={() => setActiveInput(null)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeBtn}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#64748B" />
                        ) : (
                          <Eye size={18} color="#64748B" />
                        )}
                      </TouchableOpacity>
                    </Pressable>

                    {/* Password Strength Meter (4 Segments) */}
                    {password.length > 0 && (
                      <View style={styles.strengthContainer}>
                        <View style={styles.strengthTrack}>
                          <View
                            style={[
                              styles.strengthSegment,
                              passScore >= 1 && styles.segmentWeak,
                            ]}
                          />
                          <View
                            style={[
                              styles.strengthSegment,
                              passScore >= 2 && styles.segmentFair,
                            ]}
                          />
                          <View
                            style={[
                              styles.strengthSegment,
                              passScore >= 3 && styles.segmentGood,
                            ]}
                          />
                          <View
                            style={[
                              styles.strengthSegment,
                              passScore >= 4 && styles.segmentStrong,
                            ]}
                          />
                        </View>
                        <Text style={styles.strengthLabel}>
                          {passScore <= 1
                            ? "Weak"
                            : passScore === 2
                            ? "Fair"
                            : passScore === 3
                            ? "Good"
                            : "Strong"}
                        </Text>
                      </View>
                    )}

                    {/* Confirm Password */}
                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <Pressable
                      style={[
                        styles.alatInputCard,
                        activeInput === "confirmPassword" && styles.alatInputCardActive,
                      ]}
                    >
                      <Lock size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                      <TextInput
                        style={styles.alatTextInput}
                        placeholder="Re-enter password"
                        placeholderTextColor="#94A3B8"
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        secureTextEntry={!showConfirmPassword}
                        onFocus={() => setActiveInput("confirmPassword")}
                        onBlur={() => setActiveInput(null)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeBtn}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} color="#64748B" />
                        ) : (
                          <Eye size={18} color="#64748B" />
                        )}
                      </TouchableOpacity>
                    </Pressable>

                    {/* Inline Confirm Password Feedback Text */}
                    {confirmPassword.length > 0 && (
                      <Text
                        style={[
                          styles.confirmMatchText,
                          password === confirmPassword
                            ? styles.matchSuccess
                            : styles.matchError,
                        ]}
                      >
                        {password === confirmPassword
                          ? "✓ Passwords match"
                          : "Passwords do not match"}
                      </Text>
                    )}
                  </>
                )}

                {/* Continue Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!phone.trim() || (!isSocialRegistration && (!password || passScore < 3 || password !== confirmPassword))) &&
                      styles.btnDisabled,
                  ]}
                  onPress={handleStage3Continue}
                  disabled={!phone.trim() || (!isSocialRegistration && (!password || passScore < 3 || password !== confirmPassword))}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ---------------------------------------------------- */}
            {/* STAGE 4: LOCATION & REFERRAL                         */}
            {/* ---------------------------------------------------- */}
            {stage === 4 && (
              <View style={styles.stageSection}>
                <View style={styles.stageHeader}>
                  <Text style={styles.stageTitle}>Address & Final Setup</Text>
                  <Text style={styles.stageSubtitle}>
                    Enter your location to complete registration.
                  </Text>
                </View>

                {/* State Picker Trigger */}
                <Text style={styles.fieldLabel}>State of Residence</Text>
                <TouchableOpacity
                  style={styles.pickerTriggerCard}
                  onPress={() => setStatePickerVisible(true)}
                  activeOpacity={0.75}
                >
                  <MapPin size={18} color={state ? colors.primary : "#94A3B8"} />
                  <Text
                    style={[
                      styles.pickerTriggerText,
                      state && styles.pickerTriggerTextActive,
                    ]}
                  >
                    {state || "Select Nigerian State..."}
                  </Text>
                  <ChevronDown size={18} color="#64748B" />
                </TouchableOpacity>

                {/* LGA Picker Trigger */}
                <Text style={styles.fieldLabel}>Local Government Area (LGA)</Text>
                <TouchableOpacity
                  style={[
                    styles.pickerTriggerCard,
                    !state && styles.pickerTriggerDisabled,
                  ]}
                  onPress={() => {
                    if (!state) {
                      setErrorMsg("Please select your State first.");
                      return;
                    }
                    setLgaPickerVisible(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Building2 size={18} color={lga ? colors.primary : "#94A3B8"} />
                  <Text
                    style={[
                      styles.pickerTriggerText,
                      lga && styles.pickerTriggerTextActive,
                    ]}
                  >
                    {lga || (state ? "Select LGA..." : "Choose state first")}
                  </Text>
                  <ChevronDown size={18} color="#64748B" />
                </TouchableOpacity>

                {/* Street Address (Required by backend validation) */}
                <Text style={styles.fieldLabel}>Street Address</Text>
                <Pressable
                  style={[
                    styles.alatInputCard,
                    activeInput === "street" && styles.alatInputCardActive,
                  ]}
                >
                  <TextInput
                    style={styles.alatTextInput}
                    placeholder="e.g. 14 Marina Street, Marina"
                    placeholderTextColor="#94A3B8"
                    value={street}
                    onChangeText={(text) => {
                      setStreet(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onFocus={() => setActiveInput("street")}
                    onBlur={() => setActiveInput(null)}
                  />
                </Pressable>

                {/* Building / Flat No (Optional) */}
                <Text style={styles.fieldLabel}>
                  Building / Suite No <Text style={styles.optionalText}>(Optional)</Text>
                </Text>
                <Pressable
                  style={[
                    styles.alatInputCard,
                    activeInput === "buildingNo" && styles.alatInputCardActive,
                  ]}
                >
                  <TextInput
                    style={styles.alatTextInput}
                    placeholder="e.g. Suite 4B or Flat 2"
                    placeholderTextColor="#94A3B8"
                    value={buildingNo}
                    onChangeText={(text) => {
                      setBuildingNo(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onFocus={() => setActiveInput("buildingNo")}
                    onBlur={() => setActiveInput(null)}
                  />
                </Pressable>

                {/* Referral Code (Optional with Real-time Validation) */}
                <Text style={styles.fieldLabel}>
                  Referral Code <Text style={styles.optionalText}>(Optional)</Text>
                </Text>
                <Pressable
                  style={[
                    styles.alatInputCard,
                    activeInput === "referralCode" && styles.alatInputCardActive,
                  ]}
                >
                  <TextInput
                    style={styles.alatTextInput}
                    placeholder="e.g. LORA-12345"
                    placeholderTextColor="#94A3B8"
                    value={referralCode}
                    onChangeText={(text) => {
                      setReferralCode(text.toUpperCase());
                      if (errorMsg) setErrorMsg(null);
                    }}
                    autoCapitalize="characters"
                    onFocus={() => setActiveInput("referralCode")}
                    onBlur={() => setActiveInput(null)}
                  />
                  {referralValidation.status === "validating" && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                  {referralValidation.status === "valid" && (
                    <CheckCircle2 size={18} color="#059669" />
                  )}
                </Pressable>

                {/* Referral Sponsor Pill */}
                {referralValidation.status === "valid" && (
                  <View style={styles.sponsorPill}>
                    <Text style={styles.sponsorText}>
                      ✓ Referred by{" "}
                      <Text style={styles.sponsorName}>
                        {referralValidation.referrerName}
                      </Text>
                    </Text>
                  </View>
                )}

                {referralValidation.status === "invalid" && (
                  <Text style={styles.referralInvalidText}>
                    {referralValidation.message || "Referral code not found"}
                  </Text>
                )}

                {/* Terms and Conditions Checkbox */}
                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.termsCheckbox,
                      termsAccepted && styles.termsCheckboxActive,
                    ]}
                  >
                    {termsAccepted && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the{" "}
                    <Text
                      style={styles.termsLink}
                      onPress={() => Linking.openURL(`${BASE_URL}/terms`)}
                    >
                      Terms of Service
                    </Text>{" "}
                    and{" "}
                    <Text
                      style={styles.termsLink}
                      onPress={() => Linking.openURL(`${BASE_URL}/privacy`)}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>

                {/* Submit Account Creation Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!state || !lga || !street.trim() || !termsAccepted || isLoading) &&
                      styles.btnDisabled,
                  ]}
                  onPress={handleFinalSubmit}
                  disabled={
                    !state || !lga || !street.trim() || !termsAccepted || isLoading
                  }
                  activeOpacity={0.88}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isSocialRegistration ? "Complete Registration" : "Create Account"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Footer Back Link to Login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={styles.footerLinkPink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* State Searchable Picker Modal */}
      <SearchablePickerModal
        visible={statePickerVisible}
        title="Select State"
        searchPlaceholder="Search Nigerian states..."
        items={NIGERIAN_STATES}
        selectedValue={state}
        onSelect={(selectedState) => {
          setState(selectedState);
          setLga("");
          if (errorMsg) setErrorMsg(null);
        }}
        onClose={() => setStatePickerVisible(false)}
      />

      {/* LGA Searchable Picker Modal */}
      <SearchablePickerModal
        visible={lgaPickerVisible}
        title={`Select LGA (${state || "State"})`}
        searchPlaceholder="Search Local Government Area..."
        items={availableLgas}
        selectedValue={lga}
        onSelect={(selectedLga) => {
          setLga(selectedLga);
          if (errorMsg) setErrorMsg(null);
        }}
        onClose={() => setLgaPickerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  watermarkContainer: {
    position: "absolute",
    right: -80,
    top: "26%",
    width: 380,
    height: 380,
    opacity: 0.038,
    transform: [{ rotate: "-15deg" }],
  },
  watermarkImage: {
    width: "100%",
    height: "100%",
  },
  topBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  circularBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  topRightOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(200, 45, 117, 0.18)",
    backgroundColor: "#F8FAFC",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  topRightOrbImage: {
    width: "100%",
    height: "100%",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  contentWrapper: {
    width: "100%",
  },

  // ----------------------------------------------------
  // Gateway Choice Screen Styles (Clean, no badges)
  // ----------------------------------------------------
  gatewayHero: {
    marginBottom: 26,
    alignItems: "flex-start",
  },
  gatewayTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  gatewaySubtitle: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "400",
  },

  // ----------------------------------------------------
  // Minimal Progress Line (No Step Text Labels!)
  // ----------------------------------------------------
  progressTrack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
    height: 4,
    width: "100%",
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 3,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },

  // ----------------------------------------------------
  // Stage Content Styles
  // ----------------------------------------------------
  stageSection: {
    width: "100%",
  },
  stageHeader: {
    marginBottom: 20,
  },
  stageTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  stageSubtitle: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },

  // ----------------------------------------------------
  // Common Form Fields
  // ----------------------------------------------------
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 7,
    marginTop: 6,
  },
  optionalText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#94A3B8",
  },
  alatInputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  alatInputCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
  },
  alatTextInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "500",
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
  },

  // Phone Helper Text
  phoneHelperText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: -8,
    marginBottom: 14,
    lineHeight: 16,
  },

  // Confirm Password Match Text
  confirmMatchText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: -8,
    marginBottom: 14,
    marginLeft: 4,
  },
  matchSuccess: {
    color: "#059669",
  },
  matchError: {
    color: "#DC2626",
  },

  // Gender Pills
  genderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    marginTop: 2,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "#F4F5F7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  genderPillSelected: {
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    borderColor: colors.primary,
  },
  genderPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  genderPillTextSelected: {
    color: colors.primary,
    fontWeight: "800",
  },

  // Editable Email Pill (Allows fixing typos)
  editableEmailCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  emailPillInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  emailPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginLeft: 10,
  },
  editPencilBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  editPencilText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginLeft: 4,
  },

  // OTP Input
  otpInputCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(200, 45, 117, 0.3)",
    paddingVertical: 10,
    marginBottom: 14,
  },
  otpTextInput: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 14,
    color: colors.primary,
    textAlign: "center",
    width: "100%",
  },
  resendRow: {
    alignItems: "center",
    marginBottom: 20,
  },
  timerText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  timerBold: {
    fontWeight: "800",
    color: colors.primary,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },

  // Verified State
  verifiedBox: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    marginVertical: 10,
  },
  verifiedTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#166534",
    marginTop: 12,
    letterSpacing: -0.3,
  },
  verifiedSub: {
    fontSize: 14,
    color: "#15803D",
    marginTop: 4,
    fontWeight: "500",
  },

  countryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
  },
  flagEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  whatsappHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  sameAsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  miniCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    backgroundColor: "#FFFFFF",
  },
  miniCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sameAsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },

  // Password Strength Meter
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: -4,
  },
  strengthTrack: {
    flexDirection: "row",
    flex: 1,
    height: 4,
    marginRight: 12,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 2,
  },
  segmentWeak: { backgroundColor: "#EF4444" },
  segmentFair: { backgroundColor: "#F59E0B" },
  segmentGood: { backgroundColor: "#3B82F6" },
  segmentStrong: { backgroundColor: "#10B981" },
  strengthLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    width: 50,
    textAlign: "right",
  },

  // Stage 4 Picker Triggers
  pickerTriggerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F5F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  pickerTriggerDisabled: {
    opacity: 0.6,
  },
  pickerTriggerText: {
    flex: 1,
    fontSize: 15,
    color: "#94A3B8",
    fontWeight: "500",
    marginLeft: 10,
  },
  pickerTriggerTextActive: {
    color: "#0F172A",
    fontWeight: "700",
  },

  // Referral Validation Pill
  sponsorPill: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 14,
    marginTop: -6,
  },
  sponsorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803D",
  },
  sponsorName: {
    fontWeight: "800",
  },
  referralInvalidText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 12,
    marginTop: -6,
    marginLeft: 4,
  },

  // Terms and Conditions
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 14,
  },
  termsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
    backgroundColor: "#FFFFFF",
  },
  termsCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
    fontWeight: "500",
  },
  termsLink: {
    color: colors.primary,
    fontWeight: "700",
  },

  // ----------------------------------------------------
  // Global Buttons & Notifications
  // ----------------------------------------------------
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 54,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginLeft: 12,
    letterSpacing: 0.1,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  dividerText: {
    paddingHorizontal: 14,
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  errorInline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  successInline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  successText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  footerMuted: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  footerLinkPink: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },

  // Google Verified Badge in Stage 1
  socialVerifiedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  socialVerifiedBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  socialVerifiedContent: {
    flex: 1,
  },
  socialVerifiedTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 2,
  },
  socialVerifiedEmail: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "600",
  },

  // Social Password Bypass Card in Stage 3
  socialPasswordBypassCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  socialPasswordBypassText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
    lineHeight: 18,
  },
});
