import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, X } from "lucide-react-native";
import { api } from "../lib/api";
import { colors } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_SERVICE_TICKERS: Record<string, { text: string; badge: string }> = {
  CAC_BUSINESS_NAME: {
    text: "CAC Business Name Guidelines: Ensure proprietor details match your NIN / BVN records. Upload clear passport photo with plain background. Filing turnaround: 1 – 48 Working Hours.",
    badge: "GUIDELINES",
  },
  CAC_LLC: {
    text: "Company LLC Guidelines: Minimum 2 directors/shareholders required. Total share capital allocation must equal 100%. Filing turnaround: 1 – 48 Working Hours.",
    badge: "DIRECTOR NOTICE",
  },
  SCUML: {
    text: "SCUML Compliance Requirements: Ensure CAC Certificate, Status Report, and Bank Statement/Utility bill are uploaded in high resolution. Turnaround: 1 – 72 Working Hours.",
    badge: "COMPLIANCE",
  },
  NIN_SLIP: {
    text: "NIN Slip Notice: High-resolution Standard and Premium slips generated instantly. Ensure 11-digit NIN is correct before submitting.",
    badge: "SLIP NOTICE",
  },
  BVN_SLIP: {
    text: "BVN Slip Notice: Requires registered phone number or 11-digit BVN. Instant verified slip generation available 24/7.",
    badge: "BVN NOTICE",
  },
  TAX_ID: {
    text: "Tax ID (TIN) Notice: Provide registered business RC or proprietor NIN. JTB validation processed within 1 – 24 Working Hours.",
    badge: "TAX NOTICE",
  },
  NIN_VALIDATION: {
    text: "NIN Validation Notice: Verify identity records against the national database. Instant validation turnaround: 1 – 24 Working Hours.",
    badge: "VALIDATION",
  },
  NIN_IPE: {
    text: "IPE Clearance Notice: Ensure your NIMC Enrollment Tracking ID is accurate. Processing turnaround: 24 – 72 Working Hours.",
    badge: "CLEARANCE",
  },
  NIN_MODIFICATION: {
    text: "NIN Modification Notice: Correction of Name, Date of Birth, Address, or Phone Number. Processing turnaround: 1 – 48 Working Hours.",
    badge: "MODIFICATION",
  },
  NIN_PERSONALIZATION: {
    text: "NIN Personalization Notice: Link and personalize your tracking slip with verified records. Turnaround: 1 – 24 Working Hours.",
    badge: "PERSONALIZATION",
  },
  BVN_RETRIEVAL: {
    text: "BVN Retrieval Notice: Retrieve missing or forgotten 11-digit BVN securely using verified personal records. Turnaround: 1 – 24 Working Hours.",
    badge: "RETRIEVAL",
  },
  BVN_MODIFICATION: {
    text: "BVN Modification Notice: Update name, date of birth, or phone details linked to your BVN. Turnaround: 1 – 48 Working Hours.",
    badge: "MODIFICATION",
  },
  ANNUAL_RETURNS: {
    text: "CAC Annual Returns Notice: File company or business annual returns to maintain active standing on the CAC portal. Turnaround: 1 – 48 Working Hours.",
    badge: "ANNUAL RETURNS",
  },
  GLOBAL: {
    text: "Lorabiz Fast-Track System: All registration and verification operations are active. Turnaround is 1 – 48 Working Hours.",
    badge: "LIVE NOTICE",
  },
};

interface ServiceTickerData {
  id: string;
  serviceKey: string;
  serviceName: string;
  tickerText: string;
  isActive: boolean;
  speed: number;
  badgeText?: string;
  bgColor?: string;
  textColor?: string;
}

interface ServiceTvTickerProps {
  serviceKey: string;
  fallbackText?: string;
  defaultBadge?: string;
  containerStyle?: StyleProp<ViewStyle>;
  visible?: boolean;
}

