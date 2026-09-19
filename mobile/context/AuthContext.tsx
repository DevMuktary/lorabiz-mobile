import React, { createContext, useContext, useState, useEffect } from "react";
import {
  getAuthToken,
  saveAuthToken,
  removeAuthToken,
  getAuthUser,
  saveAuthUser,
  removeAuthUser,
  isBiometricsEnabled,
  setBiometricsEnabled,
  getSavedProfile,
  saveSavedProfile,
  removeSavedProfile,
  SavedProfile,
  getCachedWallet,
  saveCachedWallet,
} from "../lib/storage";
import { api, BASE_URL } from "../lib/api";
import { promptBiometricAuth, getBiometricCapabilities } from "../lib/biometrics";

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  phone?: string;
  role: string;
  image?: string | null;
  isProfileComplete?: boolean;
  twoFactorEnabled?: boolean;
  referralCode?: string | null;
  wallet?: {
    id?: string;
    balance: number;
  };
}

interface LoginResult {
  success: boolean;
  requireOtp?: boolean;
  twoFactorMethod?: string;
  message?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  wallet: { id?: string; balance: number } | null;
  savedProfile: SavedProfile | null;
  isLoading: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  login: (email: string, password: string, otpCode?: string, isBackupCode?: boolean) => Promise<LoginResult>;
  logout: () => Promise<void>;
  clearSavedProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<number | null>;
  updateWalletBalance: (newBalance: number) => void;
  completeSocialLogin: (sessionToken?: string) => Promise<UserProfile | null>;
  toggleBiometrics: (enabled: boolean) => Promise<boolean>;
  promptBiometricUnlock: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const maskedName =
    name.length <= 3
      ? name[0] + "***"
      : name.slice(0, 3) + "***" + (name.length > 5 ? name.slice(-1) : "");
  return `${maskedName}@${parts[1]}`;
}

