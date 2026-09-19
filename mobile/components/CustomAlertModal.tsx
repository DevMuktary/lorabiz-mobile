import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Info,
  PlusCircle,
  X,
} from "lucide-react-native";
import { colors } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type AlertType =
  | "insufficient_balance"
  | "success"
  | "error"
  | "warning"
  | "confirm"
  | "info";

export interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isDestructive?: boolean;
}

export default function CustomAlertModal({
  visible,
  type = "info",
  title,
  message,
  confirmText = "OK",
  cancelText,
  onConfirm,
  onCancel,
  isDestructive = false,
}: CustomAlertProps) {
  if (!visible) return null;

  const renderIcon = () => {
    switch (type) {
      case "insufficient_balance":
        return (
          <View style={[styles.iconOrb, styles.iconOrbPink]}>
            <Wallet size={28} color="#F472B6" />
          </View>
        );
      case "success":
        return (
          <View style={[styles.iconOrb, styles.iconOrbGreen]}>
            <CheckCircle2 size={28} color="#10B981" />
          </View>
        );
      case "error":
        return (
          <View style={[styles.iconOrb, styles.iconOrbRed]}>
            <AlertCircle size={28} color="#EF4444" />
          </View>
        );
      case "confirm":
        return (
          <View style={[styles.iconOrb, isDestructive ? styles.iconOrbRed : styles.iconOrbAmber]}>
            {isDestructive ? (
              <LogOut size={28} color="#EF4444" />
            ) : (
              <AlertCircle size={28} color="#F59E0B" />
            )}
          </View>
        );
      default:
        return (
          <View style={[styles.iconOrb, styles.iconOrbBlue]}>
            <Info size={28} color="#38BDF8" />
          </View>
        );
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onCancel || onConfirm}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {/* Close X button top right */}
              {onCancel ? (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onCancel}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              ) : null}

              {/* Icon Orb */}
              <View style={styles.iconContainer}>{renderIcon()}</View>

              {/* Title & Message */}
              <Text style={styles.titleText}>{title}</Text>
              <Text style={styles.messageText}>{message}</Text>

              {/* Action Buttons */}
              <View style={styles.btnRow}>
                {cancelText && onCancel ? (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={onCancel}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelBtnText}>{cancelText}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    isDestructive && styles.destructiveBtn,
                    !cancelText && { flex: 1 },
                  ]}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  {type === "insufficient_balance" ? (
                    <PlusCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : null}
                  <Text style={styles.confirmBtnText}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "90%",
    backgroundColor: "#0F172A", // Luxury obsidian slate
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: "center",
  },
  iconOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  iconOrbPink: {
    backgroundColor: "rgba(200, 45, 117, 0.15)",
    borderColor: "rgba(244, 114, 182, 0.4)",
  },
  iconOrbGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  iconOrbRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  iconOrbAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  iconOrbBlue: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  titleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#CBD5E1",
  },
  confirmBtn: {
    flex: 1.2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  destructiveBtn: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
});
