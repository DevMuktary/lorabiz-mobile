import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Modal,
  Dimensions,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Tv, X, AlertCircle } from "lucide-react-native";
import { colors } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ServiceTickerData {
  id: string;
  serviceKey: string;
  serviceName: string;
  tickerText: string;
  isActive: boolean;
  speed: number;
  badgeText: string;
  bgColor: string;
  textColor: string;
}

interface ServiceTvTickerProps {
  serviceKey: string;
  fallbackText?: string;
  defaultBadge?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function ServiceTvTicker({
  serviceKey,
  fallbackText,
  defaultBadge = "STEP 2 NOTICE",
  containerStyle,
}: ServiceTvTickerProps) {
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 32);
  const [textWidth, setTextWidth] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Fetch ticker config from API
  const { data: tickerData } = useQuery({
    queryKey: ["serviceTicker", serviceKey],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/service-tickers?serviceKey=${encodeURIComponent(serviceKey)}`);
        return res?.ticker as ServiceTickerData | null;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const ticker = tickerData;
  const isEnabled = ticker ? ticker.isActive : !!fallbackText;
  const displayText = ticker?.tickerText || fallbackText || "";
  const badgeLabel = ticker?.badgeText || defaultBadge;
  const bgColor = ticker?.bgColor || "#1E1B4B";
  const textColor = ticker?.textColor || "#FFFFFF";
  const durationSeconds = ticker?.speed || 25;

  // Animated translation for marquee effect
  const animatedTranslate = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the LIVE / NOTICE dot
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  // Infinite marquee sliding animation
  useEffect(() => {
    if (!isEnabled || !displayText || textWidth === 0) return;

    // The distance to translate is the full width of one text block + spacer
    const distance = textWidth + 40;
    animatedTranslate.setValue(0);

    const animation = Animated.loop(
      Animated.timing(animatedTranslate, {
        toValue: -distance,
        duration: Math.max(10000, durationSeconds * 1000),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();
  }, [isEnabled, displayText, textWidth, durationSeconds, animatedTranslate]);

  if (!isEnabled || !displayText.trim()) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setIsModalVisible(true)}
        style={[styles.wrapper, containerStyle]}
      >
        <View
          style={[styles.container, { backgroundColor: bgColor }]}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setContainerWidth(w);
          }}
        >
          {/* TV Badge Pill */}
          <View style={styles.badgePill}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
            <Tv size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>

          {/* Sliding Marquee Track */}
          <View style={styles.marqueeTrack}>
            <Animated.View
              style={[
                styles.marqueeContent,
                {
                  transform: [{ translateX: animatedTranslate }],
                },
              ]}
            >
              {/* Primary Text Segment */}
              <View
                style={styles.textSegment}
                onLayout={(e) => {
                  const tw = e.nativeEvent.layout.width;
                  if (tw > 0 && tw !== textWidth) {
                    setTextWidth(tw);
                  }
                }}
              >
                <Text style={[styles.tickerText, { color: textColor }]}>
                  {displayText}
                </Text>
              </View>

              {/* Seamless Duplicate Segment for Seamless Continuous Sliding */}
              <View style={styles.textSegment}>
                <Text style={[styles.tickerText, { color: textColor }]}>
                  {displayText}
                </Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Read Notice Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <AlertCircle size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>{badgeLabel}</Text>
                  <Text style={styles.modalSubtitle}>Important Filing Guidance</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>{displayText}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={styles.modalDoneBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDoneBtnText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary, // #C82D75
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    marginRight: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  marqueeTrack: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "center",
    height: "100%",
  },
  marqueeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  textSegment: {
    paddingRight: 40,
    flexDirection: "row",
    alignItems: "center",
  },
  tickerText: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(200, 45, 117, 0.10)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
  },
  modalBody: {
    paddingVertical: 8,
    marginBottom: 18,
  },
  modalText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
