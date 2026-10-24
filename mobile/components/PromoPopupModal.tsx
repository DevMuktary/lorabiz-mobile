import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { X, Sparkles, ArrowRight } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { getLastDismissedPromoId, setLastDismissedPromoId } from "../lib/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface PromoPopupData {
  id: string;
  tag?: string;
  title: string;
  desc: string;
  cta: string;
  route: string;
  color?: string;
  accent?: string;
  btnTextColor?: string;
  imageUrl?: string | null;
  isActive: boolean;
  target?: string;
  frequency?: "ALWAYS" | "ONCE_PER_SESSION" | "ONCE_UNTIL_DISMISSED" | string;
}

interface PromoPopupModalProps {
  banner: PromoPopupData | null;
  onDismiss?: () => void;
}

// In-memory set for ONCE_PER_SESSION persistence
const sessionDismissedPromoIds = new Set<string>();

export default function PromoPopupModal({ banner, onDismiss }: PromoPopupModalProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.85));

  const showModal = useCallback(() => {
    setIsVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    if (!banner || !banner.isActive) {
      setIsVisible(false);
      return;
    }

    const freq = banner.frequency || "ALWAYS";

    if (freq === "ONCE_PER_SESSION") {
      if (sessionDismissedPromoIds.has(banner.id)) {
        setIsVisible(false);
        return;
      }
      showModal();
    } else if (freq === "ONCE_UNTIL_DISMISSED") {
      getLastDismissedPromoId()
        .then((dismissedId: string | null) => {
          if (dismissedId !== banner.id) {
            showModal();
          } else {
            setIsVisible(false);
          }
        })
        .catch(() => {
          showModal();
        });
    } else {
      // "ALWAYS" mode: shows on launch / return
      showModal();
    }
  }, [banner, showModal]);

  const handleDismiss = async () => {
    const freq = banner?.frequency || "ALWAYS";

    if (banner) {
      if (freq === "ONCE_PER_SESSION") {
        sessionDismissedPromoIds.add(banner.id);
      } else if (freq === "ONCE_UNTIL_DISMISSED") {
        try {
          await setLastDismissedPromoId(banner.id);
        } catch {}
      }
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.88,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      if (onDismiss) onDismiss();
    });
  };

  const handlePressCta = async () => {
    await handleDismiss();
    if (banner?.route) {
      router.push(banner.route as any);
    }
  };

  if (!isVisible || !banner) return null;

  // Rich fintech PalmPay / OPay styling palette
  const cardBgColor = banner.color || "#4C1D95"; // Deep vibrant purple default
  const btnAccent = banner.accent || "#FBBF24"; // Rich gold default
  const btnTextColor = banner.btnTextColor || "#1E1B4B";

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        {/* Tap outside backdrop to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />

        {/* Modal Wrapper containing Card + Bottom Centered Floating (X) */}
        <Animated.View
          style={[
            styles.modalContentWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Main Promo Card */}
          <View style={[styles.cardContainer, { backgroundColor: cardBgColor }]}>
            {/* Top Ribbon Badge */}
            {banner.tag ? (
              <View style={styles.ribbonWrapper}>
                <View style={[styles.ribbonBadge, { backgroundColor: btnAccent }]}>
                  <Text style={[styles.ribbonText, { color: btnTextColor }]}>
                    {banner.tag.toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Subtitle & Title */}
            <View style={styles.headerArea}>
              <Text style={styles.titleText}>{banner.title}</Text>
              {banner.desc ? (
                <Text style={styles.descText} numberOfLines={3}>
                  {banner.desc}
                </Text>
              ) : null}
            </View>

            {/* Mascot / Promotion Artwork */}
            {banner.imageUrl ? (
              <View style={styles.imageWrap}>
                <Image
                  source={{ uri: banner.imageUrl }}
                  style={styles.bannerImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.defaultArtworkWrap}>
                <View style={[styles.haloCircle, { backgroundColor: `${btnAccent}25` }]}>
                  <View style={[styles.innerCircle, { backgroundColor: btnAccent }]}>
                    <Sparkles size={36} color={btnTextColor} />
                  </View>
                </View>
              </View>
            )}

            {/* Action Button ("Go Now" / "Register Now") */}
            <View style={styles.footerArea}>
              <TouchableOpacity
                style={[styles.ctaButton, { backgroundColor: btnAccent }]}
                onPress={handlePressCta}
                activeOpacity={0.88}
              >
                <Text style={[styles.ctaButtonText, { color: btnTextColor }]}>
                  {banner.cta || "Go Now"}
                </Text>
                <ArrowRight size={18} color={btnTextColor} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Centered Floating (X) Close Button Below Card (Iconic PalmPay/OPay layout) */}
          <TouchableOpacity
            style={styles.floatingCloseBtn}
            onPress={handleDismiss}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.74)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContentWrapper: {
    width: Math.min(SCREEN_WIDTH - 44, 340),
    alignItems: "center",
  },
  cardContainer: {
    width: "100%",
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  ribbonWrapper: {
    alignItems: "center",
    marginBottom: 10,
  },
  ribbonBadge: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  ribbonText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  headerArea: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  titleText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 6,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  descText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
  },
  imageWrap: {
    width: "100%",
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  defaultArtworkWrap: {
    width: "100%",
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  haloCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  footerArea: {
    width: "100%",
    marginTop: 10,
  },
  ctaButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 28, // Round pill button matching PalmPay style
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  floatingCloseBtn: {
    marginTop: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
});
