import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";

// Define the structure of each brand document
export interface Brand {
  id: string;
  name: string;
  mcc: number;
  category: string;
  brandLogo?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Fetch all brands from Firestore
export async function getAllBrands(): Promise<Brand[]> {
  try {
    const ref = collection(db, "brands");
    const snapshot = await getDocs(ref);

    const brands = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: data.name || "Unknown",
        mcc: Number(data.mcc) || 0,
        category: data.category || "Unknown",
        brandLogo: data.brandLogo || null,
        coordinates: data.coordinates
          ? {
              lat: Number(data.coordinates.lat),
              lng: Number(data.coordinates.lng),
            }
          : undefined,
      } as Brand;
    });

    return brands;
  } catch (error) {
    console.error("Error fetching brands:", error);
    return [];
  }
}