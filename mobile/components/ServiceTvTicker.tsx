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
}

export default function ServiceTvTicker({
  serviceKey,
  fallbackText,
  containerStyle,
}: ServiceTvTickerProps) {
  // Guaranteed default text so the ticker is NEVER blank or hidden
  const defaultText = fallbackText || DEFAULT_SERVICE_TICKERS[serviceKey] || DEFAULT_SERVICE_TICKERS.GLOBAL;
  
  const [textWidth, setTextWidth] = useState<number>(defaultText.length * 8);

  // Fetch ticker config from API (allows Admin to update or disable)
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
    staleTime: 1000 * 60 * 5,
  });

  // Check if admin explicitly disabled this ticker
  if (tickerData && tickerData.isActive === false) {
    return null;
  }

  const displayText = tickerData?.tickerText || defaultText;
  const durationSeconds = tickerData?.speed || 24;

  const animatedTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!displayText || textWidth <= 0) return;

    // Total distance of one segment plus separator spacer
    const distance = textWidth + 80;
    animatedTranslate.setValue(0);

    const animation = Animated.loop(
      Animated.timing(animatedTranslate, {
        toValue: -distance,
        duration: Math.max(8000, durationSeconds * 1000),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();
  }, [displayText, textWidth, durationSeconds, animatedTranslate]);

  return (
    <View style={[styles.tickerBar, containerStyle]}>
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
    </View>
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
    width: 5000, // Large fixed width to prevent clipping
  },
  textWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    width: 80,
  },
  tickerText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary, // Clean Lorabiz primary #C82D75
    letterSpacing: 0.3,
  },
});
