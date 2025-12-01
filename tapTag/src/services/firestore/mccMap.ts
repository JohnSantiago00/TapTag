import { db } from "@/src/config/firebase";
import { doc, getDoc } from "firebase/firestore";

export const getCategoryByMcc = async (mcc: number) => {
  const ref = doc(db, "mcc_map", mcc.toString());
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as any).category : null;
};
