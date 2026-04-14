import { db } from "@/src/config/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

/*
  File role:
  Bridges raw merchant category codes into TapTag's normalized categories.

  This is what allows different merchant-specific MCC labels to collapse into a
  smaller recommendation language like Dining, Groceries, or Gas.
*/

export interface MccMapping {
  id: string;
  mcc: number;
  category: string;
  normalizedCategory: string;
  description?: string;
}

// Normalized category is the heart of TapTag's thin-slice recommendation logic.
// It lets similar MCC labels collapse into one recommendation key like Dining.
function normalizeCategoryName(data: any) {
  return (
    (typeof data.normalizedCategory === "string" && data.normalizedCategory) ||
    (typeof data.category === "string" && data.category.split(" - ")[0]) ||
    "Other"
  );
}

// This helper is useful when a flow already knows a single MCC and does not
// need the full mapping collection.
export const getCategoryByMcc = async (mcc: number) => {
  const ref = doc(db, "mcc_map", mcc.toString());
  const snap = await getDoc(ref);
  return snap.exists() ? normalizeCategoryName(snap.data()) : null;
};

// Full MCC mapping reads are used by Lab and Nearby because they need category
// context for multiple brands at once.
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
