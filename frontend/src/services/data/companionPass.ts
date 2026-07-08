import { Platform } from "react-native";
import { apiRequest } from "../api";

export interface CompanionPassRecommendation {
  merchantName: string;
  merchantMcc?: number | null;
  normalizedCategory: string;
  recommendedCardProductId?: string | null;
  recommendedCardName: string;
  rewardRate?: number | null;
  reason?: string | null;
  source: string;
  createdAt?: string;
  updatedAt: string;
}

export interface CompanionPassInstallLink {
  configured: boolean;
  platform: "ios" | "android";
  reason?: string;
  url?: string;
  preview?: {
    merchantName?: string;
    normalizedCategory?: string;
    recommendedCardName?: string;
    rewardRate?: number | null;
    updatedAt?: string;
  } | null;
}

export async function getCompanionPassRecommendation(
  uid: string
): Promise<CompanionPassRecommendation | null> {
  void uid;
  return apiRequest<CompanionPassRecommendation | null>(
    "/api/users/me/companion-pass",
    { authRequired: true }
  );
}

export async function updateCompanionPassRecommendation(
  uid: string,
  recommendation: Omit<CompanionPassRecommendation, "createdAt" | "updatedAt">
) {
  void uid;
  return apiRequest<CompanionPassRecommendation>("/api/users/me/companion-pass", {
    method: "PUT",
    authRequired: true,
    body: recommendation,
  });
}

export async function getCompanionPassInstallLink(uid: string) {
  void uid;
  const platform = Platform.OS === "android" ? "android" : "ios";
  return apiRequest<CompanionPassInstallLink>(
    `/api/users/me/companion-pass/install-link?platform=${platform}`,
    { authRequired: true }
  );
}
