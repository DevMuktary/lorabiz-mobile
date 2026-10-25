import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Updates the app launcher icon badge count on the user's mobile device home screen.
 * Shows a red badge count (1, 2, 3...) when unread notifications are waiting.
 * Works on iOS and supported Android launchers.
 */
export async function updateAppIconBadge(count: number): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    const badgeNumber = Math.max(0, Math.floor(count));
    await Notifications.setBadgeCountAsync(badgeNumber);
  } catch (err) {
    // Graceful fallback if device launcher doesn't support badges
    console.warn("[AppBadge] Could not set launcher badge count:", err);
  }
}

/**
 * Clears the app launcher icon badge back to 0.
 */
export async function clearAppIconBadge(): Promise<void> {
  await updateAppIconBadge(0);
}

/**
 * Requests notification badge permissions from iOS/Android so the launcher icon can display the unread count.
 */
export async function requestBadgePermissions(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return false;
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) {
      const request = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return request.granted;
    }
    return true;
  } catch {
    return false;
  }
}
