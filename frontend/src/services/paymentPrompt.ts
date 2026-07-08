import * as Notifications from "expo-notifications";
import { Href } from "expo-router";
import { Linking, Platform } from "react-native";

export const PAYMENT_PROMPT_NOTIFICATION_CATEGORY = "payment-recommendation";
const PAYMENT_PROMPT_NOTIFICATION_TYPE = "payment_prompt";

export type PaymentPromptSource = "lab" | "nearby" | "notification";

export type PaymentPromptInput = {
  source: PaymentPromptSource;
  merchantName?: string;
  merchantMcc?: number;
  normalizedCategory?: string;
  recommendedCardProductId?: string;
  recommendedCardName: string;
  rewardRate?: number;
  reason?: string;
};

export type PaymentPromptParams = Record<string, string>;

export type WalletOpenResult =
  | {
      opened: true;
      platform: typeof Platform.OS;
      target: "apple_wallet" | "google_wallet" | "google_wallet_store";
      url: string;
    }
  | {
      opened: false;
      platform: typeof Platform.OS;
      reason: "unsupported_platform" | "open_failed";
      attemptedUrls: string[];
    };

let notificationsConfigured = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function buildPaymentPromptParams(input: PaymentPromptInput): PaymentPromptParams {
  return cleanParams({
    source: input.source,
    merchantName: input.merchantName,
    merchantMcc: input.merchantMcc,
    normalizedCategory: input.normalizedCategory,
    recommendedCardProductId: input.recommendedCardProductId,
    recommendedCardName: input.recommendedCardName,
    rewardRate: input.rewardRate,
    reason: input.reason,
  });
}

export function buildPaymentPromptHref(input: PaymentPromptInput): Href {
  return {
    pathname: "/pay-card",
    params: buildPaymentPromptParams(input),
  } as unknown as Href;
}

export function getWalletInstruction(cardName: string) {
  if (Platform.OS === "ios") {
    return `Tap Open Wallet, double-click the side button, choose ${cardName}, then hold iPhone near the reader.`;
  }

  if (Platform.OS === "android") {
    return `Tap Open Wallet, choose ${cardName}, then hold your phone near the reader.`;
  }

  return `Open your phone wallet, choose ${cardName}, then hold your phone near the reader.`;
}

export function getWalletOpenButtonLabel() {
  if (Platform.OS === "ios") return "Open Apple Wallet";
  if (Platform.OS === "android") return "Open Google Wallet";
  return "Open Wallet";
}

export async function openNativeWallet(): Promise<WalletOpenResult> {
  if (Platform.OS === "ios") {
    return openFirstAvailable([
      {
        target: "apple_wallet" as const,
        url: "wallet://",
      },
    ]);
  }

  if (Platform.OS === "android") {
    return openFirstAvailable([
      {
        target: "google_wallet" as const,
        url: "intent://pay/#Intent;scheme=googlewallet;package=com.google.android.apps.walletnfcrel;end",
      },
      {
        target: "google_wallet" as const,
        url: "googlewallet://",
      },
      {
        target: "google_wallet_store" as const,
        url: "market://details?id=com.google.android.apps.walletnfcrel",
      },
      {
        target: "google_wallet_store" as const,
        url: "https://play.google.com/store/apps/details?id=com.google.android.apps.walletnfcrel",
      },
    ]);
  }

  return {
    opened: false,
    platform: Platform.OS,
    reason: "unsupported_platform",
    attemptedUrls: [],
  };
}

export function getPaymentPromptNotificationData(input: PaymentPromptInput) {
  return {
    type: PAYMENT_PROMPT_NOTIFICATION_TYPE,
    ...buildPaymentPromptParams(input),
  };
}

export function isPaymentPromptNotificationData(
  data: Record<string, unknown>
): data is PaymentPromptParams & { type: typeof PAYMENT_PROMPT_NOTIFICATION_TYPE } {
  return (
    data.type === PAYMENT_PROMPT_NOTIFICATION_TYPE &&
    typeof data.recommendedCardName === "string" &&
    data.recommendedCardName.trim().length > 0
  );
}

export async function configurePaymentPromptNotifications() {
  if (notificationsConfigured) return;

  await Notifications.setNotificationCategoryAsync(
    PAYMENT_PROMPT_NOTIFICATION_CATEGORY,
    [
      {
        identifier: "show-card",
        buttonTitle: "Show Card",
        options: {
          opensAppToForeground: true,
        },
      },
    ]
  );

  notificationsConfigured = true;
}

export async function schedulePaymentPromptNotification(input: PaymentPromptInput) {
  await configurePaymentPromptNotifications();

  const permissions = await ensureNotificationPermissions();
  if (!permissions) {
    return false;
  }

  const merchant = input.merchantName ?? "this merchant";
  const reward =
    typeof input.rewardRate === "number" && input.normalizedCategory
      ? ` for ${input.rewardRate}x ${input.normalizedCategory}`
      : "";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Use ${input.recommendedCardName}`,
      body: `Tap to see the payment prompt for ${merchant}${reward}.`,
      data: getPaymentPromptNotificationData(input),
      categoryIdentifier: PAYMENT_PROMPT_NOTIFICATION_CATEGORY,
    },
    trigger: null,
  });

  return true;
}

async function ensureNotificationPermissions() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function cleanParams(values: Record<string, unknown>): PaymentPromptParams {
  return Object.entries(values).reduce<PaymentPromptParams>((params, [key, value]) => {
    if (value === undefined || value === null || value === "") {
      return params;
    }

    params[key] = String(value);
    return params;
  }, {});
}

async function openFirstAvailable(
  candidates: {
    target: "apple_wallet" | "google_wallet" | "google_wallet_store";
    url: string;
  }[]
): Promise<WalletOpenResult> {
  const attemptedUrls: string[] = [];

  for (const candidate of candidates) {
    attemptedUrls.push(candidate.url);

    try {
      await Linking.openURL(candidate.url);
      return {
        opened: true,
        platform: Platform.OS,
        target: candidate.target,
        url: candidate.url,
      };
    } catch (error) {
      console.warn("Could not open wallet target:", candidate.url, error);
    }
  }

  return {
    opened: false,
    platform: Platform.OS,
    reason: "open_failed",
    attemptedUrls,
  };
}
