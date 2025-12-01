import { db } from "@/src/config/firebase";
import { collection, getDocs } from "firebase/firestore";

export const getBrands = async () => {
  const snapshot = await getDocs(collection(db, "brands"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data }));
};
