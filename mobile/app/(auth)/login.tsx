import React, { useState, useEffect, useRef } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import {
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../constants/theme";
import { BASE_URL } from "../../lib/api";

// Multi-Color Google G Icon
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

// Sleek Circular Back Chevron Icon matching ALAT (Screenshots 1 & 2)
function ChevronLeftIcon({ size = 20, color = "#0F172A" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

// Edit Pencil Icon inside Masked Email Pill (ALAT Screenshot 1)
function EditPencilIcon({ size = 14, color = "#475569" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <Path d="m15 5 4 4" />
    </Svg>
  );
}

// Apple Face ID Biometric Glyph matching ALAT
function AppleFaceIdIcon({ size = 28, color = "#0F172A" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {/* 4 Corner Brackets */}
      <Path d="M6 3H5a2 2 0 0 0-2 2v1" />
      <Path d="M18 3h1a2 2 0 0 1 2 2v1" />
      <Path d="M21 18v1a2 2 0 0 1-2 2h-1" />
      <Path d="M3 18v1a2 2 0 0 0 2 2h1" />
      {/* Eyes */}
      <Path d="M9 9h.01" strokeWidth={3} />
      <Path d="M15 9h.01" strokeWidth={3} />
      {/* Nose */}
      <Path d="M12 11v3h-1" />
      {/* Smile curve */}
      <Path d="M8.5 16.5c1.2 1 2.3 1.5 3.5 1.5s2.3-.5 3.5-1.5" />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    login,
    savedProfile,
    clearSavedProfile,
    biometricAvailable,
    biometricEnabled,
    promptBiometricUnlock,
    refreshProfile,
    completeSocialLogin,
  } = useAuth();

  // Mode: returning user quick-unlock (Screenshot 1) vs standard 1-step login (Screenshot 2)
  const [isReturningUser, setIsReturningUser] = useState<boolean>(Boolean(savedProfile));

  // Form inputs (Both Email and Password together in 1 step)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Input Focus References for Instant Tap Response
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 2FA OTP state
  const [requireOtp, setRequireOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Synchronize returning user state when savedProfile is loaded
  useEffect(() => {
    if (savedProfile) {
      setIsReturningUser(true);
      setEmail(savedProfile.email);
    }
  }, [savedProfile]);

  // Pre-warm CSRF token in background native cookie storage
  useEffect(() => {
    fetch(`${BASE_URL}/api/auth/csrf`, { credentials: "include" }).catch(() => {});
  }, []);

  // Auto-prompt Face ID on mount when returning user arrives on the page (matching ALAT & top banking apps)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isReturningUser && savedProfile && biometricAvailable && biometricEnabled) {
      timer = setTimeout(() => {
        handleBiometricUnlock();
      }, 350);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isReturningUser, savedProfile, biometricAvailable, biometricEnabled]);

  // Listen for deep-link returns from Google OAuth (lorabiz://auth/google-success)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.includes("google-success") || event.url.includes("auth/callback")) {
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
              router.replace({
                pathname: "/(auth)/register",
                params: {
                  fromGoogle: "true",
                  googleFirstName: loggedInUser.firstName || "",
                  googleLastName: loggedInUser.lastName || "",
                  googleEmail: loggedInUser.email || "",
                },
              });
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

  async function handleBiometricUnlock() {
    setErrorMsg(null);
    try {
      const success = await promptBiometricUnlock();
      if (success) {
        router.replace("/(tabs)");
      }
    } catch {
      // User cancelled
    }
  }

  async function handleLogin() {
    setErrorMsg(null);
    const targetEmail = isReturningUser && savedProfile ? savedProfile.email : email.trim();

    if (!targetEmail) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(targetEmail, password);
      if (result.requireOtp) {
        setRequireOtp(true);
      } else if (result.success) {
        router.replace("/(tabs)");
      } else {
        setErrorMsg(result.message || "Invalid email or password.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMsg("Please enter the 6-digit code.");
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMsg(null);
    try {
      const targetEmail = isReturningUser && savedProfile ? savedProfile.email : email.trim();
      const result = await login(targetEmail, password, cleanCode);
      if (result.success) {
        router.replace("/(tabs)");
      } else {
        setErrorMsg(result.message || "Invalid or expired code.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Verification failed. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handleSwitchAccount() {
    try {
      await clearSavedProfile();
    } catch {}
    setIsReturningUser(false);
    setPassword("");
    setEmail("");
    setErrorMsg(null);
  }

  function handleBackToWelcome() {
    if (requireOtp) {
      setRequireOtp(false);
      setOtpCode("");
    } else {
      router.replace("/(auth)/welcome");
    }
  }

  async function handleGoogleSignIn() {
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
            router.replace("/(tabs)");
          } else {
            // Profile incomplete: redirect to register wizard to complete phone & address details
            router.replace({
              pathname: "/(auth)/register",
              params: {
                fromGoogle: "true",
                googleFirstName: loggedInUser.firstName || "",
                googleLastName: loggedInUser.lastName || "",
                googleEmail: loggedInUser.email || "",
              },
            });
          }
        } else {
          setErrorMsg("Could not verify session. Please try logging in again.");
        }
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setErrorMsg("Google sign-in could not be opened. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Safe area top padding ensuring back button and profile orb sit below status bar
  const topSafePadding = Math.max(insets.top, 44) + 6;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? undefined : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Subtle Angled Background Brand Watermark (Matching ALAT) */}
      <View style={styles.watermarkContainer} pointerEvents="none">
        <Image
          source={require("../../assets/logo-pink.png")}
          style={styles.watermarkImage}
          resizeMode="contain"
        />
      </View>

      {/* Top Bar: Left Circular Back Button + Right Top Orb (Matching ALAT Screenshots 1 & 2) */}
      <View style={[styles.topBar, { top: topSafePadding }]}>
        <TouchableOpacity
          style={styles.circularBackButton}
          onPress={handleBackToWelcome}
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

      {/* Scrollable Form Area with Natural Top-to-Bottom Breathing Room */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: topSafePadding + 62,
            paddingBottom: Math.max(insets.bottom, 20) + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------------- */}
        {/* SCREEN STATE A: 2FA OTP Code Verification */}
        {/* ---------------------------------------------------- */}
        {requireOtp ? (
          <View style={styles.contentWrapper}>
            <View style={styles.brandHeader}>
              <View style={styles.iconCircle}>
                <ShieldCheck size={32} color={colors.primary} />
              </View>
              <Text style={styles.title}>Two-Factor Code</Text>
              <Text style={styles.subtitleMuted}>
                Enter the 6-digit code sent to your email or authenticator app.
              </Text>
            </View>

            <View style={styles.alatInputCard}>
              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                placeholderTextColor="#94A3B8"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />
            </View>

            {/* Error Message Directly Below Input */}
            {errorMsg ? (
              <View style={styles.errorInline}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isVerifyingOtp && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={isVerifyingOtp}
              activeOpacity={0.88}
            >
              {isVerifyingOtp ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                setRequireOtp(false);
                setOtpCode("");
              }}
            >
              <Text style={styles.switchButtonText}>Back to password</Text>
            </TouchableOpacity>
          </View>
        ) : isReturningUser && savedProfile ? (
          /* SCREEN STATE B: Returning User Quick Unlock (ALAT Screenshot 1) */
          <View style={styles.contentWrapper}>
            {/* User Greeting Row: Left Avatar Circle, Right "Welcome Back" & User Name */}
            <View style={styles.returningProfileRow}>
              <Image
                source={
                  savedProfile.image
                    ? { uri: savedProfile.image }
                    : require("../../assets/default-avatar.png")
                }
                style={styles.returningAvatarImage}
                resizeMode="cover"
              />
              <View style={styles.returningNameColumn}>
                <Text style={styles.returningWelcomeText}>Welcome Back</Text>
                <Text style={styles.returningUserName} numberOfLines={1}>
                  {savedProfile.firstName || savedProfile.name || "User"}
                </Text>
              </View>
            </View>

            {/* Masked Email Pill with Edit Pencil */}
            <TouchableOpacity
              style={styles.maskedEmailPill}
              onPress={handleSwitchAccount}
              activeOpacity={0.75}
            >
              <Text style={styles.maskedEmailText}>
                {savedProfile.maskedEmail || savedProfile.email}
              </Text>
              <View style={styles.pillDivider} />
              <EditPencilIcon size={14} color="#475569" />
            </TouchableOpacity>

            {/* Auth Section based on provider */}
            {savedProfile.authProvider === "google" ? (
              <View style={styles.fieldGroup}>
                <TouchableOpacity
                  style={[styles.googleButton, { marginTop: 16 }]}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <GoogleIcon size={20} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={{ marginTop: 24, alignItems: "center" }}>
                  <TouchableOpacity onPress={handleSwitchAccount} activeOpacity={0.7}>
                    <Text style={styles.resetPasswordText}>Use a different account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Password Section for credentials users */
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Pressable
                  style={[styles.alatInputCard, passwordFocused && styles.alatInputCardActive]}
                  onPress={() => passwordInputRef.current?.focus()}
                >
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.alatTextInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(text: string) => {
                      setPassword(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    onSubmitEditing={handleLogin}
                    returnKeyType="go"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeToggleBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#0F172A" />
                    ) : (
                      <Eye size={20} color="#0F172A" />
                    )}
                  </TouchableOpacity>
                </Pressable>

                {/* Error Message Directly Below Password Input Box */}
                {errorMsg ? (
                  <View style={styles.errorInline}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* Reset Password Link (Right-Aligned) */}
                <View style={styles.resetPasswordRow}>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`${BASE_URL}/auth/forgot-password`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.resetPasswordText}>Reset password</Text>
                  </TouchableOpacity>
                </View>

                {/* Primary Action: Log in */}
                <TouchableOpacity
                  style={[styles.primaryButton, (!password || isLoading) && styles.btnDisabled]}
                  onPress={handleLogin}
                  disabled={!password || isLoading}
                  activeOpacity={0.88}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Log in</Text>
                  )}
                </TouchableOpacity>

                {/* Footer: Don't have an account? Sign up */}
                <View style={styles.footerRow}>
                  <Text style={styles.footerMuted}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                    <Text style={styles.footerLinkPink}>Sign up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Circular Face ID Button positioned right in that lower spot */}
            {biometricAvailable && biometricEnabled ? (
              <View style={styles.faceIdSection}>
                <TouchableOpacity
                  style={styles.faceIdCircleButton}
                  onPress={handleBiometricUnlock}
                  activeOpacity={0.75}
                >
                  <AppleFaceIdIcon size={30} color="#0F172A" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : (
          /* SCREEN STATE C: Standard 1-Step Login (ALAT Screenshot 2) */
          <View style={styles.contentWrapper}>
            {/* Header: Left Avatar Orb + Right "Glad to have you!" & bold "Log in to your account" */}
            <View style={styles.standardHeaderRow}>
              <View style={styles.headerOrbWrapper}>
                <Image
                  source={require("../../assets/logo-pink.png")}
                  style={styles.headerOrbImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.standardHeaderTexts}>
                <Text style={styles.standardGreetingText}>Glad to have you!</Text>
                <Text style={styles.standardMainTitle}>Log in to your account</Text>
              </View>
            </View>

            {/* Inputs Section */}
            <View style={styles.fieldGroup}>
              {/* Field 1: Email */}
              <Text style={styles.fieldLabel}>Email</Text>
              <Pressable
                style={[styles.alatInputCard, emailFocused && styles.alatInputCardActive]}
                onPress={() => emailInputRef.current?.focus()}
              >
                <TextInput
                  ref={emailInputRef}
                  style={styles.alatTextInput}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text: string) => {
                    setEmail(text);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  returnKeyType="next"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                />
              </Pressable>

              {/* Field 2: Password */}
              <Text style={styles.fieldLabel}>Password</Text>
              <Pressable
                style={[styles.alatInputCard, passwordFocused && styles.alatInputCardActive]}
                onPress={() => passwordInputRef.current?.focus()}
              >
                <TextInput
                  ref={passwordInputRef}
                  style={styles.alatTextInput}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text: string) => {
                    setPassword(text);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onSubmitEditing={handleLogin}
                  returnKeyType="go"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeToggleBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#0F172A" />
                  ) : (
                    <Eye size={20} color="#0F172A" />
                  )}
                </TouchableOpacity>
              </Pressable>

              {/* Error Message Directly Below Password Input Box */}
              {errorMsg ? (
                <View style={styles.errorInline}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Reset Password Link (Right-Aligned) */}
              <View style={styles.resetPasswordRow}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`${BASE_URL}/auth/forgot-password`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetPasswordText}>Reset password</Text>
                </TouchableOpacity>
              </View>

              {/* Primary Action: Log in */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!email.trim() || !password || isLoading) && styles.btnDisabled,
                ]}
                onPress={handleLogin}
                disabled={!email.trim() || !password || isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Log in</Text>
                )}
              </TouchableOpacity>

              {/* Footer: Don't have an account? Sign up */}
              <View style={styles.footerRow}>
                <Text style={styles.footerMuted}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                  <Text style={styles.footerLinkPink}>Sign up</Text>
                </TouchableOpacity>
              </View>

              {/* Divider: "or" */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Prominent "Continue with Google" In-App Browser Sheet */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <GoogleIcon size={20} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
    top: "30%",
    width: 360,
    height: 360,
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
  // Returning User Styles (ALAT Screenshot 1)
  // ----------------------------------------------------
  returningProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  returningAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: "#DCEBFB",
    marginRight: 16,
  },
  returningNameColumn: {
    justifyContent: "center",
  },
  returningWelcomeText: {
    fontSize: 16,
    color: "#475569",
    fontWeight: "400",
    marginBottom: 2,
  },
  returningUserName: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  maskedEmailPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  maskedEmailText: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  pillDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 10,
  },

  // ----------------------------------------------------
  // Standard 1-Step Login Header (ALAT Screenshot 2)
  // ----------------------------------------------------
  standardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
  },
  headerOrbWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(200, 45, 117, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerOrbImage: {
    width: 42,
    height: 42,
  },
  standardHeaderTexts: {
    flex: 1,
    justifyContent: "center",
  },
  standardGreetingText: {
    fontSize: 16,
    color: "#475569",
    fontWeight: "400",
    marginBottom: 2,
  },
  standardMainTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
  },

  // ----------------------------------------------------
  // Common Form Fields & ALAT Input Styling
  // ----------------------------------------------------
  fieldGroup: {
    width: "100%",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    marginTop: 2,
  },
  alatInputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 16,
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
  eyeToggleBtn: {
    padding: 6,
  },
  resetPasswordRow: {
    alignItems: "flex-end",
    marginBottom: 20,
    marginTop: -4,
  },
  resetPasswordText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  errorInline: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginBottom: 12,
    marginTop: -4,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
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

  // ----------------------------------------------------
  // Face ID Button (Sitting right where ALAT had the notepad)
  // ----------------------------------------------------
  faceIdSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    marginBottom: 8,
  },
  faceIdCircleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ----------------------------------------------------
  // 2FA Screen Styles
  // ----------------------------------------------------
  brandHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitleMuted: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  otpInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
    letterSpacing: 8,
    paddingVertical: 14,
  },
  switchButton: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 6,
  },
  switchButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
});
