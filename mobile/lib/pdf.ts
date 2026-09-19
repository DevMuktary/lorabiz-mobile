import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/**
 * Robustly extracts pure base64 payload from raw string or data URI.
 * Handles single or multiple repeated data URI prefixes, mime-type variations, whitespace, and newlines.
 */
export function extractCleanBase64(raw: string): string {
  if (!raw) return "";
  let payload = raw.trim();

  // If data URI present (or multiple repeated e.g. data:...data:...), take after last comma
  if (payload.includes(",")) {
    const parts = payload.split(",");
    payload = parts[parts.length - 1];
  } else {
    payload = payload.replace(/^data:[^;]+;base64,/, "");
  }

  // Remove any remaining whitespace, newlines, or non-base64 characters
  return payload.replace(/[^A-Za-z0-9+/=]/g, "");
}

export interface DownloadAndShareOptions {
  source: string; // Base64 data URI or HTTP/HTTPS URL
  filename: string;
  dialogTitle?: string;
}

export interface DownloadAndShareResult {
  success: boolean;
  uri?: string;
  error?: string;
}

/**
 * Saves a base64 or remote URL PDF to local device cache and triggers the native share/save sheet.
 */
export async function downloadAndSharePdf({
  source,
  filename,
  dialogTitle = "Download Document",
}: DownloadAndShareOptions): Promise<DownloadAndShareResult> {
  try {
    if (!source || typeof source !== "string") {
      throw new Error("No document content available for download.");
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileUri = `${FileSystem.cacheDirectory}${safeFilename}`;

    if (source.startsWith("http://") || source.startsWith("https://")) {
      try {
        await FileSystem.downloadAsync(source, fileUri);
      } catch (dlErr: any) {
        // Resilient fallback: fetch binary blob and write via Base64
        const response = await fetch(source);
        if (!response.ok) throw dlErr;
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const res = (reader.result as string) || "";
            resolve(res.includes(",") ? res.split(",")[1] : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    } else {
      const cleanBase64 = extractCleanBase64(source);
      if (!cleanBase64) {
        throw new Error("Invalid or corrupted document data.");
      }
      await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (await Sharing.isAvailableAsync()) {
      const shareOptions: Sharing.SharingOptions = {
        mimeType: "application/pdf",
        dialogTitle,
      };

      // UTI is an iOS-only Uniform Type Identifier; do NOT send on Android
      if (Platform.OS === "ios") {
        shareOptions.UTI = "com.adobe.pdf";
      }

      await Sharing.shareAsync(fileUri, shareOptions);
    }

    return { success: true, uri: fileUri };
  } catch (err: any) {
    const msg = err?.message || String(err);
    // User dismissing or cancelling the system share dialog is not a fatal error
    if (
      msg.includes("dismissed") ||
      msg.includes("cancelled") ||
      msg.includes("canceled") ||
      msg.includes("User did not share")
    ) {
      return { success: true };
    }

    console.error("PDF Download/Share error:", err);
    return { success: false, error: msg };
  }
}
