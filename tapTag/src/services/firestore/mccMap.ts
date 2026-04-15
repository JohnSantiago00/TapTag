import { DEMO_MCC_MAPPINGS } from '../../demo/knowledge';

/*
  File role:
  Bridges raw merchant category codes into TapTag's normalized categories.

  Demo mode keeps these mappings in-app so recommendations work without a
  backend dependency.
*/

export interface MccMapping {
  id: string;
  mcc: number;
  category: string;
  normalizedCategory: string;
  description?: string;
}

export const getCategoryByMcc = async (mcc: number) => {
  const match = DEMO_MCC_MAPPINGS.find((item) => item.mcc === mcc);
  return match?.normalizedCategory ?? null;
};

export async function getAllMccMappings(): Promise<MccMapping[]> {
  return DEMO_MCC_MAPPINGS.map((mapping) => ({ ...mapping }));
}
