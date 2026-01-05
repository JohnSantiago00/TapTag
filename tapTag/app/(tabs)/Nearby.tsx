import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { auth } from "../../src/config/firebase";
import { Brand, getAllBrands } from "../../src/services/firestore/brands";
import { getCategoryByMcc } from "../../src/services/firestore/mccMap";
import { getUserCards } from "../../src/services/firestore/userCards";
import { getDistance } from "../../src/utils/distance";
import { getBestCard } from "../../src/utils/recommendCard";

export default function Nearby() {
  const [status, setStatus] = useState("Waiting for location...");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const user = auth.currentUser;

  useEffect(() => {
    (async () => {
      // 1️⃣ Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setStatus("Location permission denied.");
        return;
      }

      // 2️⃣ Get current device location
      const loc = await Location.getCurrentPositionAsync({});
      console.log("📍 Device Location:", loc.coords.latitude, loc.coords.longitude);
      setLocation(loc);

      // 3️⃣ Fetch all brands from Firestore
      const fetchedBrands = await getAllBrands();
      console.log("🏪 Loaded brands:", fetchedBrands.map(b => b.name).join(", "));
      setBrands(fetchedBrands);

      setStatus("Tracking nearby merchants...");
    })();
  }, []);

  useEffect(() => {
    if (location && brands.length > 0) {
      checkNearby(location);
    }
  }, [location, brands]);

  // 🔍 Core detection logic
  async function checkNearby(loc: Location.LocationObject) {
    if (!user) return;

    const cards = await getUserCards(user.uid);
    if (!cards.length) {
      setStatus("No saved cards found. Please add cards first.");
      return;
    }

    let foundMerchant = false;

    for (const brand of brands) {
      if (!brand.coordinates) continue;

      const distance = getDistance(
        loc.coords.latitude,
        loc.coords.longitude,
        brand.coordinates.lat,
        brand.coordinates.lng
      );

      console.log(
        `🗺️ Checking ${brand.name} → Distance: ${distance.toFixed(1)} m`
      );

      // ✅ Within ~150 meters
      if (distance < 500) {
        const category = await getCategoryByMcc(brand.mcc);
        const { bestCard, bestReward } = getBestCard(cards, category);

        console.log(
          `✅ Within range of ${brand.name}: ${distance.toFixed(1)}m — Recommended: ${bestCard.name} (${bestReward}%)`
        );

        // Instead of notifications → update on-screen text
        setStatus(
          `💳 Use ${bestCard.name}! ${brand.name} (${category}) → ${bestReward}% back`
        );

        foundMerchant = true;
        break;
      }
    }

    if (!foundMerchant) {
      setStatus("No nearby merchants detected.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📡 TapTag Geo Trigger Test</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    color: "#0af",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  status: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
  },
});