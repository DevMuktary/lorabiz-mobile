import React, { useState, useEffect } from "react";
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
}

interface PromoPopupModalProps {
  banner: PromoPopupData | null;
  onDismiss?: () => void;
}

export default function PromoPopupModal({ banner, onDismiss }: PromoPopupModalProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    if (!banner || !banner.isActive) {
      setIsVisible(false);
      return;
    }

    // Check if user has already dismissed this specific promo in this session/device
    getLastDismissedPromoId()
      .then((dismissedId: string | null) => {
        if (dismissedId !== banner.id) {
          setIsVisible(true);
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 8,
              tension: 65,
              useNativeDriver: true,
            }),
          ]).start();
        }
      })
      .catch(() => {
        setIsVisible(true);
      });
  }, [banner]);

  const handleDismiss = async () => {
    if (banner) {
      try {
        await setLastDismissedPromoId(banner.id);
      } catch {}
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.92,
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
      if (banner.route.startsWith("http")) {
        router.push(banner.route as any);
      } else {
        router.push(banner.route as any);
      }
    }
  };

  if (!isVisible || !banner) return null;

  const bgColor = banner.color || (isDark ? "#1E1B4B" : "#831843");
  const accentColor = banner.accent || "#F472B6";
  const btnTextColor = banner.btnTextColor || "#FFFFFF";

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />

        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              backgroundColor: bgColor,
            },
          ]}
        >
          {/* Top Close Icon */}
          <TouchableOpacity
            style={styles.topCloseBtn}
            onPress={handleDismiss}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={styles.closeIconCircle}>
              <X size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Optional Mascot / Graphic Artwork Area */}
          {banner.imageUrl ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: banner.imageUrl }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.mascotBadgeContainer}>
              <View style={[styles.mascotHalo, { backgroundColor: `${accentColor}33` }]}>
                <View style={[styles.mascotCircle, { backgroundColor: accentColor }]}>
                  <Sparkles size={28} color="#FFFFFF" />
                </View>
              </View>
            </View>
          )}

          {/* Content Body */}
          <View style={styles.contentPadding}>
            {/* Tag Badge */}
            {banner.tag ? (
              <View style={[styles.tagBadge, { backgroundColor: "rgba(255, 255, 255, 0.15)" }]}>
                <Text style={[styles.tagBadgeText, { color: accentColor }]}>
                  {banner.tag.toUpperCase()}
                </Text>
              </View>
            ) : null}

            {/* Title */}
            <Text style={styles.titleText}>{banner.title}</Text>

            {/* Description */}
            <Text style={styles.descText}>{banner.desc}</Text>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: accentColor }]}
              onPress={handlePressCta}
              activeOpacity={0.88}
            >
              <Text style={[styles.ctaButtonText, { color: btnTextColor }]}>
                {banner.cta || "Check It Out"}
              </Text>
              <ArrowRight size={17} color={btnTextColor} style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* Bottom Exit Button */}
            <TouchableOpacity
              style={styles.bottomExitBtn}
              onPress={handleDismiss}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={styles.bottomExitText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: Math.min(SCREEN_WIDTH - 40, 360),
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  topCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
  },
  closeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    width: "100%",
    height: 160,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  mascotBadgeContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 28,
    paddingBottom: 4,
  },
  mascotHalo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mascotCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  contentPadding: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: "center",
  },
  tagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 25,
    marginBottom: 8,
  },
  descText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  ctaButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  bottomExitBtn: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  bottomExitText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.65)",
    textDecorationLine: "underline",
  },
});
