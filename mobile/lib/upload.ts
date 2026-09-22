import * as FileSystem from "expo-file-system/legacy";
import { BASE_URL } from "./api";
import { getAuthToken } from "./storage";

export interface UploadFileOptions {
  uri: string;
  name?: string;
  mimeType?: string;
}

/**
 * Uploads a local file from the device to /api/upload using native FileSystem.uploadAsync.
 * This completely bypasses React Native / Hermes FormData and fetch polyfill limitations
 * (which cause "Unsupported FormDataPart implementation" errors).
 */
export async function uploadFileToServer(options: UploadFileOptions): Promise<string> {
  const { uri, name, mimeType } = options;

  const token = await getAuthToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["Cookie"] = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`;
  }

  // Determine fallback mimeType if not provided
  let detectedMime = mimeType;
  if (!detectedMime || detectedMime === "application/octet-stream") {
    const lower = (name || uri).toLowerCase();
    if (lower.endsWith(".png")) detectedMime = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) detectedMime = "image/jpeg";
    else if (lower.endsWith(".pdf")) detectedMime = "application/pdf";
    else detectedMime = "application/pdf";
  }

  // Normalize image/jpg to image/jpeg for standard MIME compliance
  if (detectedMime === "image/jpg") {
    detectedMime = "image/jpeg";
  }

  const uploadResult = await FileSystem.uploadAsync(`${BASE_URL}/api/upload`, uri, {
    fieldName: "file",
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    mimeType: detectedMime,
    headers,
  });

  let responseData: any = {};
  try {
    responseData = JSON.parse(uploadResult.body);
  } catch (err) {
    throw new Error("Invalid response from upload server.");
  }

  if (uploadResult.status < 200 || uploadResult.status >= 300 || !responseData.success) {
    throw new Error(responseData.error || "Failed to upload file.");
  }

  return responseData.url;
}