export default function ServiceTvTicker({
  serviceKey,
  fallbackText,
  defaultBadge,
  containerStyle,
  visible = true,
}: ServiceTvTickerProps) {
  const { colors: themeColors, isDark } = useTheme();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const defaultItem = DEFAULT_SERVICE_TICKERS[serviceKey] || DEFAULT_SERVICE_TICKERS.GLOBAL;
  const defaultText = fallbackText || defaultItem.text;
  const initialBadge = defaultBadge || defaultItem.badge;

  const [textWidth, setTextWidth] = useState<number>(defaultText.length * 8);

  // Fetch ticker config from API
  const { data: tickerData, isLoading } = useQuery({
    queryKey: ["serviceTicker", serviceKey],
    queryFn: async () => {
      try {
        const res = await api.get(
          `/api/service-tickers?serviceKey=${encodeURIComponent(serviceKey)}`
        );
        return res?.ticker as ServiceTickerData | null;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });

  const displayText = tickerData?.tickerText || defaultText;
  const badgeLabel = tickerData?.badgeText || initialBadge;
  const durationSeconds = tickerData?.speed || 24;

  // Marquee translation animation: Start at 0 so text is IMMEDIATELY visible at the edge
  const animatedTranslate = useRef(new Animated.Value(0)).current;
  const loopAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Infinite marquee sliding animation
  useEffect(() => {
    if (!visible || !displayText || textWidth <= 0) return;

    const spacerWidth = Math.max(120, Math.round(SCREEN_WIDTH * 0.35));
    const cycleDistance = textWidth + spacerWidth;
    const pps = Math.max(30, Math.min(65, cycleDistance / Math.max(8, durationSeconds)));
    const loopDuration = (cycleDistance / pps) * 1000;

    if (loopAnimRef.current) {
      loopAnimRef.current.stop();
      loopAnimRef.current = null;
    }

    animatedTranslate.setValue(0);

    // Initial run: Give user 1.2s to easily read the beginning upon landing on the page, then scroll
    const firstRunAnim = Animated.sequence([
      Animated.delay(1200),
      Animated.timing(animatedTranslate, {
        toValue: -cycleDistance,
        duration: Math.max(6000, loopDuration),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);

    firstRunAnim.start(({ finished }) => {
      if (!finished) return;

      animatedTranslate.setValue(0);
      const loop = Animated.loop(
        Animated.timing(animatedTranslate, {
          toValue: -cycleDistance,
          duration: Math.max(6000, loopDuration),
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopAnimRef.current = loop;
      loop.start();
    });

    return () => {
      firstRunAnim.stop();
      if (loopAnimRef.current) {
        loopAnimRef.current.stop();
      }
    };
  }, [visible, displayText, textWidth, durationSeconds, animatedTranslate]);

  // Only render when ticker is explicitly loaded and confirmed active by the backend.
  // Never flash default placeholder while loading or when disabled by admin.
  if (!visible || isLoading || !tickerData || tickerData.isActive === false) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setIsModalVisible(true)}
        style={[styles.wrapper, containerStyle]}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? "rgba(200, 45, 117, 0.10)" : "rgba(200, 45, 117, 0.05)",
              borderColor: isDark ? "rgba(200, 45, 117, 0.24)" : "rgba(200, 45, 117, 0.16)",
            },
          ]}
        >
          {/* Sliding Marquee Track (Full Width Slim Bar) */}
          <View style={styles.marqueeTrack}>
            <Animated.View
              style={[
                styles.sliderRow,
                {
                  transform: [{ translateX: animatedTranslate }],
                },
              ]}
            >
              {/* Primary Text Segment */}
              <View
                style={styles.textWrap}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0 && Math.abs(w - textWidth) > 5) {
                    setTextWidth(w);
                  }
                }}
              >
                <Text numberOfLines={1} style={[styles.tickerText, { color: themeColors.text }]}>
                  {displayText}
                </Text>
              </View>

              <View style={styles.spacer} />

              {/* Duplicate Text Segment for Continuous Infinite Seamless Sliding */}
              <View style={styles.textWrap}>
                <Text numberOfLines={1} style={[styles.tickerText, { color: themeColors.text }]}>
                  {displayText}
                </Text>
              </View>

              <View style={styles.spacer} />
            </Animated.View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Read Notice Guidance Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: themeColors.surfaceElevated,
                borderColor: themeColors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <AlertCircle size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: themeColors.text }]}>{badgeLabel}</Text>
                  <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                    Important Service Guidance
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalText, { color: themeColors.text }]}>{displayText}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={styles.modalDoneBtn}
              activeOpacity={0.88}
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
    width: "100%",
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    borderRadius: 8,
    paddingHorizontal: 10,
    overflow: "hidden",
    borderWidth: 1,
  },
  marqueeTrack: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "center",
    height: "100%",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    width: 6000,
  },
  textWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    width: Math.max(120, Math.round(SCREEN_WIDTH * 0.35)),
  },
  tickerText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 45, 117, 0.15)",
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(200, 45, 117, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    paddingVertical: 6,
    marginBottom: 18,
  },
  modalText: {
    fontSize: 13.5,
    lineHeight: 21,
    fontWeight: "400",
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  modalDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
