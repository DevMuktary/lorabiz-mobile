import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Easing,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { getSavedProfile } from "../lib/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Compact circle that fits snugly right around the logo (~148px)
const CIRCLE_SIZE = 148;
const LOGO_WIDTH = 112;
const LOGO_HEIGHT = 100;

export default function IndexScreen() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();

  // Animation values (GPU native driver for 60/120fps)
  // Starts snugly around the logo on the brand pink background, then expands outwards
  const circleScale = useRef(new Animated.Value(1)).current;
  const circleOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;

  // State refs to prevent stale closure bugs
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  const animationDone = useRef(false);
  const hasNavigated = useRef(false);

  const triggerNavigation = async () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    if (tokenRef.current) {
      if (userRef.current && userRef.current.isProfileComplete === false) {
        router.replace({
          pathname: "/(auth)/register",
          params: {
            fromGoogle: "true",
            googleFirstName: userRef.current.firstName || "",
            googleLastName: userRef.current.lastName || "",
            googleEmail: userRef.current.email || "",
          },
        });
      } else {
        router.replace("/(tabs)");
      }
    } else {
      try {
        const saved = await getSavedProfile();
        if (saved) {
          router.replace("/(auth)/login");
        } else {
          router.replace("/(auth)/welcome");
        }
      } catch {
        router.replace("/(auth)/welcome");
      }
    }
  };

  useEffect(() => {
    // Circle starts tightly around the logo and expands outwards smoothly across the viewport
    Animated.parallel([
      Animated.timing(circleScale, {
        toValue: 16,
        duration: 1500,
        delay: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1.15,
        duration: 1500,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      animationDone.current = true;
      if (!isLoadingRef.current) {
        triggerNavigation();
      }
    });

    // Seamless navigation handoff right as circle envelops screen
    const handoffTimer = setTimeout(() => {
      animationDone.current = true;
      if (!isLoadingRef.current) {
        triggerNavigation();
      }
    }, 1800);

    // Failsafe timer: App never hangs on splash
    const failsafeTimeout = setTimeout(() => {
      triggerNavigation();
    }, 3000);

    return () => {
      clearTimeout(handoffTimer);
      clearTimeout(failsafeTimeout);
    };
  }, []);

  // When auth finishes initializing after animation completes
  useEffect(() => {
    if (!isLoading && animationDone.current) {
      triggerNavigation();
    }
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#C82D75" />

      {/* The Expanding White Circle Mask (ALAT by Wema Style) */}
      <Animated.View
        style={[
          styles.whiteCircle,
          {
            opacity: circleOpacity,
            transform: [{ scale: circleScale }],
          },
        ]}
      />

      {/* Centered Brand Mark inside the circle (NEVER dissolves to blank white void) */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require("../assets/logo-pink.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#C82D75", // Iconic Lorabiz Signature Pink
    justifyContent: "center",
    alignItems: "center",
  },
  whiteCircle: {
    position: "absolute",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  logoContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  logoImage: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
