import { DEMO_BRANDS } from '../../demo/knowledge';

/*
  File role:
  Reads merchant-brand knowledge for demo mode.

  Nearby and Lab still use the same shapes as before, they just read from local
  bundled data instead of Firestore.
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

export async function getAllBrands(): Promise<Brand[]> {
  return DEMO_BRANDS.map((brand) => ({
    ...brand,
    commonLocations: brand.commonLocations.map((location) => ({ ...location })),
  }));
}