function extractCleanCookies(rawCookieHeader: string | null): string {
  if (!rawCookieHeader) return "";
  return rawCookieHeader
    .split(/,(?=[^;]+;)/g)
    .map((chunk) => chunk.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ id?: string; balance: number } | null>(null);
  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      // 0. Load cached wallet immediately for 0ms initial render
      const cached = await getCachedWallet();
      if (cached && typeof cached.balance === "number") {
        setWallet({ balance: cached.balance });
      }

      // 1. Check biometrics hardware
      const caps = await getBiometricCapabilities();
      setBiometricAvailable(caps.hasHardware && caps.isEnrolled);

      const bioPref = await isBiometricsEnabled();
      setBiometricEnabledState(bioPref);

      // 2. Load stored saved profile for returning user UX
      const profile = await getSavedProfile();
      if (profile) {
        setSavedProfile(profile);
      }

      // 3. Pre-warm CSRF cookie in background native cookie storage
      fetch(`${BASE_URL}/api/auth/csrf`, { credentials: "include" }).catch(() => {});

      // 4. Load stored token and user
      const storedToken = await getAuthToken();
      const storedUser = await getAuthUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        if (storedUser.wallet) {
          setWallet(storedUser.wallet);
        }
        setUser(storedUser);

        // Fetch fresh wallet balance immediately in background
        api
          .get("/api/user/wallet")
          .then((walletRes) => {
            const bal = Number(walletRes?.balance ?? walletRes?.wallet?.balance ?? 0);
            const wObj = { id: walletRes?.wallet?.id || "wallet", balance: bal };
            setWallet(wObj);
            saveCachedWallet(bal);
            setUser((prev) => (prev ? { ...prev, wallet: wObj } : null));
          })
          .catch(() => {});

        // Quiet background session validation
        fetch(`${BASE_URL}/api/auth/session`, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${storedToken}`,
            Cookie: `next-auth.session-token=${storedToken}; __Secure-next-auth.session-token=${storedToken}`,
          },
        })
          .then((r) => r.json())
          .then((res) => {
            if (res?.user) {
              setUser((prev) => {
                const updatedUser = {
                  ...(prev || storedUser),
                  ...res.user,
                  wallet: prev?.wallet || storedUser.wallet,
                };
                saveAuthUser(updatedUser);
                return updatedUser;
              });
            }
          })
          .catch(() => {
            // Session refresh failure
          });
      }
    } catch (err) {
      console.error("Auth init error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(
    email: string,
    password: string,
    otpCode?: string,
    isBackupCode?: boolean
  ): Promise<LoginResult> {
    const trimmedEmail = email.trim().toLowerCase();

    async function executeNextAuthLogin(attempt = 1): Promise<LoginResult> {
      try {
        // Fetch CSRF token and prime native cookie jar
        const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
          credentials: "include",
        });
        const csrfData = await csrfRes.json();
        const rawSetCookie = csrfRes.headers.get("set-cookie");
        let cleanCookie = extractCleanCookies(rawSetCookie);
        const hostCsrf = cleanCookie.match(/__Host-next-auth\.csrf-token=([^;]+)/)?.[1];
        if (hostCsrf && !cleanCookie.includes("next-auth.csrf-token=")) {
          cleanCookie += `; next-auth.csrf-token=${hostCsrf}`;
        }

        const postRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            ...(cleanCookie ? { Cookie: cleanCookie } : {}),
          },
          body: new URLSearchParams({
            csrfToken: csrfData.csrfToken || "",
            email: trimmedEmail,
            password,
            ...(otpCode ? { otpCode: otpCode.trim() } : {}),
            json: "true",
          }),
        });

        const setCookies = postRes.headers.get("set-cookie") || "";
        const text = await postRes.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          data = { url: text };
        }

        // Check if CSRF token failed and needs a 1-time retry
        if (data?.url && data.url.includes("csrf=true")) {
          if (attempt === 1) {
            // Wait 150ms for native cookie jar to settle and retry cleanly
            await new Promise((resolve) => setTimeout(resolve, 150));
            return await executeNextAuthLogin(2);
          }
          return {
            success: false,
            message: "Authentication verification failed. Please try again.",
          };
        }

        // Handle Authentication Error Redirect (e.g. Invalid password)
        if (data?.url && data.url.includes("error=")) {
          try {
            const urlObj = new URL(data.url);
            const rawErr = urlObj.searchParams.get("error") || "Invalid email or password.";
            return { success: false, message: decodeURIComponent(rawErr) };
          } catch {
            return { success: false, message: "Invalid email or password." };
          }
        }

        // Handle 2FA Challenge Redirect
        if (data?.url && (data.url.includes("verify-2fa") || data.url.includes("otp"))) {
          return {
            success: false,
            requireOtp: true,
            message: "Please enter the 6-digit verification code to complete sign in.",
          };
        }

        // Extract Session Token from Set-Cookie header
        const tokenMatch = setCookies.match(/(?:__Secure-)?next-auth\.session-token=([^;]+)/);
        let sessionToken = tokenMatch ? tokenMatch[1] : "";

        // Also query session endpoint to verify and fetch profile
        let userProfile: UserProfile = {
          id: `user_${Date.now()}`,
          email: trimmedEmail,
          name: trimmedEmail.split("@")[0],
          firstName: trimmedEmail.split("@")[0],
          role: "USER",
        };

        try {
          const sessionHeaders: Record<string, string> = {};
          if (sessionToken) {
            sessionHeaders["Cookie"] = `next-auth.session-token=${sessionToken}; __Secure-next-auth.session-token=${sessionToken}`;
          }
          const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
            credentials: "include",
            headers: sessionHeaders,
          });
          const sessionData = await sessionRes.json();
          if (sessionData?.user) {
            userProfile = {
              id: sessionData.user.id || userProfile.id,
              email: sessionData.user.email || trimmedEmail,
              name: sessionData.user.name || userProfile.name,
              firstName: sessionData.user.name?.split(" ")[0] || userProfile.firstName,
              role: sessionData.user.role || "USER",
              image: sessionData.user.image || null,
            };
            if (!sessionToken && sessionData.user.id) {
              sessionToken = `session_${sessionData.user.id}`;
            }
          }
        } catch {
          // Keep base profile
        }

        // If neither session token nor profile was obtained, authentication did not succeed
        if (!sessionToken && (!data?.url || data.url.includes("signin"))) {
          if (attempt === 1) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            return await executeNextAuthLogin(2);
          }
          return { success: false, message: "Invalid email or password." };
        }

        const activeToken = sessionToken || `session_${Date.now()}`;

        // Fetch fresh wallet balance immediately on login
        try {
          const walletRes = await fetch(`${BASE_URL}/api/user/wallet`, {
            credentials: "include",
            headers: {
              Authorization: `Bearer ${activeToken}`,
              Cookie: `next-auth.session-token=${activeToken}; __Secure-next-auth.session-token=${activeToken}`,
            },
          }).then((r) => r.json());

          if (walletRes?.success || typeof walletRes?.balance === "number") {
            const bal = Number(walletRes.balance ?? walletRes.wallet?.balance ?? 0);
            const wObj = { id: walletRes.wallet?.id || "wallet", balance: bal };
            userProfile.wallet = wObj;
            setWallet(wObj);
            saveCachedWallet(bal);
          }
        } catch {
          // Continue with base profile on network hiccup
        }

        await saveAuthToken(activeToken);
        await saveAuthUser(userProfile);
        setToken(activeToken);
        setUser(userProfile);

        // Save persistent profile for returning user quick-unlock
        const profileToSave: SavedProfile = {
          id: userProfile.id,
          name: userProfile.name,
          firstName: userProfile.firstName || userProfile.name.split(" ")[0] || "User",
          email: userProfile.email,
          maskedEmail: maskEmail(userProfile.email),
          image: userProfile.image,
          authProvider: "credentials",
        };
        await saveSavedProfile(profileToSave);
        setSavedProfile(profileToSave);

        return { success: true };
      } catch (err: any) {
        console.error("Login attempt error:", err);
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return await executeNextAuthLogin(2);
        }
        return {
          success: false,
          message: err?.message || "Connection error. Please check your internet connection.",
        };
      }
    }

    return await executeNextAuthLogin(1);
  }

  async function logout() {
    try {
      // 1. Tell NextAuth to sign out and clear native cookies
      try {
        const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, { credentials: "include" });
        const csrfData = await csrfRes.json().catch(() => ({}));
        await fetch(`${BASE_URL}/api/auth/signout`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            csrfToken: csrfData?.csrfToken || "",
            json: "true",
          }),
        }).catch(() => {});
      } catch {
        // Continue clearing local storage regardless of network
      }

      await removeAuthToken();
      await removeAuthUser();
      setToken(null);
      setUser(null);
      setWallet(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  async function clearSavedProfile() {
    try {
      await removeSavedProfile();
      setSavedProfile(null);
    } catch (err) {
      console.error("Clear saved profile error:", err);
    }
  }

  function updateWalletBalance(newBalance: number) {
    const num = Number(newBalance) || 0;
    const wObj = { id: wallet?.id || user?.wallet?.id || "wallet", balance: num };
    setWallet(wObj);
    saveCachedWallet(num);
    setUser((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        wallet: wObj,
      };
      saveAuthUser(updated);
      return updated;
    });
  }

  async function refreshWallet(): Promise<number | null> {
    try {
      const walletRes = await api.get("/api/user/wallet");
      if (walletRes?.success || typeof walletRes?.balance === "number") {
        const bal = Number(walletRes.balance ?? walletRes.wallet?.balance ?? 0);
        updateWalletBalance(bal);
        return bal;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function refreshProfile() {
    try {
      const activeToken = token || (await getAuthToken());
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers["Authorization"] = `Bearer ${activeToken}`;
        headers["Cookie"] = `next-auth.session-token=${activeToken}; __Secure-next-auth.session-token=${activeToken}`;
      }

      const res = await fetch(`${BASE_URL}/api/auth/session`, {
        credentials: "include",
        headers,
      });
      const data = await res.json();
      let liveWallet = wallet || user?.wallet;
      try {
        const walletRes = await api.get("/api/user/wallet");
        if (walletRes?.wallet) {
          liveWallet = {
            id: walletRes.wallet.id,
            balance: Number(walletRes.wallet.balance || 0),
          };
        } else if (typeof walletRes?.balance === "number") {
          liveWallet = {
            id: user?.wallet?.id || "wallet",
            balance: walletRes.balance,
          };
        }
        if (liveWallet) {
          setWallet(liveWallet);
          saveCachedWallet(liveWallet.balance);
        }
      } catch {
        // keep existing liveWallet on network failure
      }

      if (data?.user) {
        const updatedUser: UserProfile = {
          id: data.user.id || user?.id || `user_${Date.now()}`,
          email: data.user.email || user?.email || "",
          name: data.user.name || user?.name || "",
          firstName: data.user.firstName || data.user.name?.split(" ")[0] || user?.firstName || "User",
          lastName: data.user.lastName || data.user.name?.split(" ").slice(1).join(" ") || user?.lastName || "",
          role: data.user.role || user?.role || "USER",
          image: data.user.image || user?.image || null,
          isProfileComplete: data.user.isProfileComplete ?? false,
          wallet: liveWallet || undefined,
        };
        setUser(updatedUser);
        await saveAuthUser(updatedUser);
      }
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  }

  async function completeSocialLogin(sessionToken?: string): Promise<UserProfile | null> {
    try {
      if (sessionToken) {
        await saveAuthToken(sessionToken);
        setToken(sessionToken);
      }
      const activeToken = sessionToken || token || (await getAuthToken());
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers["Authorization"] = `Bearer ${activeToken}`;
        headers["Cookie"] = `next-auth.session-token=${activeToken}; __Secure-next-auth.session-token=${activeToken}`;
      }

      const res = await fetch(`${BASE_URL}/api/auth/session`, {
        credentials: "include",
        headers,
      });
      const data = await res.json();
      let liveWallet = wallet || user?.wallet;
      try {
        const walletRes = await fetch(`${BASE_URL}/api/user/wallet`, {
          credentials: "include",
          headers,
        }).then((r) => r.json());
        if (walletRes?.success || typeof walletRes?.balance === "number") {
          const bal = Number(walletRes.balance ?? walletRes.wallet?.balance ?? 0);
          liveWallet = { id: walletRes.wallet?.id || "wallet", balance: bal };
          setWallet(liveWallet);
          saveCachedWallet(bal);
        }
      } catch {
        // Continue
      }

      if (data?.user) {
        const updatedUser: UserProfile = {
          id: data.user.id || user?.id || `user_${Date.now()}`,
          email: data.user.email || user?.email || "",
          name: data.user.name || user?.name || "",
          firstName: data.user.firstName || data.user.name?.split(" ")[0] || user?.firstName || "User",
          lastName: data.user.lastName || data.user.name?.split(" ").slice(1).join(" ") || user?.lastName || "",
          role: data.user.role || user?.role || "USER",
          image: data.user.image || user?.image || null,
          isProfileComplete: data.user.isProfileComplete ?? false,
          wallet: liveWallet || undefined,
        };
        setUser(updatedUser);
        await saveAuthUser(updatedUser);

        // Update saved profile for returning Google user
        const profileToSave: SavedProfile = {
          id: updatedUser.id,
          name: updatedUser.name,
          firstName: updatedUser.firstName || updatedUser.name.split(" ")[0] || "User",
          email: updatedUser.email,
          maskedEmail: maskEmail(updatedUser.email),
          image: updatedUser.image,
          authProvider: "google",
        };
        await saveSavedProfile(profileToSave);
        setSavedProfile(profileToSave);

        return updatedUser;
      }
      return null;
    } catch (err) {
      console.error("completeSocialLogin error:", err);
      return null;
    }
  }

  async function toggleBiometrics(enable: boolean): Promise<boolean> {
    if (enable) {
      const success = await promptBiometricAuth("Confirm your biometrics to enable instant unlock");
      if (success) {
        await setBiometricsEnabled(true);
        setBiometricEnabledState(true);
        return true;
      }
      return false;
    } else {
      await setBiometricsEnabled(false);
      setBiometricEnabledState(false);
      return true;
    }
  }

  async function promptBiometricUnlock(): Promise<boolean> {
    if (!biometricEnabled) return false;
    return await promptBiometricAuth("Unlock Lorabiz with Face ID or Fingerprint");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        wallet,
        savedProfile,
        isLoading,
        biometricAvailable,
        biometricEnabled,
        login,
        logout,
        clearSavedProfile,
        refreshProfile,
        refreshWallet,
        updateWalletBalance,
        completeSocialLogin,
        toggleBiometrics,
        promptBiometricUnlock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
