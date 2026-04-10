// seed/seedFirestore.js
import admin from "firebase-admin";
import fs from "fs";

// Load credentials
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Load seed data
const seedData = JSON.parse(fs.readFileSync("./seedData.json", "utf8"));

// Helper to write a collection
async function importCollection(collectionName, data) {
  const collectionRef = db.collection(collectionName);
  const entries = Object.entries(data);

  console.log(`\n📥 Importing ${entries.length} documents into '${collectionName}'...`);

  for (const [docId, docData] of entries) {
    await collectionRef.doc(docId).set(docData);
    console.log(`  ✅ Wrote ${collectionName}/${docId}`);
  }
}

async function main() {
  console.log("🚀 Starting Firestore import...");
  for (const [collectionName, data] of Object.entries(seedData)) {
    await importCollection(collectionName, data);
  }
  console.log("\n🎉 Firestore import complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("🔥 Error seeding Firestore:", err);
  process.exit(1);
});