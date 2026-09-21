import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  StatusBar,
  Linking,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Wallet,
  Eye,
  EyeOff,
  PlusCircle,
  Clock,
  ChevronRight,
  Sparkles,
  Crown,
  LayoutGrid,
  Bell,
  Headphones,
  ArrowUpRight,
  ArrowDownLeft,
  WifiOff,
  CheckCircle2,
  X,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../constants/theme";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  getHideBalancePref,
  setHideBalancePref,
  getCachedWallet,
  saveCachedWallet,
  CachedWalletData,
} from "../../lib/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, wallet, refreshProfile } = useAuth();
  const [hideBalance, setHideBalance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const [cachedWallet, setCachedWallet] = useState<CachedWalletData | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const bannerScrollRef = useRef<ScrollView>(null);

  // Load persisted balance privacy preference and cached wallet on mount
  useEffect(() => {
    getHideBalancePref().then((savedPref) => {
      setHideBalance(savedPref);
    });
    getCachedWallet().then((cached) => {
      if (cached) setCachedWallet(cached);
    });
  }, []);

  const toggleHideBalance = async () => {
    const nextVal = !hideBalance;
    setHideBalance(nextVal);
    await setHideBalancePref(nextVal);
  };

  // Failsafe: Redirect incomplete profile users to finish registration details
  useEffect(() => {
    if (user && user.isProfileComplete === false) {
      router.replace({
        pathname: "/(auth)/register",
        params: {
          fromGoogle: "true",
          googleFirstName: user.firstName || "",
          googleLastName: user.lastName || "",
          googleEmail: user.email || "",
        },
      });
    }
  }, [user]);

  // 1. User Profile Query for accurate first name
  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/user/profile");
        setIsOffline(false);
        return res;
      } catch (err: any) {
        if (err?.message?.includes("internet connection") || err?.status === 0) {
          setIsOffline(true);
        }
        return null;
      }
    },
  });

  // 2. Dedicated Wallet Query
  const {
    data: walletData,
    refetch: refetchWallet,
    isFetching: isWalletFetching,
  } = useQuery({
    queryKey: ["mobileWallet"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/user/wallet");
        setIsOffline(false);
        return res;
      } catch (err: any) {
        if (err?.message?.includes("internet connection") || err?.status === 0) {
          setIsOffline(true);
        }
        return null;
      }
    },
  });

  // Automatically update cache whenever live balance is fetched
  useEffect(() => {
    const liveBal = walletData?.balance ?? walletData?.wallet?.balance;
    if (typeof liveBal === "number") {
      saveCachedWallet(liveBal);
      setCachedWallet({ balance: liveBal, lastUpdated: Date.now() });
      setIsOffline(false);
    }
  }, [walletData]);

  // 3. Transactions Query
  const { data: txData, refetch: refetchTx } = useQuery({
    queryKey: ["mobileRecentTransactions"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/user/transactions?limit=4");
        setIsOffline(false);
        return res;
      } catch (err: any) {
        if (err?.message?.includes("internet connection") || err?.status === 0) {
          setIsOffline(true);
        }
        return null;
      }
    },
  });

  // 4. Loyalty Profile Query
  const { data: loyaltyData, refetch: refetchLoyalty } = useQuery({
    queryKey: ["mobileLoyaltyProfile"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/user/loyalty");
        setIsOffline(false);
        return res;
      } catch (err: any) {
        if (err?.message?.includes("internet connection") || err?.status === 0) {
          setIsOffline(true);
        }
        return null;
      }
    },
  });

  // Unified Refresh Handler - immediately updates timestamp to now
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const now = Date.now();
    try {
      const results = await Promise.all([
        refreshProfile(),
        refetchProfile(),
        refetchWallet(),
        refetchTx(),
        refetchLoyalty(),
      ]);
      setIsOffline(false);
      const walletRes: any = results[2];
      const freshBalance = walletRes?.data?.balance ?? walletRes?.data?.wallet?.balance;
      if (typeof freshBalance === "number") {
        saveCachedWallet(freshBalance);
        setCachedWallet({ balance: freshBalance, lastUpdated: now });
      } else {
        setCachedWallet((prev) => (prev ? { ...prev, lastUpdated: now } : null));
      }
    } catch {
      // Keep previous cached state on network failure
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, refetchProfile, refetchWallet, refetchTx, refetchLoyalty]);

  // Focus effect: auto-refetch whenever user navigates back to dashboard
  useFocusEffect(
    useCallback(() => {
      refetchWallet();
      refetchProfile();
      refetchTx();
    }, [refetchWallet, refetchProfile, refetchTx])
  );

  // Derived Values - resilient to offline by falling back to cached balance
  const liveBalance = walletData?.balance ?? walletData?.wallet?.balance;
  const balance =
    typeof liveBalance === "number"
      ? liveBalance
      : (wallet?.balance ?? cachedWallet?.balance ?? user?.wallet?.balance ?? 0);

  const formatLastUpdated = (timestamp?: number) => {
    if (!timestamp) return "Live";
    const diffSec = Math.round((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return "Updated just now";
    const diffMins = Math.round(diffSec / 60);
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    const d = new Date(timestamp);
    return `Updated today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  };

  const rawTxList = txData?.transactions || [];
  const recentTransactions = Array.isArray(rawTxList) ? rawTxList.slice(0, 4) : [];

  // Accurate First Name extraction (Strictly no emojis)
  const rawName =
    profileData?.user?.firstName ||
    user?.firstName ||
    profileData?.user?.name ||
    user?.name ||
    profileData?.user?.email?.split("@")[0] ||
    user?.email?.split("@")[0] ||
    "";
  const firstName = rawName.split(" ")[0].trim();
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";
  const userInitial = (displayName?.[0] || user?.name?.[0] || "U").toUpperCase();
  const currentTierObj = loyaltyData?.profile?.currentTier || loyaltyData?.currentTier;
  const tierName = currentTierObj?.name || loyaltyData?.profile?.tier || "Gold";
  const tierColor =
    currentTierObj?.colorHex ||
    (tierName.toLowerCase().includes("silver")
      ? "#64748B"
      : tierName.toLowerCase().includes("platinum")
      ? "#0284C7"
      : tierName.toLowerCase().includes("bronze")
      ? "#B45309"
      : "#D97706");

  // Quick Services Grid: Strictly 4 items per row, 2 rows (8 items total)
  // Item 7 is Airtime, Item 8 is More
  const QUICK_SERVICES = [
    {
      id: "cac_reg",
      title: "CAC Reg",
      logo: require("../../assets/cac.png"),
      route: "/(tabs)/services",
    },
    {
      id: "nin_slip",
      title: "NIN Slip",
      logo: require("../../assets/nimc.png"),
      route: "/services/nin-slip",
    },
    {
      id: "bvn_slip",
      title: "BVN Slip",
      logo: require("../../assets/nibss.png"),
      route: "/services/bvn-slip",
    },
    {
      id: "tax_id",
      title: "Tax ID",
      logo: require("../../assets/nrs.png"),
      route: "/services/tax-id",
    },
    {
      id: "scuml",
      title: "SCUML",
      logo: require("../../assets/scuml.png"),
      route: "/services/scuml",
    },
    {
      id: "affidavit",
      title: "Affidavit",
      logo: require("../../assets/court.png"),
      route: "/(tabs)/services",
    },
    {
      id: "airtime",
      title: "Airtime",
      logo: require("../../assets/airtime.png"),
      route: "/(tabs)/bills",
    },
    {
      id: "more",
      title: "More",
      isMore: true,
      route: "/(tabs)/services",
    },
  ];

  // Promotional Announcements & Ads Carousel Data (Strictly NO emojis)
  const PROMO_ADS = [
    {
      id: "cac_promo",
      tag: "FAST-TRACK",
      title: "Register Your Business in 24h",
      desc: "Accredited CAC Certificate, Status Report and Tax ID delivered seamlessly.",
      cta: "Register Now",
      route: "/(tabs)/services",
      color: "#831843",
      accent: "#F472B6",
      btnTextColor: "#831843",
    },
    {
      id: "scuml_promo",
      tag: "COMPLIANCE",
      title: "Instant SCUML Processing",
      desc: "Open corporate bank accounts fast with certified AML compliance.",
      cta: "Apply for SCUML",
      route: "/(tabs)/services",
      color: "#1E1B4B",
      accent: "#818CF8",
      btnTextColor: "#1E1B4B",
    },
    {
      id: "affidavit_promo",
      tag: "LEGAL SEAL",
      title: "Certified Court Affidavits",
      desc: "Declaration of age, name change and loss of document sworn online.",
      cta: "Get Affidavit",
      route: "/(tabs)/services",
      color: "#064E3B",
      accent: "#34D399",
      btnTextColor: "#064E3B",
    },
  ];

  const isInteractingRef = useRef(false);
  const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time drag handler for instant indicator dot tracking
  const handleBannerScroll = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / BANNER_WIDTH);
    if (index >= 0 && index < PROMO_ADS.length && index !== activePromoIndex) {
      setActivePromoIndex(index);
    }
  };

  const handleMomentumScrollEnd = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / BANNER_WIDTH);
    if (index >= 0 && index < PROMO_ADS.length) {
      setActivePromoIndex(index);
    }
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 1000);
  };

  const handleScrollBeginDrag = () => {
    isInteractingRef.current = true;
  };

  const handleScrollEndDrag = () => {
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 1500);
  };

  const handleTouchStart = () => {
    isInteractingRef.current = true;
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 2000);
  };

  // Auto-sliding interval: strictly paused whenever user touches, holds, or drags
  useEffect(() => {
    autoSlideTimerRef.current = setInterval(() => {
      if (isInteractingRef.current) return;
      setActivePromoIndex((prev) => {
        const nextIndex = (prev + 1) % PROMO_ADS.length;
        bannerScrollRef.current?.scrollTo({ x: nextIndex * BANNER_WIDTH, animated: true });
        return nextIndex;
      });
    }, 5000);

    return () => {
      if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    };
  }, [PROMO_ADS.length]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* =================================================================== */}
      {/* 1. TOP APP BAR: Left Avatar + Tier Name + Greeting (NO EMOJIS) */}
      {/* =================================================================== */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.8}
          >
            <View style={[styles.avatarOrb, { borderColor: tierColor, borderWidth: 2 }]}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
            <View style={[styles.avatarTierBadge, { backgroundColor: tierColor }]}>
              <Crown size={9} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.greetingWrap}>
            <Text style={styles.greetingTitle}>
              Hi, {displayName ? `${displayName}` : "there"}
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => Linking.openURL("mailto:support@lorabiz.com")}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Headphones size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Bell size={20} color={colors.text} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) + 72 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* =================================================================== */}
        {/* PROMINENT HIGH-CONTRAST OFFLINE BANNER */}
        {/* =================================================================== */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <View style={styles.offlineIconWrap}>
              <WifiOff size={18} color="#DC2626" />
            </View>
            <View style={styles.offlineTextWrap}>
              <Text style={styles.offlineTitle}>No internet connection</Text>
              <Text style={styles.offlineSubtitle}>
                Please check your internet connection and try again.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.offlineRetryBtn}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.offlineRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* =================================================================== */}
        {/* 2. REDESIGNED LUXURY WALLET CARD (PERSISTED EYE TOGGLE, NO WATERMARK) */}
        {/* =================================================================== */}
        <View style={styles.walletCard}>
          {/* Card Top Row: Available Balance + Eye Toggle */}
          <View style={styles.walletHeaderRow}>
            <View style={styles.balanceLabelGroup}>
              <Wallet size={14} color="#F472B6" style={{ marginRight: 6 }} />
              <Text style={styles.balanceLabelText}>AVAILABLE BALANCE</Text>
              <TouchableOpacity
                onPress={toggleHideBalance}
                style={styles.eyeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {hideBalance ? (
                  <EyeOff size={16} color="#94A3B8" />
                ) : (
                  <Eye size={16} color="#94A3B8" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Large Bold Balance Display */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceText}>
              {hideBalance
                ? "₦ ••••••••"
                : `₦${Number(balance).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </Text>
          </View>

          {/* Last Updated caption & live sync spinner */}
          <View style={styles.lastUpdatedRow}>
            <Clock size={11} color="#94A3B8" style={{ marginRight: 4 }} />
            <Text style={styles.lastUpdatedText}>
              {cachedWallet?.lastUpdated
                ? formatLastUpdated(cachedWallet.lastUpdated)
                : "Live"}
            </Text>
            {isWalletFetching && (
              <ActivityIndicator
                size="small"
                color="#F472B6"
                style={{ marginLeft: 6, transform: [{ scale: 0.65 }] }}
              />
            )}
          </View>

          {/* Action Buttons: Fund Wallet & History */}
          <View style={styles.walletActionsRow}>
            <TouchableOpacity
              style={styles.fundWalletBtn}
              onPress={() => router.push("/wallet/fund" as any)}
              activeOpacity={0.88}
            >
              <PlusCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.fundWalletBtnText}>Fund Wallet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => router.push("/(tabs)/activity" as any)}
              activeOpacity={0.8}
            >
              <Clock size={16} color="#E2E8F0" style={{ marginRight: 6 }} />
              <Text style={styles.historyBtnText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =================================================================== */}
        {/* 3. TOUCH-DRAGGABLE PROMOTIONAL BANNER WITH NATIVE BUTTONS */}
        {/* =================================================================== */}
        <View
          style={styles.adSection}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <ScrollView
            ref={bannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleBannerScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            decelerationRate="fast"
            snapToInterval={BANNER_WIDTH}
            snapToAlignment="center"
            style={{ width: BANNER_WIDTH }}
          >
            {PROMO_ADS.map((ad) => (
              <View
                key={ad.id}
                style={[styles.adCard, { width: BANNER_WIDTH, backgroundColor: ad.color }]}
              >
                <View style={styles.adContent}>
                  <View style={[styles.adTagPill, { borderColor: ad.accent }]}>
                    <Text style={[styles.adTagText, { color: ad.accent }]}>
                      {ad.tag}
                    </Text>
                  </View>

                  <Text style={styles.adTitle}>{ad.title}</Text>
                  <Text style={styles.adDesc} numberOfLines={2}>
                    {ad.desc}
                  </Text>

                  {/* Real Native Solid Pill Button */}
                  <TouchableOpacity
                    style={[styles.adSolidBtn, { backgroundColor: ad.accent }]}
                    onPress={() => router.push(ad.route as any)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.adSolidBtnText, { color: ad.btnTextColor }]}>
                      {ad.cta}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Carousel Pagination Dots */}
          <View style={styles.dotsRow}>
            {PROMO_ADS.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  isInteractingRef.current = true;
                  setActivePromoIndex(idx);
                  bannerScrollRef.current?.scrollTo({ x: idx * BANNER_WIDTH, animated: true });
                  setTimeout(() => {
                    isInteractingRef.current = false;
                  }, 3000);
                }}
                style={[
                  styles.dot,
                  activePromoIndex === idx && styles.activeDot,
                ]}
              />
            ))}
          </View>
        </View>

        {/* =================================================================== */}
        {/* 4. QUICK SERVICES GRID (Strictly 4x2 = 8 Total Items) */}
        {/* =================================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Services</Text>
        </View>

        <View style={styles.quickServicesGrid}>
          {QUICK_SERVICES.map((svc) => (
            <TouchableOpacity
              key={svc.id}
              style={styles.gridItem}
              onPress={() => router.push(svc.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.gridIconBox, svc.isMore && styles.moreIconBox]}>
                {svc.isMore ? (
                  <LayoutGrid size={22} color={colors.primary} />
                ) : (
                  <Image source={svc.logo} style={styles.gridAgencyLogo} resizeMode="contain" />
                )}
              </View>
              <Text
                style={[styles.gridLabel, svc.isMore && styles.moreGridLabel]}
                numberOfLines={1}
              >
                {svc.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* =================================================================== */}
        {/* 5. RECENT TRANSACTIONS (STREAMLINED CARD WITH VIEW ALL BUTTON) */}
        {/* =================================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/activity" as any)}
            activeOpacity={0.75}
            style={styles.activityPillBtn}
          >
            <Text style={styles.activityPillText}>View All</Text>
            <ChevronRight size={13} color={colors.primary} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>

        {recentTransactions.length > 0 ? (
          <View style={styles.txListContainer}>
            {recentTransactions.map((tx: any, idx: number) => {
              const isCredit = tx.type === "DEPOSIT" || tx.type === "CREDIT";
              return (
                <View
                  key={tx.id || idx}
                  style={[
                    styles.txItem,
                    idx === recentTransactions.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View
                    style={[
                      styles.txIconWrap,
                      {
                        backgroundColor: isCredit
                          ? "rgba(16, 185, 129, 0.10)"
                          : "rgba(239, 68, 68, 0.10)",
                      },
                    ]}
                  >
                    {isCredit ? (
                      <ArrowDownLeft size={16} color={colors.success} />
                    ) : (
                      <ArrowUpRight size={16} color={colors.error} />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.txDesc} numberOfLines={1}>
                      {tx.description || tx.reference || "Wallet Transaction"}
                    </Text>
                    <Text style={styles.txDate}>
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "Recent"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: isCredit ? colors.success : colors.text },
                    ]}
                  >
                    {isCredit ? "+" : "-"}₦
                    {Number(tx.amount || 0).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyTxCard}>
            <Clock size={20} color={colors.textSecondary} />
            <Text style={styles.emptyTxTitle}>No Recent Transactions</Text>
            <Text style={styles.emptyTxSub}>Your recent wallet orders and deposits will appear here</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },

  /* Top App Bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  avatarTierBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  greetingWrap: {
    marginLeft: 12,
  },
  greetingSub: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  greetingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  /* Redesigned Luxury Fintech Card */
  walletCard: {
    backgroundColor: "#0F172A", // Deep obsidian dark slate
    borderRadius: 22,
    padding: 20,
    marginTop: 6,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(200, 45, 117, 0.35)",
  },
  walletHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceLabelText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  eyeBtn: {
    marginLeft: 8,
    padding: 4,
  },
  balanceRow: {
    marginVertical: 14,
  },
  balanceText: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  walletActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  fundWalletBtn: {
    flex: 1.2,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  fundWalletBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  historyBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  historyBtnText: {
    color: "#E2E8F0",
    fontWeight: "700",
    fontSize: 13,
  },

  /* Touch-Draggable Promotional Banner */
  adSection: {
    marginBottom: 18,
  },
  adCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  adContent: {
    gap: 4,
  },
  adTagPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  adTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  adDesc: {
    fontSize: 12,
    color: "#D1D5DB",
    lineHeight: 16,
  },
  adSolidBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  adSolidBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  activeDot: {
    width: 18,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  activityPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(200, 45, 117, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
  },

  /* Quick Services Grid: Strictly 4x2 = 8 Total Items */
  quickServicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
    marginBottom: 20,
  },
  gridItem: {
    width: "23%",
    alignItems: "center",
  },
  gridIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  moreIconBox: {
    backgroundColor: "rgba(200, 45, 117, 0.10)",
    borderColor: "rgba(200, 45, 117, 0.25)",
  },
  gridAgencyLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginTop: 6,
  },
  moreGridLabel: {
    color: colors.primary,
    fontWeight: "800",
  },

  /* Transactions List Preview */
  txListContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
  },
  txIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  txDesc: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  txDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: "900",
  },
  emptyTxCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  emptyTxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
  },
  emptyTxSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  offlineBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  offlineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  offlineTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#991B1B",
  },
  offlineSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#B91C1C",
    marginTop: 2,
    lineHeight: 15,
  },
  offlineRetryBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineRetryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  lastUpdatedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -6,
    marginBottom: 14,
  },
  lastUpdatedText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
});
