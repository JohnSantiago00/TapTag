import { db } from "@/src/config/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

export interface MccMapping {
  id: string;
  category: string;
  description?: string;
}

export const getCategoryByMcc = async (mcc: number) => {
  const ref = doc(db, "mcc_map", mcc.toString());
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as any).category : null;
};

export async function getAllMccMappings(): Promise<MccMapping[]> {
  try {
    const ref = collection(db, "mcc_map");
    const snapshot = await getDocs(ref);

    return snapshot.docs.map((mappingDoc) => {
      const data = mappingDoc.data();

      return {
        id: mappingDoc.id,
        category: data.category || "Unknown Category",
        description: data.description || "",
      };
    });
  } catch (error) {
    console.error("Error fetching MCC mappings:", error);
    throw error;
  }
}
