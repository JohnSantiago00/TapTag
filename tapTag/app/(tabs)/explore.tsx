import { addDoc, collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { db } from "../../src/config/firebase"; // adjust path if needed

export default function FirebaseTestScreen() {
  const [status, setStatus] = useState("⏳ Testing Firebase connection...");

  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log("🚀 Starting Firestore test...");

        // Try writing a test document
        await addDoc(collection(db, "testConnection"), {
          message: "Hello TapTag",
          timestamp: new Date().toISOString(),
        });
        console.log("✅ Firestore write successful!");

        // Try reading it back
        const snapshot = await getDocs(collection(db, "testConnection"));
        const docs = snapshot.docs.map((doc) => doc.data());
        console.log("📄 Firestore documents:", docs);

        setStatus("✅ Firebase Firestore connection working!");
      } catch (error: any) {
        console.error("❌ Firestore error:", error);
        setStatus(`❌ Firebase connection failed: ${error.message}`);
      }
    };

    testConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  text: { fontSize: 18, textAlign: "center", color: "#fff" },
});
