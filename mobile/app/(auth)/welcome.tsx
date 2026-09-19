import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";
import { colors } from "../../constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Full-bleed 3D Designed Architectural Scene strictly locked to screen bounds */}
      <Image
        source={require("../../assets/welcome-hero.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Foreground Container with deterministic Safe Area Inset positioning */}
      <View
        style={[
          styles.contentOverlay,
          {
            paddingTop: Math.max(insets.top, 24) + 8,
            paddingBottom: Math.max(insets.bottom, 20) + 12,
          },
        ]}
      >
        {/* Top Branding Header standing directly on the architectural grid wall */}
        <View style={styles.topHeader}>
          <Image
            source={require("../../assets/logo-pink.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>

        {/* Center Space allowing full view of the complete 3D phone mockup & podiums */}
        <View style={styles.centerSpace} />

        {/* Bottom Call to Actions & Trust Info standing directly on the marble terrazzo floor */}
        <View style={styles.bottomSection}>
          {/* Primary CTA: Get Started */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          {/* Secondary CTA: Log in */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Log in</Text>
          </TouchableOpacity>

          {/* Trust Footnote & App Version */}
          <View style={styles.footerInfo}>
            <View style={styles.trustBadgeRow}>
              <ShieldCheck size={14} color="#475569" />
              <Text style={styles.trustText}>
                Business & Identity Infrastructure
              </Text>
            </View>
            <Text style={styles.versionText}>v1.0.0</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    overflow: "hidden",
    backgroundColor: "#FAF8F5",
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  contentOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  topHeader: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  brandLogo: {
    width: 140,
    height: 52,
  },
  centerSpace: {
    flex: 1,
  },
  bottomSection: {
    width: "100%",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 14,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  footerInfo: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  trustBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  trustText: {
    fontSize: 12,
    color: "#475569",
    marginLeft: 6,
    fontWeight: "600",
  },
  versionText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.5,
  },
});




