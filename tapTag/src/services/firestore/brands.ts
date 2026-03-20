import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";

export interface BrandLocation {
  lat: number;
  lon: number;
  address?: string;
}

export interface Brand {
  id: string;
  name: string;
  mcc: number;
  category: string;
  brandLogo?: string;
  commonLocations: BrandLocation[];
}

function normalizeCommonLocations(data: any): BrandLocation[] {
  if (Array.isArray(data.commonLocations)) {
    return data.commonLocations
      .map((location: any) => ({
        lat: Number(location?.lat),
        lon: Number(location?.lon),
        address:
          typeof location?.address === "string" ? location.address : undefined,
      }))
      .filter(
        (location) =>
          Number.isFinite(location.lat) && Number.isFinite(location.lon)
      );
  }

  if (data.coordinates) {
    const lat = Number(data.coordinates.lat);
    const lon = Number(data.coordinates.lon ?? data.coordinates.lng);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [{ lat, lon }];
    }
  }

  return [];
}

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
        commonLocations: normalizeCommonLocations(data),
      } as Brand;
    });

    return brands;
  } catch (error) {
    console.error("Error fetching brands:", error);
    throw error;
  }
}
