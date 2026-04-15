import { DEMO_CARDS } from '../../demo/knowledge';

/*
  File role:
  Reads global card-product knowledge for demo mode.

  In this branch, cards are bundled with the app so a tester can clone and run
  without provisioning Firestore first.
*/

export interface KnowledgeCardRewardRule {
  category: string;
  rate: number;
}

export interface KnowledgeCard {
  id: string;
  name: string;
  issuer: string;
  network: string;
  rewardRules: KnowledgeCardRewardRule[];
  annualFee?: number | null;
}

export async function getAllCards(): Promise<KnowledgeCard[]> {
  return DEMO_CARDS.map((card) => ({ ...card }));
}
