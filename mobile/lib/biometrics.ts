import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricTypes: LocalAuthentication.AuthenticationType[];
  supportedTypeLabel: string;
}

export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  if (Platform.OS === "web") {
    return {
      hasHardware: false,
      isEnrolled: false,
      biometricTypes: [],
      supportedTypeLabel: "Biometrics",
    };
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  let supportedTypeLabel = "Biometrics";
  if (biometricTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    supportedTypeLabel = Platform.OS === "ios" ? "Face ID" : "Facial Recognition";
  } else if (biometricTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    supportedTypeLabel = Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }

  return {
    hasHardware,
    isEnrolled,
    biometricTypes,
    supportedTypeLabel,
  };
}

export async function promptBiometricAuth(
  promptMessage: string = "Authenticate to unlock Lorabiz"
): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const caps = await getBiometricCapabilities();
    if (!caps.hasHardware || !caps.isEnrolled) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
      fallbackLabel: "Use Password",
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    console.error("Biometric authentication error:", error);
    return false;
  }
}
