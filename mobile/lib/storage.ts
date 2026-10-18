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

