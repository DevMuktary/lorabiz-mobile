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
const LOGO_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.44), 180);
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * 0.95);

export default function IndexScreen() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();

  // Smooth entrance animation values (0 to 450ms)
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // State refs to prevent stale closure bugs
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  const minTimerFinished = useRef(false);
  const hasNavigated = useRef(false);

  const triggerNavigation = async () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    // Smooth subtle dissolve before screen handoff
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(async () => {
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
    });
  };

  useEffect(() => {
    // Quick, elegant brand mark reveal
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]).start();

    // Fast responsive presentation: 400ms (zero wait, zero white screen)
    const timer = setTimeout(() => {
      minTimerFinished.current = true;
      if (!isLoadingRef.current) {
        triggerNavigation();
      }
    }, 400);

    // Failsafe timer: App never hangs on splash
    const failsafe = setTimeout(() => {
      triggerNavigation();
    }, 1500);

    return () => {
      clearTimeout(timer);
      clearTimeout(failsafe);
    };
  }, []);

  // When auth check completes
  useEffect(() => {
    if (!isLoading && minTimerFinished.current) {
      triggerNavigation();
    }
  }, [isLoading]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#C82D75" translucent />

      {/* Centered Brand Mark on Signature Pink */}
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
          source={require("../assets/logo-white.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#C82D75", // Iconic Lorabiz Signature Pink
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    width: LOGO_WIDTH + 40,
    height: LOGO_HEIGHT + 40,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
