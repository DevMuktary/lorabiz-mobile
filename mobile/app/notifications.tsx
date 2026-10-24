import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCheck,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Wallet,
  Clock,
  Sparkles,
  ChevronRight,
  Trash2,
} from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useTheme } from "../context/ThemeContext";
import { resolveMobileRoute } from "../lib/route-mapper";

interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string; // "info" | "success" | "warning"
  link: string | null;
  read: boolean;
  createdAt: string;
}

type FilterTab = "ALL" | "UNREAD" | "TRANSACTIONS" | "SERVICES";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  // Fetch in-app notifications
  const {
    data: notifications = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<InAppNotification[]>({
    queryKey: ["inAppNotifications"],
    queryFn: async () => {
      const res = await api.get("/api/notifications?limit=60");
      if (res?.notifications && Array.isArray(res.notifications)) {
        return res.notifications;
      }
      return [];
    },
  });

  // Mark all as read mutation
  const markAllMutation = useMutation({
    mutationFn: async () => {
      await api.patch("/api/notifications", {});
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["inAppNotifications"] });
      const previous = queryClient.getQueryData<InAppNotification[]>(["inAppNotifications"]);
      if (previous) {
        queryClient.setQueryData<InAppNotification[]>(
          ["inAppNotifications"],
          previous.map((n) => ({ ...n, read: true }))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["inAppNotifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
    },
  });

  // Mark single as read mutation
  const markSingleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch("/api/notifications", { id });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["inAppNotifications"] });
      const previous = queryClient.getQueryData<InAppNotification[]>(["inAppNotifications"]);
      if (previous) {
        queryClient.setQueryData<InAppNotification[]>(
          ["inAppNotifications"],
          previous.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      }
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
    },
  });

  // Delete single notification mutation
  const deleteSingleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/notifications?id=${encodeURIComponent(id)}`);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["inAppNotifications"] });
      const previous = queryClient.getQueryData<InAppNotification[]>(["inAppNotifications"]);
      if (previous) {
        queryClient.setQueryData<InAppNotification[]>(
          ["inAppNotifications"],
          previous.filter((n) => n.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["inAppNotifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
    },
  });

  // Clear all notifications mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/api/notifications?all=true");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["inAppNotifications"] });
      const previous = queryClient.getQueryData<InAppNotification[]>(["inAppNotifications"]);
      queryClient.setQueryData<InAppNotification[]>(["inAppNotifications"], []);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["inAppNotifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications"] });
    },
  });

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Filtered notifications by tab
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeTab === "UNREAD") return !item.read;
      if (activeTab === "TRANSACTIONS") {
        const text = `${item.title} ${item.message}`.toLowerCase();
        return (
          text.includes("wallet") ||
          text.includes("funded") ||
          text.includes("payment") ||
          text.includes("debit") ||
          text.includes("credit") ||
          text.includes("naira") ||
          text.includes("₦")
        );
      }
      if (activeTab === "SERVICES") {
        const text = `${item.title} ${item.message}`.toLowerCase();
        return (
          text.includes("cac") ||
          text.includes("nin") ||
          text.includes("bvn") ||
          text.includes("tax") ||
          text.includes("scuml") ||
          text.includes("filing")
        );
      }
      return true;
    });
  }, [notifications, activeTab]);

  const handleNotificationPress = (item: InAppNotification) => {
    if (!item.read) {
      markSingleMutation.mutate(item.id);
    }

    const targetRoute = resolveMobileRoute(item.link, item.title, item.message);
    if (targetRoute) {
      try {
        router.push(targetRoute as any);
      } catch (err) {
        console.warn("⚠️ Route navigation failed, falling back to activity:", err);
        router.push("/(tabs)/activity");
      }
    }
  };

  const formatTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-NG", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getNotificationIcon = (type: string, title: string, message: string) => {
    const text = `${title} ${message}`.toLowerCase();
    if (text.includes("wallet") || text.includes("payment") || text.includes("funded") || text.includes("₦")) {
      return <Wallet size={18} color="#10B981" />;
    }
    if (type === "success" || text.includes("approved") || text.includes("complete")) {
      return <CheckCircle2 size={18} color="#10B981" />;
    }
    if (type === "warning" || text.includes("query") || text.includes("action required") || text.includes("failed")) {
      return <AlertTriangle size={18} color="#F59E0B" />;
    }
    return <Sparkles size={18} color="#6366F1" />;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.surfaceBorder }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9" }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadHeaderSubtitle}>
                {unreadCount} unread update{unreadCount > 1 ? "s" : ""}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.markAllBtn, { backgroundColor: isDark ? "rgba(200, 45, 117, 0.15)" : "#FCE7F3" }]}
              onPress={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              activeOpacity={0.75}
            >
              <CheckCheck size={14} color={colors.primary} />
              <Text style={[styles.markAllText, { color: colors.primary }]}>Read All</Text>
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity
              style={[styles.clearAllBtn, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEE2E2" }]}
              onPress={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              activeOpacity={0.75}
            >
              <Trash2 size={13} color="#EF4444" />
              <Text style={[styles.clearAllText, { color: "#EF4444" }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {(
          [
            { key: "ALL", label: "All" },
            { key: "UNREAD", label: unreadCount > 0 ? `Unread (${unreadCount})` : "Unread" },
            { key: "TRANSACTIONS", label: "Wallet" },
            { key: "SERVICES", label: "Services" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : isDark
                    ? "rgba(255, 255, 255, 0.06)"
                    : "#F1F5F9",
                },
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabPillText,
                  {
                    color: isActive
                      ? "#FFFFFF"
                      : isDark
                      ? "rgba(255, 255, 255, 0.7)"
                      : "#64748B",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notifications List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            filteredNotifications.length === 0 && styles.listContentEmpty,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9" }]}>
                <Bell size={32} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {activeTab === "UNREAD"
                  ? "You have read all your notifications."
                  : "Important updates regarding wallet deposits and filings will appear here."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUnread = !item.read;
            const icon = getNotificationIcon(item.type, item.title, item.message);

            return (
              <TouchableOpacity
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isUnread ? colors.primary : colors.surfaceBorder,
                  },
                  isUnread && styles.unreadCardAccent,
                ]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.iconWrap, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.07)" : "#F8FAFC" }]}>
                    {icon}
                  </View>

                  <View style={styles.cardHeaderMeta}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.notificationTitle,
                          { color: colors.text, fontWeight: isUnread ? "800" : "600" },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                    </View>
                    <Text style={[styles.timestampText, { color: colors.textSecondary }]}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>

                  {/* Individual Delete Button */}
                  <TouchableOpacity
                    style={[
                      styles.deleteCardBtn,
                      { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9" },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      deleteSingleMutation.mutate(item.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color={isDark ? "#94A3B8" : "#64748B"} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.messageText, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  {item.message}
                </Text>

                {item.link ? (
                  <View style={styles.cardFooter}>
                    <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View details</Text>
                    <ChevronRight size={14} color={colors.primary} />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  unreadHeaderSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C82D75",
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  deleteCardBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  notificationCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  unreadCardAccent: {
    borderLeftWidth: 4,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderMeta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  notificationTitle: {
    fontSize: 14,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timestampText: {
    fontSize: 11,
    marginTop: 2,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});
