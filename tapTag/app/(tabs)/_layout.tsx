import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
          title: "My Cards",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Lab"
        options={{
          title: "Lab",
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
