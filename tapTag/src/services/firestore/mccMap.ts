import { db } from "@/src/config/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

export interface MccMapping {
  id: string;
  mcc: number;
  category: string;
  normalizedCategory: string;
  description?: string;
}

function normalizeCategoryName(data: any) {
  return (
    (typeof data.normalizedCategory === "string" && data.normalizedCategory) ||
    (typeof data.category === "string" && data.category.split(" - ")[0]) ||
    "Other"
  );
}

export const getCategoryByMcc = async (mcc: number) => {
  const ref = doc(db, "mcc_map", mcc.toString());
  const snap = await getDoc(ref);
  return snap.exists() ? normalizeCategoryName(snap.data()) : null;
};

export async function getAllMccMappings(): Promise<MccMapping[]> {
  try {
    const ref = collection(db, "mcc_map");
    const snapshot = await getDocs(ref);

    return snapshot.docs.map((mappingDoc) => {
      const data = mappingDoc.data();

      return {
        id: mappingDoc.id,
        mcc: Number(data.mcc) || Number(mappingDoc.id) || 0,
        category: data.category || "Unknown Category",
        normalizedCategory: normalizeCategoryName(data),
        description: data.description || "",
      };
    });
  } catch (error) {
    console.error("Error fetching MCC mappings:", error);
    throw error;
  }
}
