import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";

export interface Brand {
  id: string;
  name: string;
  mcc: number;
  category: string;
}

export async function getAllBrands(): Promise<Brand[]> {
  const ref = collection(db, "brands");
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Brand, "id">),
  }));
}