import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

/*
  File role:
  Defines the persistent bottom-tab shell once a user is inside the product.

  The names here match file-based routes under app/(tabs), and the titles/icons
  are the user-facing labels for those routes.
*/

// Tab order mirrors the intended tester journey, understand the product,
// configure Wallet, verify the engine in Lab, test the magic moment in Nearby,
// then confirm state and events in Profile.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Keeping the visual shell consistent helps the app feel less like a
        // prototype, even though the product scope is still intentionally thin.
        tabBarActiveTintColor: "#0af",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: { backgroundColor: "#000" },
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
          title: "Lab",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flask" color={color} size={size} />
          ),
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
