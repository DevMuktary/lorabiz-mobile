import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "lorabiz_mobile_session_token";
const USER_KEY = "lorabiz_mobile_user";
const BIOMETRIC_KEY = "lorabiz_biometric_enabled";
const SAVED_PROFILE_KEY = "lorabiz_saved_profile";

// Web fallback if running on web preview
const memoryStorage: Record<string, string> = {};

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStorage[key] = value;
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key) || memoryStorage[key] || null;
    } catch {
      return memoryStorage[key] || null;
    }
  }
  return await SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
    } catch {
      delete memoryStorage[key];
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export interface SavedProfile {
  id: string;
  name: string;
  firstName: string;
  lastName?: string;
  email: string;
  maskedEmail: string;
  image?: string | null;
  authProvider?: "credentials" | "google";
}

export async function saveSavedProfile(profile: SavedProfile): Promise<void> {
  await setItem(SAVED_PROFILE_KEY, JSON.stringify(profile));
}

export async function getSavedProfile(): Promise<SavedProfile | null> {
  const data = await getItem(SAVED_PROFILE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function removeSavedProfile(): Promise<void> {
  await deleteItem(SAVED_PROFILE_KEY);
}

export async function saveAuthToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  return await getItem(TOKEN_KEY);
}

export async function removeAuthToken(): Promise<void> {
  await deleteItem(TOKEN_KEY);
}

export async function saveAuthUser(user: any): Promise<void> {
  await setItem(USER_KEY, JSON.stringify(user));
}

export async function getAuthUser(): Promise<any | null> {
  const data = await getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function removeAuthUser(): Promise<void> {
  await deleteItem(USER_KEY);
}

const BIO_USER_ID_KEY = "lorabiz_bio_user_id";
const BIO_EMAIL_KEY = "lorabiz_bio_email";

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await setItem(BIOMETRIC_KEY, enabled ? "true" : "false");
}

export async function isBiometricsEnabled(): Promise<boolean> {
  const val = await getItem(BIOMETRIC_KEY);
  return val === "true";
}

export async function saveBiometricAuth(userId: string, token: string, email: string): Promise<void> {
  try {
    const cleanEmail = (email || "").toLowerCase().trim();
    await setItem(BIOMETRIC_KEY, "true");
    await setItem(BIO_USER_ID_KEY, userId);
    await setItem(BIO_EMAIL_KEY, cleanEmail);
    await setItem(`lorabiz_bio_token_${userId}`, token);
    if (cleanEmail) {
      await setItem(`lorabiz_bio_token_${cleanEmail}`, token);
      await setItem(`lorabiz_bio_active_${cleanEmail}`, "true");
    }
    await setItem(`lorabiz_bio_active_${userId}`, "true");
  } catch (err) {
    console.error("saveBiometricAuth error:", err);
  }
}

export async function getBiometricTokenForAccount(userIdOrEmail: string): Promise<string | null> {
  try {
    const isEnabled = await isBiometricsEnabled();
    if (!isEnabled) return null;

    const cleanInput = (userIdOrEmail || "").toLowerCase().trim();
    if (!cleanInput) return null;

    // Check direct account biometric activation
    const isAccountActive = (await getItem(`lorabiz_bio_active_${cleanInput}`)) === "true";
    if (isAccountActive) {
      const token = await getItem(`lorabiz_bio_token_${cleanInput}`);
      if (token) return token;
    }

    // Check primary stored biometric user ID / email
    const storedUserId = await getItem(BIO_USER_ID_KEY);
    const storedEmail = ((await getItem(BIO_EMAIL_KEY)) || "").toLowerCase().trim();

    if (cleanInput === storedUserId?.toLowerCase().trim() || (storedEmail && cleanInput === storedEmail)) {
      if (storedUserId) {
        const token = await getItem(`lorabiz_bio_token_${storedUserId}`);
        if (token) return token;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function isBiometricsConfiguredForAccount(userIdOrEmail: string): Promise<boolean> {
  const token = await getBiometricTokenForAccount(userIdOrEmail);
  return !!token;
}

export async function removeBiometricAuth(userId?: string): Promise<void> {
  try {
    const targetId = userId || (await getItem(BIO_USER_ID_KEY));
    const storedEmail = await getItem(BIO_EMAIL_KEY);
    if (targetId) {
      await deleteItem(`lorabiz_bio_token_${targetId}`);
      await deleteItem(`lorabiz_bio_active_${targetId}`);
    }
    if (storedEmail) {
      await deleteItem(`lorabiz_bio_token_${storedEmail.toLowerCase().trim()}`);
      await deleteItem(`lorabiz_bio_active_${storedEmail.toLowerCase().trim()}`);
    }
    await deleteItem(BIO_USER_ID_KEY);
    await deleteItem(BIO_EMAIL_KEY);
    await setItem(BIOMETRIC_KEY, "false");
  } catch (err) {
    console.error("removeBiometricAuth error:", err);
  }
}

export async function setHideBalancePref(hidden: boolean): Promise<void> {
  try {
    await setItem("lorabiz_hide_balance", hidden ? "true" : "false");
  } catch {
    // Ignore storage write error
  }
}

export async function getHideBalancePref(): Promise<boolean> {
  try {
    const val = await getItem("lorabiz_hide_balance");
    return val === "true";
  } catch {
    return false;
  }
}

export interface CachedWalletData {
  balance: number;
  lastUpdated: number; // timestamp in ms
}

export async function saveCachedWallet(balance: number): Promise<void> {
  try {
    await setItem(
      "lorabiz_cached_wallet",
      JSON.stringify({
        balance,
        lastUpdated: Date.now(),
      })
    );
  } catch {
    // Ignore storage write error
  }
}

export async function getCachedWallet(): Promise<CachedWalletData | null> {
  try {
    const raw = await getItem("lorabiz_cached_wallet");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearAllAuth(): Promise<void> {
  await removeAuthToken();
  await removeAuthUser();
}

const BIO_PROMPT_DISMISSED_KEY = "lorabiz_bio_prompt_dismissed";
const AUTOLOCK_TIMEOUT_KEY = "lorabiz_autolock_timeout";

export async function setBioPromptDismissed(dismissed: boolean): Promise<void> {
  try {
    await setItem(BIO_PROMPT_DISMISSED_KEY, dismissed ? "true" : "false");
  } catch {}
}

export async function getBioPromptDismissed(): Promise<boolean> {
  try {
    const val = await getItem(BIO_PROMPT_DISMISSED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

export async function setAutoLockTimeout(timeout: string): Promise<void> {
  try {
    await setItem(AUTOLOCK_TIMEOUT_KEY, timeout);
  } catch {}
}

export async function getAutoLockTimeout(): Promise<string> {
  try {
    const val = await getItem(AUTOLOCK_TIMEOUT_KEY);
    return val || "never";
  } catch {
    return "never";
  }
}

const LAST_ACTIVE_TIME_KEY = "lorabiz_last_active_time";

export async function setLastActiveTime(time: number): Promise<void> {
  try {
    await setItem(LAST_ACTIVE_TIME_KEY, time.toString());
  } catch {}
}

export async function getLastActiveTime(): Promise<number> {
  try {
    const val = await getItem(LAST_ACTIVE_TIME_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export type ThemeMode = "system" | "light" | "dark";
const THEME_MODE_KEY = "lorabiz_theme_mode";

export async function setThemeModePref(mode: ThemeMode): Promise<void> {
  try {
    await setItem(THEME_MODE_KEY, mode);
  } catch {}
}

export async function getThemeModePref(): Promise<ThemeMode> {
  try {
    const val = await getItem(THEME_MODE_KEY);
    if (val === "dark" || val === "system" || val === "light") return val;
    return "system"; // Default to system theme so OS dark/light mode is respected
  } catch {
    return "system";
  }
}

const LAST_DISMISSED_PROMO_KEY = "lorabiz_last_dismissed_promo_id";

export async function setLastDismissedPromoId(id: string): Promise<void> {
  try {
    await setItem(LAST_DISMISSED_PROMO_KEY, id);
  } catch {}
}

export async function getLastDismissedPromoId(): Promise<string | null> {
  try {
    return await getItem(LAST_DISMISSED_PROMO_KEY);
  } catch {
    return null;
  }
}



