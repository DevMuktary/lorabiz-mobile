import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { X, Sparkles } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { getLastDismissedPromoId, setLastDismissedPromoId } from "../lib/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// Narrower horizontally and taller vertically (Flyer portrait aspect ratio)
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 64, 290);
const MODAL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.62, 450);

export interface PromoPopupData {
  id: string;
  tag?: string;
  title: string;
  desc: string;
  cta?: string;
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
  const [imageLoaded, setImageLoaded] = useState(false);
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
    let isCancelled = false;

    if (!banner || !banner.isActive) {
      setIsVisible(false);
      return;
    }

    const checkAndShow = async () => {
      const frequency = banner.frequency || "ALWAYS";

      // Check session dismissal (only if configured for ONCE_PER_SESSION)
      if (frequency === "ONCE_PER_SESSION") {
        if (sessionDismissedPromoIds.has(banner.id)) {
          setIsVisible(false);
          return;
        }
      } else if (frequency === "ONCE_UNTIL_DISMISSED") {
        // Check persistent dismissal (only if configured for ONCE_UNTIL_DISMISSED)
        try {
          const dismissedId = await getLastDismissedPromoId();
          if (dismissedId === banner.id) {
            setIsVisible(false);
            return;
          }
        } catch {}
      }
      // If frequency is ALWAYS, it is never blocked and shows as requested

      // If graphic flyer mode (has imageUrl), prefetch image
      if (banner.imageUrl) {
        try {
          const prefetchPromise = ExpoImage.prefetch(banner.imageUrl, "memory-disk");
          const timeoutPromise = new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 3000)
          );
          await Promise.race([prefetchPromise, timeoutPromise]);
        } catch {}
      }

      if (!isCancelled) {
        showModal();
      }
    };

    checkAndShow();

    return () => {
      isCancelled = true;
    };
  }, [banner, showModal]);

  const handleDismiss = async () => {
    if (banner) {
      const frequency = banner.frequency || "ALWAYS";
      if (frequency === "ONCE_PER_SESSION") {
        sessionDismissedPromoIds.add(banner.id);
      } else if (frequency === "ONCE_UNTIL_DISMISSED") {
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

  const cardBgColor = banner.color || "#4C1D95";
  const btnAccent = banner.accent || "#FBBF24";
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
              width: MODAL_WIDTH,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {banner.imageUrl ? (
            /* Pure Graphic Flyer Mode: Entire flyer is clickable with destination route */
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handlePressCta}
              style={[
                styles.pureFlyerWrapper,
                { width: MODAL_WIDTH, height: MODAL_HEIGHT },
              ]}
            >
              <ExpoImage
                source={{ uri: banner.imageUrl }}
                style={{
                  width: MODAL_WIDTH,
                  height: MODAL_HEIGHT,
                  borderRadius: 22,
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                onLoad={() => setImageLoaded(true)}
              />

              {!imageLoaded && (
                <View
                  style={[
                    styles.imageLoadingOverlay,
                    { width: MODAL_WIDTH, height: MODAL_HEIGHT },
                  ]}
                >
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            /* Fallback Typography Card (When no graphic flyer image is uploaded) */
            <View style={[styles.cardContainer, { backgroundColor: cardBgColor }]}>
              {banner.tag ? (
                <View style={styles.ribbonWrapper}>
                  <View style={[styles.ribbonBadge, { backgroundColor: btnAccent }]}>
                    <Text style={[styles.ribbonText, { color: btnTextColor }]}>
                      {banner.tag.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.headerArea}>
                <Text style={styles.titleText}>{banner.title}</Text>
              </View>

              <View style={styles.defaultArtworkWrap}>
                <View style={[styles.haloCircle, { backgroundColor: `${btnAccent}25` }]}>
                  <View style={[styles.innerCircle, { backgroundColor: btnAccent }]}>
                    <Sparkles size={36} color={btnTextColor} />
                  </View>
                </View>
              </View>

              {banner.desc ? (
                <View style={styles.bottomDescArea}>
                  <Text style={styles.descText} numberOfLines={4}>
                    {banner.desc.replace(/<[^>]*>?/gm, "")}
                  </Text>
                </View>
              ) : null}

              <View style={styles.footerArea}>
                <TouchableOpacity
                  style={[styles.ctaButton, { backgroundColor: btnAccent }]}
                  onPress={handlePressCta}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.ctaButtonText, { color: btnTextColor }]}>
                    {banner.cta || "Explore Now"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Centered Floating (X) Close Button Below Flyer */}
          <TouchableOpacity
            style={styles.floatingCloseBtn}
            onPress={handleDismiss}
            activeOpacity={0.75}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
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
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContentWrapper: {
    width: Math.min(SCREEN_WIDTH - 44, 335),
    alignItems: "center",
  },
  pureFlyerWrapper: {
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 16,
    backgroundColor: "#18181B",
    position: "relative",
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 22,
  },
  cardContainer: {
    width: "100%",
    minHeight: 440,
    maxHeight: SCREEN_HEIGHT * 0.82,
    borderRadius: 22,
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
    justifyContent: "space-between",
  },
  ribbonWrapper: {
    alignItems: "center",
    marginBottom: 8,
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
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 21,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.4,
    lineHeight: 27,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bottomDescArea: {
    width: "100%",
    paddingHorizontal: 6,
    marginTop: 4,
    marginBottom: 10,
    alignItems: "center",
  },
  descText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.92)",
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
  },
  imageWrap: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  defaultArtworkWrap: {
    width: "100%",
    height: 150,
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
    marginTop: 4,
  },
  ctaButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 28, // Round pill button
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
    marginTop: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
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
