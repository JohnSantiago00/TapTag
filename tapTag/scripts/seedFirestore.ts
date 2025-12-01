import "dotenv/config";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedFirestore() {
  console.log("🌱 Seeding Firestore...");
  console.log("Firebase Config:", firebaseConfig);

  const brands = [
    {
      id: "starbucks",
      name: "Starbucks",
      mcc: 5814,
      category: "Dining",
      brandLogo: "https://logo.clearbit.com/starbucks.com",
    },
    {
      id: "amazon",
      name: "Amazon",
      mcc: 5311,
      category: "Online Shopping",
      brandLogo: "https://logo.clearbit.com/amazon.com",
    },
    {
      id: "shell",
      name: "Shell Gas Station",
      mcc: 5541,
      category: "Gas",
      brandLogo: "https://logo.clearbit.com/shell.com",
    },
    {
      id: "target",
      name: "Target",
      mcc: 5310,
      category: "Groceries",
      brandLogo: "https://logo.clearbit.com/target.com",
    },
  ];

  for (const brand of brands) {
    await setDoc(doc(db, "brands", brand.id), {
      name: brand.name,
      mcc: brand.mcc,
      category: brand.category,
      brandLogo: brand.brandLogo,
    });
  }

  const mccMap = [
    { mcc: 5814, category: "Dining" },
    { mcc: 5311, category: "Online Shopping" },
    { mcc: 5541, category: "Gas" },
    { mcc: 5310, category: "Groceries" },
  ];

  for (const entry of mccMap) {
    await setDoc(doc(db, "mcc_map", entry.mcc.toString()), {
      mcc: entry.mcc,
      category: entry.category,
    });
  }

  console.log("✅ Firestore seeded successfully!");
}

// Run the seeder
seedFirestore().catch((err) => console.error("❌ Seed failed:", err));
