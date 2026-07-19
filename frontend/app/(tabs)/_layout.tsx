import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getTabBarBottomPadding,
  getTabBarHeight,
} from "../../src/styles/layout";
import { colors, shadows } from "../../src/styles/theme";

/*
  File role:
  Defines the persistent bottom-tab shell once a user is inside the product.

  The names here match file-based routes under app/(tabs), and the titles/icons
  are the user-facing labels for those routes.
*/

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { borderRadius: 16, marginHorizontal: 3 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderColor: colors.border,
          borderRadius: 24,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          bottom: Math.max(insets.bottom, 8),
          height: getTabBarHeight(insets.bottom),
          left: 12,
          paddingBottom: getTabBarBottomPadding(insets.bottom),
          paddingHorizontal: 7,
          paddingTop: 8,
          position: "absolute",
          right: 12,
          ...shadows.floating,
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Cards"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Lab"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="Nearby"
        options={{
          title: "Nearby",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
