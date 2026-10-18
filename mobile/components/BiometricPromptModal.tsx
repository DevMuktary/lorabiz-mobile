import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../constants/theme";

interface BiometricPromptModalProps {
  visible: boolean;
  isLoading?: boolean;
  onSetup: () => void;
  onDismissForever: () => void;
  onClose: () => void;
}

// Apple Face ID Biometric Glyph
function FaceIdGlyph({ size = 44, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3H5a2 2 0 0 0-2 2v1" />
      <Path d="M18 3h1a2 2 0 0 1 2 2v1" />
      <Path d="M21 18v1a2 2 0 0 1-2 2h-1" />
      <Path d="M3 18v1a2 2 0 0 0 2 2h1" />
      <Path d="M9 9h.01" strokeWidth={3} />
      <Path d="M15 9h.01" strokeWidth={3} />
      <Path d="M12 11v3h-1" />
      <Path d="M8.5 16.5c1.2 1 2.3 1.5 3.5 1.5s2.3-.5 3.5-1.5" />
    </Svg>
  );
}

export default function BiometricPromptModal({
  visible,
  isLoading = false,
  onSetup,
  onDismissForever,
  onClose,
}: BiometricPromptModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.overlayPress} onPress={onClose} />
        <View style={styles.sheetCard}>
          {/* Top handle pill */}
          <View style={styles.handleBar} />

          {/* Biometric glowing icon orb */}
          <View style={styles.iconOrb}>
            <FaceIdGlyph size={40} color={colors.primary} />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.sheetTitle}>Enable Face ID</Text>
          <Text style={styles.sheetSubtitle}>
            Would you like to turn on Face ID for your Lorabiz account? You will be able to unlock and sign in instantly without typing your password.
          </Text>

          {/* Primary Action: Set up now */}
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.btnDisabled]}
            onPress={onSetup}
            disabled={isLoading}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Set It Up Now</Text>
            )}
          </TouchableOpacity>

          {/* Secondary Action: Don't ask again */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onDismissForever}
            disabled={isLoading}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryButtonText}>Don't Ask Again</Text>
          </TouchableOpacity>

          {/* Dismiss: Maybe later */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onClose}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  overlayPress: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  handleBar: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    marginBottom: 20,
  },
  iconOrb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(200, 45, 117, 0.2)",
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
    marginBottom: 26,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: "#F1F5F9",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
});
