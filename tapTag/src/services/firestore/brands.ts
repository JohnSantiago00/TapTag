import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";

/*
  File role:
  Reads merchant-brand knowledge from Firestore.

  A brand here is a merchant identity plus its default MCC and a small set of
  seeded sample locations for testing Nearby.
*/

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

// Older brand docs used a single coordinates object, newer docs use
// commonLocations. This helper supports both so seeded data can evolve without
// breaking the app.
function normalizeCommonLocations(data: any): BrandLocation[] {
  if (Array.isArray(data.commonLocations)) {
    return data.commonLocations
      .map((location: unknown) => {
        const rawLocation =
          typeof location === "object" && location !== null
            ? (location as {
                lat?: unknown;
                lon?: unknown;
                address?: unknown;
              })
            : undefined;

        return {
          lat: Number(rawLocation?.lat),
          lon: Number(rawLocation?.lon),
          address:
            typeof rawLocation?.address === "string"
              ? rawLocation.address
              : undefined,
        };
      })
      .filter(
        (location: BrandLocation) =>
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

// A Brand is merchant identity, for example Starbucks or Amazon, not a single
// physical store.
export async function getAllBrands(): Promise<Brand[]> {
  try {
    const ref = collection(db, "brands");
    const snapshot = await getDocs(ref);

    // The app currently reads the entire small seeded brand set at once.
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
