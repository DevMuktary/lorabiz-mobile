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

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await setItem(BIOMETRIC_KEY, enabled ? "true" : "false");
}

export async function isBiometricsEnabled(): Promise<boolean> {
  const val = await getItem(BIOMETRIC_KEY);
  return val === "true";
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

