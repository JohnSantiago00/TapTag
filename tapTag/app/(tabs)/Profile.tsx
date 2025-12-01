import { auth } from "@/src/config/firebase";
import { signOut } from "firebase/auth";
import { StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile Screen</Text>
      <Text style={{ color: "#ff5", marginTop: 10 }} onPress={handleLogout}>
        Logout
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  text: { color: "#fff", fontSize: 20, fontWeight: "600" },
});
