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
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { colors } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_SERVICE_TICKERS: Record<string, string> = {
  CAC_BUSINESS_NAME:
    "CAC Business Name Guidelines: Ensure proprietor details match your NIN / BVN records. Upload clear passport photo with plain background. Filing turnaround: 1 – 48 Working Hours.",
  CAC_LLC:
    "Company LLC Guidelines: Minimum 2 directors/shareholders required. Total share capital allocation must equal 100%. Filing turnaround: 1 – 48 Working Hours.",
  SCUML:
    "SCUML Compliance Requirements: Ensure CAC Certificate, Status Report, and Bank Statement/Utility bill are uploaded in high resolution. Turnaround: 1 – 72 Working Hours.",
  NIN_SLIP:
    "NIN Slip Notice: High-resolution Standard and Premium slips generated instantly. Ensure 11-digit NIN is correct before submitting.",
  BVN_SLIP:
    "BVN Slip Notice: Requires registered phone number or 11-digit BVN. Instant verified slip generation available 24/7.",
  TAX_ID:
    "Tax ID (TIN) Notice: Provide registered business RC or proprietor NIN. JTB validation processed within 1 – 24 Working Hours.",
  NIN_VALIDATION:
    "NIN Validation Notice: Verify identity records against the national database. Instant validation turnaround: 1 – 24 Working Hours.",
  NIN_IPE:
    "IPE Clearance Notice: Ensure your NIMC Enrollment Tracking ID is accurate. Processing turnaround: 24 – 72 Working Hours.",
  NIN_MODIFICATION:
    "NIN Modification Notice: Correction of Name, Date of Birth, Address, or Phone Number. Processing turnaround: 1 – 48 Working Hours.",
  NIN_PERSONALIZATION:
    "NIN Personalization Notice: Link and personalize your tracking slip with verified records. Turnaround: 1 – 24 Working Hours.",
  BVN_RETRIEVAL:
    "BVN Retrieval Notice: Retrieve missing or forgotten 11-digit BVN securely using verified personal records. Turnaround: 1 – 24 Working Hours.",
  BVN_MODIFICATION:
    "BVN Modification Notice: Update name, date of birth, or phone details linked to your BVN. Turnaround: 1 – 48 Working Hours.",
  ANNUAL_RETURNS:
    "CAC Annual Returns Notice: File company or business annual returns to maintain active standing on the CAC portal. Turnaround: 1 – 48 Working Hours.",
  GLOBAL:
    "Lorabiz Fast-Track System: All registration and verification operations are active. Turnaround is 1 – 48 Working Hours.",
};

interface ServiceTickerData {
  id: string;
  serviceKey: string;
  serviceName: string;
  tickerText: string;
  isActive: boolean;
  speed: number;
  bgColor?: string;
  textColor?: string;
}

interface ServiceTvTickerProps {
  serviceKey: string;
  fallbackText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  visible?: boolean;
}

export default function ServiceTvTicker({
  serviceKey,
  fallbackText,
  containerStyle,
  visible = true,
}: ServiceTvTickerProps) {
  // Guaranteed default text so the ticker is NEVER blank or hidden
  const defaultText =
    fallbackText || DEFAULT_SERVICE_TICKERS[serviceKey] || DEFAULT_SERVICE_TICKERS.GLOBAL;

  const [textWidth, setTextWidth] = useState<number>(defaultText.length * 8);

  // Fetch ticker config from API (allows Admin to update or disable)
  const { data: tickerData } = useQuery({
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
  });

  // Animated values
  // Starts at SCREEN_WIDTH so it emerges from the right edge with space to the left
  const animatedTranslate = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loopAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const displayText = tickerData?.tickerText || defaultText;
  const durationSeconds = tickerData?.speed || 24;

  useEffect(() => {
    if (!visible) return;

    // Smooth fade-in when becoming visible
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    if (!displayText || textWidth <= 0) return;

    // Spacer between repeats (at least 120px)
    const spacerWidth = Math.max(120, Math.round(SCREEN_WIDTH * 0.35));
    const cycleDistance = textWidth + spacerWidth;

    // Calculate steady reading speed (pixels per second)
    const pps = Math.max(30, Math.min(65, cycleDistance / Math.max(8, durationSeconds)));
    const firstRunDistance = SCREEN_WIDTH + cycleDistance;
    const firstRunDuration = (firstRunDistance / pps) * 1000;
    const loopDuration = (cycleDistance / pps) * 1000;

    // Clean up previous animations if any
    if (loopAnimRef.current) {
      loopAnimRef.current.stop();
      loopAnimRef.current = null;
    }

    // Start from the right edge (SCREEN_WIDTH)
    animatedTranslate.setValue(SCREEN_WIDTH);

    // Initial pass: slides cleanly from the right edge across the screen
    const firstRunAnim = Animated.timing(animatedTranslate, {
      toValue: -cycleDistance,
      duration: Math.max(7000, firstRunDuration),
      easing: Easing.linear,
      useNativeDriver: true,
    });

    firstRunAnim.start(({ finished }) => {
      if (!finished) return;

      // Transition to continuous infinite loop from 0 to -cycleDistance
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
  }, [visible, displayText, textWidth, durationSeconds, animatedTranslate, fadeAnim]);

  // Check if admin explicitly disabled this ticker or visible prop is false
  if (!visible || (tickerData && tickerData.isActive === false)) {
    return null;
  }

  return (
    <Animated.View style={[styles.tickerBar, { opacity: fadeAnim }, containerStyle]}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.sliderRow,
            {
              transform: [{ translateX: animatedTranslate }],
            },
          ]}
        >
          {/* First Text Segment */}
          <View
            style={styles.textWrap}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - textWidth) > 5) {
                setTextWidth(w);
              }
            }}
          >
            <Text numberOfLines={1} style={styles.tickerText}>
              {displayText}
            </Text>
          </View>

          {/* Spacer Between Loops */}
          <View style={styles.spacer} />

          {/* Second Duplicate Text Segment for Continuous Infinite Seamless Sliding */}
          <View style={styles.textWrap}>
            <Text numberOfLines={1} style={styles.tickerText}>
              {displayText}
            </Text>
          </View>

          <View style={styles.spacer} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tickerBar: {
    width: "100%",
    height: 30,
    backgroundColor: "rgba(200, 45, 117, 0.05)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.15)",
    overflow: "hidden",
    justifyContent: "center",
  },
  track: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    width: 6000, // Large fixed width to prevent clipping
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
    color: colors.primary, // Clean Lorabiz primary #C82D75
    letterSpacing: 0.3,
  },
});
