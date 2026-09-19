import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Image,
  Easing,
} from "react-native";
import { colors } from "../constants/theme";

interface BrandLoaderProps {
  visible?: boolean;
  message?: string;
  inline?: boolean;
}

export default function BrandLoader({ visible = true, message, inline = false }: BrandLoaderProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Gentle logo pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.96,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Orbiting ring rotation
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    rotateLoop.start();

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
    };
  }, [visible, pulseAnim, rotateAnim]);

  if (!visible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const content = (
    <View style={inline ? styles.inlineContainer : styles.overlay}>
      <View style={styles.transparentBox}>
        <View style={styles.logoWrapper}>
          {/* Orbiting Spinner Ring */}
          <Animated.View
            style={[
              styles.spinnerRing,
              { transform: [{ rotate: spin }] },
            ]}
          />

          {/* Brand Logo with Gentle Pulse (Zero Background Square / Box) */}
          <Animated.View
            style={[
              styles.logoBox,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Image
              source={require("../assets/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {message ? (
          <Text style={styles.messageText}>{message}</Text>
        ) : null}
      </View>
    </View>
  );

  if (inline) {
    return content;
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  inlineContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },
  transparentBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  logoWrapper: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  spinnerRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  logoBox: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  messageText: {
    marginTop: 16,
    fontSize: 13.5,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
    letterSpacing: 0.2,
  },
});
